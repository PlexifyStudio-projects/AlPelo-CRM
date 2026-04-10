# ============================================================================
# AUTOMATION ENGINE — Generic evaluator for user-created automations
# Replaces the 42 hardcoded workflow executors with ONE universal engine.
# Called by the scheduler every 2 minutes during business hours.
#
# Architecture:
#   AutomationRule (DB) → evaluate trigger → apply filters → deduplicate
#   → render message → send via WhatsApp template → log execution
#
# Trigger types are universal for ANY business type (gym, clinic, salon, etc.)
# ============================================================================

import os
import re
import time
import json
import httpx
from datetime import datetime, date, timedelta

from database.connection import SessionLocal
from database.models import (
    AutomationRule, AutomationExecution, Tenant, Client,
    Appointment, VisitHistory, Staff, Service,
    WhatsAppConversation, WhatsAppMessage,
)
from routes._helpers import normalize_phone, now_colombia as _now_colombia, get_wa_token, get_wa_phone_id
from activity_log import log_event

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")


# ============================================================================
# PLAN LIMITS — Max automations per plan
# ============================================================================

PLAN_LIMITS = {
    "trial": 3,
    "starter": 10,
    "pro": 25,
    "business": 50,
    "enterprise": 999,
}


def get_plan_limit(tenant):
    """Return max automations allowed for tenant — from DB column first, fallback to plan dict."""
    if tenant and getattr(tenant, 'max_automations', None):
        return tenant.max_automations
    return PLAN_LIMITS.get(tenant.plan or "trial", 3)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _find_conv_by_phone(db, phone, tenant_id=None):
    """Find WhatsApp conversation by phone number, scoped to tenant."""
    if not phone:
        return None
    tail = phone[-10:]
    q = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.wa_contact_phone.contains(tail)
    )
    if tenant_id:
        q = q.filter(WhatsAppConversation.tenant_id == tenant_id)
    return q.first()


def _is_within_24h_window(db, conv):
    """Check if client sent inbound message within last 24 hours."""
    if not conv:
        return False
    cutoff = datetime.utcnow() - timedelta(hours=24)
    last_inbound = (
        db.query(WhatsAppMessage)
        .filter(
            WhatsAppMessage.conversation_id == conv.id,
            WhatsAppMessage.direction == "inbound",
            WhatsAppMessage.created_at >= cutoff,
        )
        .first()
    )
    return last_inbound is not None


def _render_message(template, **kwargs):
    """Replace {{placeholders}} in message template."""
    msg = template
    for key, value in kwargs.items():
        msg = msg.replace("{{" + key + "}}", str(value) if value else "")
    return msg


def _was_already_executed(db, automation_id, client_id=None, appointment_id=None, cooldown_days=1):
    """Check if this automation was already executed for this client within cooldown period."""
    q = db.query(AutomationExecution).filter(
        AutomationExecution.automation_id == automation_id,
    )
    if client_id:
        q = q.filter(AutomationExecution.client_id == client_id)
    if appointment_id:
        q = q.filter(AutomationExecution.appointment_id == appointment_id)
    cutoff = datetime.utcnow() - timedelta(days=cooldown_days)
    q = q.filter(AutomationExecution.created_at >= cutoff)
    return q.first() is not None


def _send_template_sync(phone, template_name, language_code="es", parameters=None, db=None, tenant_id=None, header_config=None):
    """Send an approved WhatsApp template message synchronously.
    header_config: optional dict with header_type, header_media_url for IMAGE/VIDEO headers.
    """
    from routes._helpers import get_wa_token, get_wa_phone_id

    token = get_wa_token(db, tenant_id) if db else os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = get_wa_phone_id(db, tenant_id) if db else os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

    if not token or not phone_id:
        print(f"[AUTO-ENGINE] No WA credentials for tenant {tenant_id}")
        return False

    # Check token pause
    try:
        from routes.whatsapp_endpoints import _wa_token_paused
        if _wa_token_paused:
            return False
    except ImportError:
        pass

    template_obj = {
        "name": template_name,
        "language": {"code": language_code},
    }

    components = []

    # Add header component if media exists
    if header_config and header_config.get("header_type") in ("IMAGE", "VIDEO"):
        media_url = header_config.get("header_media_url")
        if media_url and media_url.startswith("data:"):
            try:
                from routes._media_helpers import upload_media_for_send
                default_mime = "image/jpeg" if header_config["header_type"] == "IMAGE" else "video/mp4"
                media_id = upload_media_for_send(media_url, default_mime, token, phone_id)
                if media_id:
                    media_type = "image" if header_config["header_type"] == "IMAGE" else "video"
                    components.append({
                        "type": "header",
                        "parameters": [{"type": media_type, media_type: {"id": media_id}}],
                    })
                    print(f"[AUTO-ENGINE] Header {media_type} media_id: {media_id}")
            except Exception as e:
                print(f"[AUTO-ENGINE] Header upload error: {e}")

    if parameters and len(parameters) > 0:
        clean_params = [p for p in parameters if p and str(p).strip()]
        if clean_params:
            components.append({
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in clean_params],
            })

    if components:
        template_obj["components"] = components

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"https://graph.facebook.com/{WA_API_VERSION}/{phone_id}/messages",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "to": normalize_phone(phone),
                    "type": "template",
                    "template": template_obj,
                },
            )
            data = resp.json()
            if resp.status_code == 200 and "messages" in data:
                if db and tenant_id:
                    try:
                        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
                        if tenant:
                            tenant.messages_used = (tenant.messages_used or 0) + 1
                            db.commit()
                    except Exception:
                        pass
                return True
            else:
                error_msg = data.get("error", {}).get("message", str(data)[:200])
                print(f"[AUTO-ENGINE] Template send failed: {error_msg}")
                return False
    except Exception as e:
        print(f"[AUTO-ENGINE] Template send error: {e}")
        return False


def _send_and_log(db, rule, client, phone, message, appointment_id=None, is_chain=False):
    """Send WhatsApp message and log execution for an AutomationRule."""
    from scheduler import _send_whatsapp_sync, _store_outbound_message, _create_conversation_for_client

    conv = _find_conv_by_phone(db, phone, tenant_id=rule.tenant_id)
    tenant = db.query(Tenant).filter(Tenant.id == rule.tenant_id).first()
    tenant_name = tenant.name if tenant else ""

    # Auto-introduce on first contact
    needs_intro = False
    if conv:
        prev_count = db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv.id).count()
        if prev_count == 0:
            needs_intro = True
    else:
        needs_intro = True

    if needs_intro and client:
        client_first = (client.name or "").split()[0]
        ai_name = tenant.ai_name if tenant else "Lina"
        message = f"Hola {client_first}! Soy {ai_name} de {tenant_name} 👋\n\n" + message

    action_config = rule.action_config or {}
    template_name = action_config.get("template_name") or rule.meta_template_name
    template_lang = action_config.get("template_language", "es")

    # Extract template parameters from rendered message
    template_params = []
    if template_name:
        original_body = action_config.get("message", "")
        if original_body:
            var_names = re.findall(r'\{\{(\w+)\}\}', original_body)
            if var_names:
                regex_pattern = re.escape(original_body)
                for vn in var_names:
                    regex_pattern = regex_pattern.replace(re.escape("{{" + vn + "}}"), "(.+?)", 1)
                regex_pattern += "$"
                clean_msg = message
                if "👋\n\n" in clean_msg:
                    clean_msg = clean_msg.split("👋\n\n", 1)[-1]
                match = re.match(regex_pattern, clean_msg, re.DOTALL)
                if match:
                    template_params = list(match.groups())
                else:
                    client_first = (client.name or "").split()[0] if client else ""
                    fallback = {
                        "nombre": client_first, "negocio": tenant_name,
                        "servicio": "", "profesional": "", "hora": "",
                        "fecha": "", "dias": "", "descuento": "",
                    }
                    template_params = [fallback.get(v, "") for v in var_names]

    # Check send capability
    can_send_template = bool(template_name) and rule.meta_template_status == "approved"
    can_send_freetext = conv and _is_within_24h_window(db, conv)

    if not can_send_template and not can_send_freetext:
        client_name = (client.name or "").split()[0] if client else "?"
        print(f"[AUTO-ENGINE] Skipped {rule.name} for {client_name}: no approved template and outside 24h")
        return False

    # Resolve remaining variables
    remaining = re.findall(r'\{\{(\w+)\}\}', message)
    if remaining:
        client_first = (client.name or "").split()[0] if client else ""
        fallbacks = {
            "nombre": client_first, "negocio": tenant_name or "nuestro negocio",
            "servicio": "", "profesional": "", "hora": "", "fecha": "",
            "dias": "", "descuento": "",
        }
        for var in remaining:
            message = message.replace("{{" + var + "}}", fallbacks.get(var, ""))

    # Create conversation if needed
    if not conv and client and client.phone:
        conv = _create_conversation_for_client(db, client)

    # Build header config from action_config if media exists
    action_cfg = rule.action_config or {}
    hdr_cfg = None
    if action_cfg.get("header_type") in ("IMAGE", "VIDEO") and action_cfg.get("header_media_url"):
        hdr_cfg = {"header_type": action_cfg["header_type"], "header_media_url": action_cfg["header_media_url"]}

    # Send
    wa_sent = False
    if can_send_template:
        wa_sent = _send_template_sync(phone, template_name, template_lang, template_params, db=db, tenant_id=rule.tenant_id, header_config=hdr_cfg)
        if not wa_sent and can_send_freetext:
            wa_sent = _send_whatsapp_sync(phone, message, db=db)
    elif can_send_freetext:
        wa_sent = _send_whatsapp_sync(phone, message, db=db)

    # Store in conversation
    if conv:
        tag = f"automation_{rule.id}"
        if appointment_id:
            tag += f"_appt_{appointment_id}"
        _store_outbound_message(db, conv.id, message, wa_sent, tag=tag)

    # Log execution
    execution = AutomationExecution(
        automation_id=rule.id,
        tenant_id=rule.tenant_id,
        client_id=client.id if client else None,
        appointment_id=appointment_id,
        phone=phone,
        message_sent=message,
        is_chain=is_chain,
        status="sent" if wa_sent else "failed",
    )
    db.add(execution)

    # Update stats
    if wa_sent:
        rule.stats_sent = (rule.stats_sent or 0) + 1
    else:
        rule.stats_failed = (rule.stats_failed or 0) + 1
    rule.last_triggered_at = datetime.utcnow()
    db.commit()

    client_name = (client.name or "").split()[0] if client else "?"
    log_event(
        "tarea",
        f"Automatización '{rule.name}' → {client_name}",
        detail=message[:100],
        contact_name=client_name,
        conv_id=conv.id if conv else None,
        status="ok" if wa_sent else "error",
    )

    return wa_sent


# ============================================================================
# TRIGGER EVALUATORS — Universal functions for any business type
# Each returns a list of (client, appointment_or_None) tuples
# ============================================================================

def _eval_hours_before_appt(db, rule, tenant, preview_mode=False):
    """Trigger: X hours before a confirmed appointment."""
    now = _now_colombia()
    hours = (rule.trigger_config or {}).get("hours", 24)

    if preview_mode:
        # Preview: show all clients with confirmed appointments (any date)
        appts = (
            db.query(Appointment)
            .filter(
                Appointment.tenant_id == tenant.id,
                Appointment.status == "confirmed",
                Appointment.date >= now.date(),
            )
            .all()
        )
        results = []
        for appt in appts:
            client = db.query(Client).filter(Client.id == appt.client_id).first()
            if client:
                results.append((client, appt))
        return results

    target_time = now + timedelta(hours=hours)
    window_start = target_time - timedelta(minutes=5)
    window_end = target_time + timedelta(minutes=5)

    appts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "confirmed",
            Appointment.date == target_time.date(),
        )
        .all()
    )

    results = []
    for appt in appts:
        try:
            appt_dt = datetime.combine(appt.date, datetime.strptime(appt.time, "%H:%M").time())
            if window_start <= appt_dt <= window_end:
                client = db.query(Client).filter(Client.id == appt.client_id).first()
                if client:
                    results.append((client, appt))
        except Exception:
            continue
    return results


def _eval_hours_after_complete(db, rule, tenant, preview_mode=False):
    """Trigger: X hours after appointment completed."""
    now = _now_colombia()

    if preview_mode:
        # Preview: all clients with completed appointments recently
        cutoff = now - timedelta(days=7)
        appts = db.query(Appointment).filter(
            Appointment.tenant_id == tenant.id, Appointment.status == "completed",
            Appointment.updated_at >= cutoff,
        ).all()
        return [(db.query(Client).filter(Client.id == a.client_id).first(), a) for a in appts if db.query(Client).filter(Client.id == a.client_id).first()]

    hours = (rule.trigger_config or {}).get("hours", 2)
    target_time = now - timedelta(hours=hours)
    window_start = target_time - timedelta(minutes=5)
    window_end = target_time + timedelta(minutes=5)

    appts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "completed",
            Appointment.updated_at >= window_start,
            Appointment.updated_at <= window_end,
        )
        .all()
    )

    results = []
    for appt in appts:
        client = db.query(Client).filter(Client.id == appt.client_id).first()
        if client:
            results.append((client, appt))
    return results


def _eval_appointment_created(db, rule, tenant, preview_mode=False):
    """Trigger: New appointment created (within last 5 min)."""
    if preview_mode:
        # Preview: all clients with recent confirmed appointments
        appts = db.query(Appointment).filter(Appointment.tenant_id == tenant.id, Appointment.status == "confirmed").order_by(Appointment.created_at.desc()).limit(50).all()
        results = []
        for appt in appts:
            client = db.query(Client).filter(Client.id == appt.client_id).first()
            if client:
                results.append((client, appt))
        return results

    cutoff = datetime.utcnow() - timedelta(minutes=5)
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "confirmed",
            Appointment.created_at >= cutoff,
        )
        .all()
    )
    results = []
    for appt in appts:
        client = db.query(Client).filter(Client.id == appt.client_id).first()
        if client:
            results.append((client, appt))
    return results


def _eval_appointment_cancelled(db, rule, tenant, preview_mode=False):
    """Trigger: Appointment cancelled (within last 5 min)."""
    if preview_mode:
        appts = db.query(Appointment).filter(Appointment.tenant_id == tenant.id, Appointment.status == "cancelled").limit(50).all()
        return [(db.query(Client).filter(Client.id == a.client_id).first(), a) for a in appts if db.query(Client).filter(Client.id == a.client_id).first()]

    cutoff = datetime.utcnow() - timedelta(minutes=5)
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "cancelled",
            Appointment.updated_at >= cutoff,
        )
        .all()
    )
    results = []
    for appt in appts:
        client = db.query(Client).filter(Client.id == appt.client_id).first()
        if client:
            results.append((client, appt))
    return results


def _eval_no_show(db, rule, tenant, preview_mode=False):
    """Trigger: Client was a no-show (checks yesterday's no-shows at eval hour)."""
    now = _now_colombia()

    if preview_mode:
        # Preview: any no-show clients in last 30 days
        cutoff = (now - timedelta(days=30)).date()
        appts = db.query(Appointment).filter(Appointment.tenant_id == tenant.id, Appointment.status == "no_show", Appointment.date >= cutoff).all()
        results = []
        for appt in appts:
            client = db.query(Client).filter(Client.id == appt.client_id).first()
            if client:
                results.append((client, appt))
        return results

    eval_hour = rule.eval_hour or 9
    if now.hour != eval_hour:
        return []

    yesterday = (now - timedelta(days=1)).date()
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "no_show",
            Appointment.date == yesterday,
        )
        .all()
    )
    results = []
    for appt in appts:
        client = db.query(Client).filter(Client.id == appt.client_id).first()
        if client:
            results.append((client, appt))
    return results


def _eval_days_since_visit(db, rule, tenant, preview_mode=False):
    """Trigger: Client hasn't visited in X days. Universal for any business."""
    now = _now_colombia()

    if not preview_mode:
        eval_hour = rule.eval_hour or 10
        if now.hour != eval_hour:
            return []

    days = (rule.trigger_config or {}).get("days", 30)
    cutoff_date = (now - timedelta(days=days)).date()

    from sqlalchemy import func
    last_visits = (
        db.query(
            VisitHistory.client_id,
            func.max(VisitHistory.visit_date).label("last_visit"),
        )
        .filter(
            VisitHistory.tenant_id == tenant.id,
            VisitHistory.status == "completed",
        )
        .group_by(VisitHistory.client_id)
        .subquery()
    )

    clients = (
        db.query(Client)
        .join(last_visits, Client.id == last_visits.c.client_id)
        .filter(
            Client.tenant_id == tenant.id,
            Client.is_active == True,
            Client.accepts_whatsapp == True,
            last_visits.c.last_visit <= cutoff_date,
        )
        .all()
    )

    return [(c, None) for c in clients]


def _eval_new_client(db, rule, tenant, preview_mode=False):
    """Trigger: New client registered (within last 5 min)."""
    if preview_mode:
        # Preview: all active clients (any new client would match)
        clients = db.query(Client).filter(Client.tenant_id == tenant.id, Client.is_active == True, Client.accepts_whatsapp == True).all()
        return [(c, None) for c in clients]

    cutoff = datetime.utcnow() - timedelta(minutes=5)
    clients = (
        db.query(Client)
        .filter(
            Client.tenant_id == tenant.id,
            Client.is_active == True,
            Client.created_at >= cutoff,
        )
        .all()
    )
    return [(c, None) for c in clients]


def _eval_birthday(db, rule, tenant, preview_mode=False):
    """Trigger: Client's birthday is today."""
    now = _now_colombia()

    if not preview_mode:
        eval_hour = rule.eval_hour or 9
        if now.hour != eval_hour:
            return []

    clients = (
        db.query(Client)
        .filter(
            Client.tenant_id == tenant.id,
            Client.is_active == True,
            Client.accepts_whatsapp == True,
            Client.birthday.isnot(None),
        )
        .all()
    )

    if preview_mode:
        # Preview: all clients with birthday set (potential reach)
        return [(c, None) for c in clients]

    today = now.date()
    results = []
    for c in clients:
        if c.birthday and c.birthday.month == today.month and c.birthday.day == today.day:
            results.append((c, None))
            # Award birthday loyalty bonus (if not already given this year)
            try:
                from routes.loyalty_endpoints import _get_or_create_config, _get_or_create_account, LoyaltyTransaction
                config = _get_or_create_config(db, tenant.id)
                if config.is_active and config.birthday_bonus > 0:
                    account = _get_or_create_account(db, c.id, tenant.id)
                    if account.birthday_bonus_year != today.year:
                        account.available_points += config.birthday_bonus
                        account.total_points += config.birthday_bonus
                        account.birthday_bonus_year = today.year
                        db.add(LoyaltyTransaction(
                            tenant_id=tenant.id, client_id=c.id, type="earn_birthday",
                            points=config.birthday_bonus, description=f"Bonus cumpleanos {today.year}",
                        ))
                        db.flush()
            except Exception as e:
                print(f"[LOYALTY] Birthday bonus error for client {c.id}: {e}")
    return results


def _eval_visit_milestone(db, rule, tenant, preview_mode=False):
    """Trigger: Client reaches X visits."""
    now = _now_colombia()

    if not preview_mode:
        eval_hour = rule.eval_hour or 10
        if now.hour != eval_hour:
            return []

    milestone = (rule.trigger_config or {}).get("milestone", 10)
    from sqlalchemy import func

    if preview_mode:
        # Preview: clients approaching or at milestone
        visit_counts = db.query(VisitHistory.client_id, func.count(VisitHistory.id).label("total")).filter(
            VisitHistory.tenant_id == tenant.id, VisitHistory.status == "completed",
        ).group_by(VisitHistory.client_id).having(func.count(VisitHistory.id) >= max(1, milestone - 2)).all()
    else:
        visit_counts = (
            db.query(VisitHistory.client_id, func.count(VisitHistory.id).label("total"))
            .filter(VisitHistory.tenant_id == tenant.id, VisitHistory.status == "completed")
            .group_by(VisitHistory.client_id)
            .having(func.count(VisitHistory.id) == milestone)
            .all()
        )

    results = []
    for vc in visit_counts:
        client = db.query(Client).filter(Client.id == vc.client_id, Client.is_active == True).first()
        if client:
            results.append((client, None))
    return results


def _eval_client_anniversary(db, rule, tenant, preview_mode=False):
    """Trigger: 1-year anniversary since client's first visit."""
    now = _now_colombia()

    if not preview_mode:
        eval_hour = rule.eval_hour or 10
        if now.hour != eval_hour:
            return []

    if preview_mode:
        # Preview: clients who have been around for ~1 year
        from sqlalchemy import func
        one_year_ago = (now - timedelta(days=365)).date()
        two_years_ago = (now - timedelta(days=730)).date()
        first_visits = db.query(VisitHistory.client_id, func.min(VisitHistory.visit_date).label("first_visit")).filter(
            VisitHistory.tenant_id == tenant.id, VisitHistory.status == "completed",
        ).group_by(VisitHistory.client_id).having(func.min(VisitHistory.visit_date).between(two_years_ago, one_year_ago)).all()
        results = []
        for fv in first_visits:
            client = db.query(Client).filter(Client.id == fv.client_id, Client.is_active == True).first()
            if client:
                results.append((client, None))
        return results

    today = now.date()
    one_year_ago = today.replace(year=today.year - 1)

    from sqlalchemy import func
    first_visits = (
        db.query(
            VisitHistory.client_id,
            func.min(VisitHistory.visit_date).label("first_visit"),
        )
        .filter(
            VisitHistory.tenant_id == tenant.id,
            VisitHistory.status == "completed",
        )
        .group_by(VisitHistory.client_id)
        .having(func.min(VisitHistory.visit_date) == one_year_ago)
        .all()
    )

    results = []
    for fv in first_visits:
        client = db.query(Client).filter(Client.id == fv.client_id, Client.is_active == True).first()
        if client:
            results.append((client, None))
    return results


def _eval_payment_received(db, rule, tenant, preview_mode=False):
    """Trigger: Appointment marked as paid (within last 5 min)."""
    if preview_mode:
        # Preview: clients with any completed & paid appointments
        clients = db.query(Client).filter(Client.tenant_id == tenant.id, Client.is_active == True, Client.accepts_whatsapp == True).all()
        return [(c, None) for c in clients]

    cutoff = datetime.utcnow() - timedelta(minutes=5)
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "completed",
            Appointment.updated_at >= cutoff,
        )
        .all()
    )
    results = []
    for appt in appts:
        visit = (
            db.query(VisitHistory)
            .filter(
                VisitHistory.tenant_id == tenant.id,
                VisitHistory.client_id == appt.client_id,
                VisitHistory.visit_date == appt.date,
                VisitHistory.payment_method.isnot(None),
            )
            .first()
        )
        if visit:
            client = db.query(Client).filter(Client.id == appt.client_id).first()
            if client:
                results.append((client, appt))
    return results


def _eval_payment_pending(db, rule, tenant, preview_mode=False):
    """Trigger: Appointment completed 24h ago but no payment recorded."""
    now = _now_colombia()

    if preview_mode:
        clients = db.query(Client).filter(Client.tenant_id == tenant.id, Client.is_active == True, Client.accepts_whatsapp == True).all()
        return [(c, None) for c in clients]

    eval_hour = rule.eval_hour or 10
    if now.hour != eval_hour:
        return []

    yesterday = (now - timedelta(days=1)).date()
    appts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "completed",
            Appointment.date == yesterday,
        )
        .all()
    )

    results = []
    for appt in appts:
        visit = (
            db.query(VisitHistory)
            .filter(
                VisitHistory.tenant_id == tenant.id,
                VisitHistory.client_id == appt.client_id,
                VisitHistory.visit_date == appt.date,
                VisitHistory.payment_method.isnot(None),
            )
            .first()
        )
        if not visit:
            client = db.query(Client).filter(Client.id == appt.client_id).first()
            if client:
                results.append((client, appt))
    return results


# Map trigger_type → evaluator function
# New triggers reuse existing evaluators with the same patterns
TRIGGER_EVALUATORS = {
    # Citas
    "hours_before_appt": _eval_hours_before_appt,
    "hours_after_complete": _eval_hours_after_complete,
    "appointment_created": _eval_appointment_created,
    "appointment_cancelled": _eval_appointment_cancelled,
    "appointment_rescheduled": _eval_appointment_created,  # Same pattern as created (recent changes)
    "no_show": _eval_no_show,
    "rebooking_reminder": _eval_days_since_visit,  # Same pattern: days since last visit
    # Clientes
    "days_since_visit": _eval_days_since_visit,
    "new_client": _eval_new_client,
    "birthday": _eval_birthday,
    "visit_milestone": _eval_visit_milestone,
    "client_anniversary": _eval_client_anniversary,
    "vip_reached": _eval_visit_milestone,  # Same logic: reached X visits
    "client_at_risk": _eval_days_since_visit,  # Same: days inactive
    # Marketing
    "satisfaction_survey": _eval_hours_after_complete,  # Same: X hours after visit
    "review_request": _eval_hours_after_complete,
    "referral_program": _eval_new_client,  # Targets all active clients
    "seasonal_promo": _eval_new_client,  # Targets all active clients
    "winback_offer": _eval_days_since_visit,  # Same: days without visit
    "upsell_suggestion": _eval_hours_after_complete,
    # Fidelización
    "loyalty_welcome": _eval_new_client,
    "loyalty_points": _eval_visit_milestone,
    "loyalty_reward": _eval_new_client,  # All active clients
    "first_visit_thanks": _eval_hours_after_complete,
    "vip_exclusive": _eval_new_client,  # Filtered by VIP status in filter_config
    # Pagos
    "payment_received": _eval_payment_received,
    "payment_pending": _eval_payment_pending,
    "digital_receipt": _eval_payment_received,
    "membership_expiring": _eval_days_since_visit,  # Reuse days pattern
    # Operaciones
    "daily_summary": _eval_new_client,  # Sends to admin (filtered)
    "staff_briefing": _eval_hours_before_appt,  # Same: hours before appt
    "low_stock_alert": _eval_new_client,  # Admin notification
    "new_booking_alert": _eval_appointment_created,
}


# ============================================================================
# FILTER APPLICATOR — Filters candidates based on rule.filter_config
# ============================================================================

def _apply_filters(candidates, filter_config):
    """Apply audience filters to candidate list. Returns filtered list."""
    if not filter_config:
        return candidates

    filtered = []
    for client, appt in candidates:
        # Status filter
        statuses = filter_config.get("status")
        if statuses:
            if isinstance(statuses, str):
                statuses = [statuses]
            client_status = client.status_override or ("activo" if client.is_active else "inactivo")
            if client_status not in statuses:
                continue

        # Tag filter
        tags = filter_config.get("tags")
        if tags:
            client_tags = client.tags or []
            if not any(t in client_tags for t in tags):
                continue

        # Service filter
        service = filter_config.get("service")
        if service:
            if client.favorite_service and service.lower() not in client.favorite_service.lower():
                continue

        # Min visits filter
        min_visits = filter_config.get("min_visits")
        if min_visits and hasattr(client, 'visits') and len(client.visits) < min_visits:
            continue

        # Min spend filter (check total from visits)
        min_spend = filter_config.get("min_spend")
        if min_spend and hasattr(client, 'visits'):
            total_spend = sum(v.amount or 0 for v in client.visits)
            if total_spend < min_spend:
                continue

        # WhatsApp opt-in filter (always enforced)
        if not client.accepts_whatsapp:
            continue

        # Phone required
        if not client.phone:
            continue

        filtered.append((client, appt))

    return filtered


# ============================================================================
# VARIABLE BUILDER — Builds template variables from client/appointment data
# ============================================================================

def _build_variables(client, appointment, tenant, rule):
    """Build template variable dict from context."""
    from sqlalchemy import func

    client_first = (client.name or "").split()[0] if client else ""
    tenant_name = tenant.name if tenant else ""

    variables = {
        "nombre": client_first,
        "negocio": tenant_name,
    }

    if appointment:
        variables["hora"] = appointment.time or ""
        variables["fecha"] = appointment.date.strftime("%d/%m/%Y") if appointment.date else ""
        # Get staff name
        if appointment.staff_id:
            staff = None
            try:
                from database.connection import SessionLocal
                db = SessionLocal()
                staff = db.query(Staff).filter(Staff.id == appointment.staff_id).first()
                db.close()
            except Exception:
                pass
            variables["profesional"] = staff.name if staff else ""
        # Get service name
        variables["servicio"] = appointment.service_name if hasattr(appointment, 'service_name') else ""

    # Days since last visit
    if client and hasattr(client, 'visits') and client.visits:
        last_visit = client.visits[0] if client.visits else None
        if last_visit:
            days_since = (_now_colombia().date() - last_visit.visit_date).days
            variables["dias"] = str(days_since)
    elif (rule.trigger_config or {}).get("days"):
        variables["dias"] = str(rule.trigger_config["days"])

    return variables


# ============================================================================
# CHAIN EVALUATOR — Follow-up if no reply
# ============================================================================

def _evaluate_chains(db, tenant):
    """Check all enabled automations for chain follow-ups (no reply after X days)."""
    now = _now_colombia()
    if now.hour != 11:  # Evaluate chains at 11 AM
        return

    rules = (
        db.query(AutomationRule)
        .filter(
            AutomationRule.tenant_id == tenant.id,
            AutomationRule.is_enabled == True,
            AutomationRule.chain_config.isnot(None),
        )
        .all()
    )

    for rule in rules:
        chain = rule.chain_config or {}
        no_reply_days = chain.get("if_no_reply_days", 3)
        then_message = chain.get("then_message")
        if not then_message:
            continue

        cutoff = datetime.utcnow() - timedelta(days=no_reply_days)

        # Find executions that were sent but not responded, older than cutoff
        unreplied = (
            db.query(AutomationExecution)
            .filter(
                AutomationExecution.automation_id == rule.id,
                AutomationExecution.status == "sent",
                AutomationExecution.is_chain == False,
                AutomationExecution.created_at <= cutoff,
            )
            .limit(rule.max_per_day or 10)
            .all()
        )

        for exec_record in unreplied:
            # Check if chain was already sent
            chain_exists = (
                db.query(AutomationExecution)
                .filter(
                    AutomationExecution.automation_id == rule.id,
                    AutomationExecution.client_id == exec_record.client_id,
                    AutomationExecution.is_chain == True,
                )
                .first()
            )
            if chain_exists:
                continue

            client = db.query(Client).filter(Client.id == exec_record.client_id).first()
            if not client or not client.phone:
                continue

            # Check if client responded (inbound msg after exec)
            conv = _find_conv_by_phone(db, client.phone, tenant_id=tenant.id)
            if conv:
                inbound_after = (
                    db.query(WhatsAppMessage)
                    .filter(
                        WhatsAppMessage.conversation_id == conv.id,
                        WhatsAppMessage.direction == "inbound",
                        WhatsAppMessage.created_at >= exec_record.created_at,
                    )
                    .first()
                )
                if inbound_after:
                    # Client did respond — mark execution as responded
                    exec_record.status = "responded"
                    db.commit()
                    continue

            # Send follow-up
            variables = _build_variables(client, None, tenant, rule)
            rendered = _render_message(then_message, **variables)
            _send_and_log(db, rule, client, client.phone, rendered, is_chain=True)
            time.sleep(2)


# ============================================================================
# MAIN ENGINE — Called by scheduler every 2 minutes
# ============================================================================

def run_automations(db):
    """Execute all enabled automation rules for all active tenants.
    Called by the scheduler every 2 minutes during business hours."""

    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()

    for tenant in tenants:
        if tenant.ai_is_paused:
            continue

        rules = (
            db.query(AutomationRule)
            .filter(
                AutomationRule.tenant_id == tenant.id,
                AutomationRule.is_enabled == True,
                AutomationRule.meta_template_status == "approved",
            )
            .all()
        )

        for rule in rules:
            try:
                evaluator = TRIGGER_EVALUATORS.get(rule.trigger_type)
                if not evaluator:
                    print(f"[AUTO-ENGINE] Unknown trigger type: {rule.trigger_type}")
                    continue

                # 1. Evaluate trigger → get candidates
                candidates = evaluator(db, rule, tenant)
                if not candidates:
                    continue

                # 2. Apply audience filters
                filtered = _apply_filters(candidates, rule.filter_config)
                if not filtered:
                    continue

                # 3. Deduplicate + limit
                sent_count = 0
                max_per_day = rule.max_per_day or 20

                for client, appt in filtered:
                    if sent_count >= max_per_day:
                        break

                    # Check cooldown
                    if _was_already_executed(
                        db, rule.id,
                        client_id=client.id,
                        appointment_id=appt.id if appt else None,
                        cooldown_days=rule.cooldown_days or 1,
                    ):
                        continue

                    # Global rate limit per conversation (prevent spam)
                    try:
                        conv = _find_conv_by_phone(db, client.phone, tenant_id=rule.tenant_id)
                        if conv:
                            from scheduler import _conv_rate_limited
                            if _conv_rate_limited(db, conv.id):
                                continue
                    except Exception:
                        pass

                    # 4. Build variables and render message
                    action_config = rule.action_config or {}
                    message_template = action_config.get("message", "")
                    if not message_template:
                        continue

                    variables = _build_variables(client, appt, tenant, rule)
                    rendered = _render_message(message_template, **variables)

                    # 5. Send
                    success = _send_and_log(
                        db, rule, client, client.phone, rendered,
                        appointment_id=appt.id if appt else None,
                    )

                    if success:
                        sent_count += 1
                    time.sleep(2)  # Rate limit between sends

            except Exception as e:
                print(f"[AUTO-ENGINE] Error in {rule.name} for {tenant.slug}: {e}")

        # Evaluate chain follow-ups
        try:
            _evaluate_chains(db, tenant)
        except Exception as e:
            print(f"[AUTO-ENGINE] Chain error for {tenant.slug}: {e}")


# ============================================================================
# AUDIENCE PREVIEW — Used by API to show admin how many clients match
# ============================================================================

def preview_audience(db, tenant_id, trigger_type, trigger_config, filter_config):
    """Preview how many clients would match this automation today.
    Returns { total_clients, matching, sample_names }"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        return {"total_clients": 0, "matching": 0, "sample_names": []}

    total_clients = (
        db.query(Client)
        .filter(Client.tenant_id == tenant_id, Client.is_active == True)
        .count()
    )

    # Build a temporary rule for evaluation
    temp_rule = AutomationRule(
        tenant_id=tenant_id,
        trigger_type=trigger_type,
        trigger_config=trigger_config or {},
        filter_config=filter_config or {},
        eval_hour=None,  # Ignore hour restriction for preview
    )

    evaluator = TRIGGER_EVALUATORS.get(trigger_type)
    if not evaluator:
        return {"total_clients": total_clients, "matching": 0, "sample_names": []}

    # Use preview_mode=True to bypass time windows and show potential reach
    try:
        candidates = evaluator(db, temp_rule, tenant, preview_mode=True)
    except Exception as e:
        print(f"[AUTO-ENGINE] Preview error for {trigger_type}: {e}")
        candidates = []
    filtered = _apply_filters(candidates, filter_config)

    sample_names = [
        (c.name or "Sin nombre") for c, _ in filtered[:5]
    ]

    return {
        "total_clients": total_clients,
        "matching": len(filtered),
        "sample_names": sample_names,
    }
