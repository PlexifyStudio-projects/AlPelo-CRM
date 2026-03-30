# ============================================================================
# WORKFLOW ENGINE — Executes automated workflows based on WorkflowTemplate DB
# Called by the scheduler every 2 minutes. DB-safe deduplication.
# Multi-tenant, multi-business-type.
#
# IMPORTANT: WhatsApp Business API requires APPROVED TEMPLATES to initiate
# conversations outside the 24h window. This engine:
# - Uses template messages when a template_name is configured
# - Falls back to text messages only within active conversation windows
# ============================================================================

import os
import time
import json
import httpx
from datetime import datetime, date, timedelta

from database.connection import SessionLocal
from database.models import (
    WorkflowTemplate, WorkflowExecution, Tenant, Client,
    Appointment, VisitHistory, Staff, Service,
    WhatsAppConversation, WhatsAppMessage, MessageTemplate,
)
from routes._helpers import normalize_phone, now_colombia as _now_colombia
from activity_log import log_event

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")


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
    """Check if the client has sent an inbound message within the last 24 hours.
    If yes, we can send free-form text. If no, we MUST use a template."""
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


def _send_template_sync(phone, template_name, language_code="es", parameters=None, db=None):
    """Send an approved WhatsApp template message synchronously.
    Parameters is a list of strings for the template body variables."""
    from routes._helpers import get_wa_token, get_wa_phone_id
    # Try to get tenant from first active tenant
    _tid = None
    if db:
        try:
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
            _tid = tenant.id if tenant else None
        except Exception:
            pass
    token = get_wa_token(db, _tid) if db else os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = get_wa_phone_id(db, _tid) if db else os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")

    if not token or not phone_id:
        print(f"[WORKFLOW] No WA credentials for template send")
        return False

    # Check token pause
    try:
        from routes.whatsapp_endpoints import _wa_token_paused
        if _wa_token_paused:
            return False
    except ImportError:
        pass

    # Build template payload
    template_obj = {
        "name": template_name,
        "language": {"code": language_code},
    }

    # Add body parameters if provided
    if parameters and len(parameters) > 0:
        # Filter out empty params — Meta rejects empty strings in some cases
        clean_params = [p for p in parameters if p and str(p).strip()]
        if clean_params:
            components = [{
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in clean_params],
            }]
            template_obj["components"] = components

    print(f"[WORKFLOW-DEBUG] Sending template '{template_name}' to {normalize_phone(phone)[-4:]}")
    print(f"[WORKFLOW-DEBUG] Params: {parameters}")
    print(f"[WORKFLOW-DEBUG] Template payload: {json.dumps(template_obj, ensure_ascii=False)}")

    try:
        full_payload = {
            "messaging_product": "whatsapp",
            "to": normalize_phone(phone),
            "type": "template",
            "template": template_obj,
        }
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"https://graph.facebook.com/{api_version}/{phone_id}/messages",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=full_payload,
            )
            data = resp.json()
            print(f"[WORKFLOW-DEBUG] Meta response: HTTP {resp.status_code} | {json.dumps(data, ensure_ascii=False)[:300]}")
            if resp.status_code == 200 and "messages" in data:
                # Increment tenant messages_used (count as system message)
                try:
                    if db:
                        tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
                        if tenant:
                            tenant.messages_used = (tenant.messages_used or 0) + 1
                            db.commit()
                except Exception:
                    pass
                return True
            else:
                error_msg = data.get("error", {}).get("message", str(data)[:100])
                print(f"[WORKFLOW] Template send failed: {error_msg}")
                return False
    except Exception as e:
        print(f"[WORKFLOW] Template send error: {e}")
        return False


def _was_already_executed(db, workflow_id, client_id=None, appointment_id=None, today_only=True):
    """Check if this workflow was already executed for this client/appointment."""
    q = db.query(WorkflowExecution).filter(
        WorkflowExecution.workflow_id == workflow_id,
    )
    if client_id:
        q = q.filter(WorkflowExecution.client_id == client_id)
    if appointment_id:
        q = q.filter(WorkflowExecution.appointment_id == appointment_id)
    if today_only:
        today_start = datetime.combine(_now_colombia().date(), datetime.min.time())
        q = q.filter(WorkflowExecution.created_at >= today_start)
    return q.first() is not None


def _render_message(template, **kwargs):
    """Replace {{placeholders}} in message template."""
    msg = template
    for key, value in kwargs.items():
        msg = msg.replace("{{" + key + "}}", str(value) if value else "")
    return msg


def _prepend_intro_if_first_contact(db, msg, client, phone, tenant_name):
    """If this is the first ever message to this client, prepend 'Soy Lina de {negocio}'.
    Checks if there are any prior WhatsApp messages in their conversation."""
    if not phone:
        return msg
    conv = _find_conv_by_phone(db, phone)
    if conv:
        prev_count = db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv.id).count()
        if prev_count > 0:
            return msg  # Not first contact
    # First contact — add introduction
    client_first = (client.name or "").split()[0] if client else ""
    intro = f"Hola {client_first}! Soy Lina de {tenant_name} 👋\n\n"
    return intro + msg


def _send_and_log(db, workflow, client, phone, message, appointment_id=None):
    """Send WhatsApp message and log the execution.
    Uses template if configured, otherwise text (only within 24h window).
    Auto-prepends intro if first contact with client."""
    from scheduler import _send_whatsapp_sync, _store_outbound_message, _create_conversation_for_client, _conv_rate_limited

    conv = _find_conv_by_phone(db, phone, tenant_id=workflow.tenant_id)

    # Global rate limit — prevent spam (max 3/hour, 6/day per conversation)
    if conv and _conv_rate_limited(db, conv.id):
        return False

    # Auto-introduce on first contact
    tenant = db.query(Tenant).filter(Tenant.id == workflow.tenant_id).first()
    tenant_name = tenant.name if tenant else ""
    if conv:
        prev_count = db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv.id).count()
        if prev_count == 0 and client:
            client_first = (client.name or "").split()[0]
            message = f"Hola {client_first}! Soy Lina de {tenant_name} 👋\n\n" + message
    elif client:
        # No conversation yet — will create below, but message needs intro
        client_first = (client.name or "").split()[0]
        message = f"Hola {client_first}! Soy Lina de {tenant_name} 👋\n\n" + message

    config = workflow.config or {}
    template_name = config.get("template_name")
    template_lang = config.get("template_language", "es")

    # Build template parameters from the ALREADY RENDERED message
    # The 'message' param already has all {{variables}} replaced with real values.
    # We extract the values by comparing the original template with the rendered version.
    template_params = []
    if template_name:
        import re as _re
        # Get original template body with {{placeholders}}
        original_body = workflow.message_template or ""
        if original_body:
            # Find variable names in order
            var_names = _re.findall(r'\{\{(\w+)\}\}', original_body)
            if var_names:
                # Build a regex from the template that captures each variable's value
                # e.g. "Hola {{nombre}}, tu cita es a las {{hora}}" becomes
                # "Hola (.+?), tu cita es a las (.+?)"
                regex_pattern = _re.escape(original_body)
                for vn in var_names:
                    regex_pattern = regex_pattern.replace(_re.escape("{{" + vn + "}}"), "(.+?)", 1)
                regex_pattern += "$"
                # Strip the intro prefix if it was added
                clean_msg = message
                if "👋\n\n" in clean_msg:
                    clean_msg = clean_msg.split("👋\n\n", 1)[-1]
                match = _re.match(regex_pattern, clean_msg, _re.DOTALL)
                if match:
                    template_params = list(match.groups())
                    print(f"[WORKFLOW] Template {template_name}: extracted params {dict(zip(var_names, template_params))}")
                else:
                    # Fallback: use known variable values
                    client_first = (client.name or "").split()[0] if client else ""
                    fallback = {
                        "nombre": client_first, "negocio": tenant_name, "servicio": "tu servicio",
                        "profesional": "tu profesional", "hora": "", "fecha": "", "dias": "",
                    }
                    template_params = [fallback.get(v, v) for v in var_names]
                    print(f"[WORKFLOW] Template {template_name}: fallback params {dict(zip(var_names, template_params))}")

    # FIRST check if we can actually send — BEFORE creating any conversation
    can_send_template = bool(template_name)
    can_send_freetext = conv and _is_within_24h_window(db, conv)

    if not can_send_template and not can_send_freetext:
        # Nothing to send — DO NOT create conversation
        client_name = (client.name or "").split()[0] if client else "?"
        print(f"[WORKFLOW] Skipped {workflow.workflow_type} for {client_name}: no template and outside 24h window")
        log_event(
            "sistema",
            f"Workflow '{workflow.name}' omitido para {client_name}",
            detail=f"Sin plantilla Meta aprobada y fuera de ventana 24h.",
            status="warning",
        )
        return False

    # Final pass: resolve any remaining {{variables}} that weren't replaced
    import re as _re2
    remaining_vars = _re2.findall(r'\{\{(\w+)\}\}', message)
    if remaining_vars:
        client_first = (client.name or "").split()[0] if client else ""
        fallback_values = {
            "nombre": client_first, "negocio": tenant_name or "nuestro negocio",
            "servicio": "tu servicio", "profesional": "tu profesional",
            "hora": "", "fecha": "", "dias": "", "descuento": "",
        }
        for var in remaining_vars:
            val = fallback_values.get(var, "")
            if val:
                message = message.replace("{{" + var + "}}", val)
            else:
                message = message.replace("{{" + var + "}}", "")

    # NOW we know we'll send — create conversation if needed
    if not conv and client and client.phone:
        conv = _create_conversation_for_client(db, client)

    # Send
    wa_sent = False
    print(f"[WORKFLOW-DEBUG] _send_and_log: type={workflow.workflow_type} template={template_name} params={template_params} can_template={can_send_template} can_freetext={can_send_freetext}")
    print(f"[WORKFLOW-DEBUG] Message preview: {message[:150]}")
    if can_send_template:
        wa_sent = _send_template_sync(phone, template_name, template_lang, template_params, db=db)
        if not wa_sent and can_send_freetext:
            # Template failed — fallback to freetext within 24h window
            print(f"[WORKFLOW] Template failed, falling back to freetext for {(client.name or '?').split()[0]}")
            wa_sent = _send_whatsapp_sync(phone, message, db=db)
    elif can_send_freetext:
        wa_sent = _send_whatsapp_sync(phone, message, db=db)

    # Store in conversation thread (once only)
    if conv:
        tag = f"workflow_{workflow.workflow_type}_{workflow.id}"
        if appointment_id:
            tag += f"_appt_{appointment_id}"
        _store_outbound_message(db, conv.id, message, wa_sent, tag=tag)

    # Log execution
    execution = WorkflowExecution(
        workflow_id=workflow.id,
        tenant_id=workflow.tenant_id,
        client_id=client.id if client else None,
        appointment_id=appointment_id,
        phone=phone,
        message_sent=message,
        status="sent" if wa_sent else "failed",
    )
    db.add(execution)

    # Update workflow stats
    workflow.stats_sent = (workflow.stats_sent or 0) + 1
    workflow.last_triggered_at = datetime.utcnow()
    db.commit()

    client_name = (client.name or "").split()[0] if client else "?"
    log_event(
        "tarea",
        f"Workflow '{workflow.name}' → {client_name}",
        detail=message[:100],
        contact_name=client_name,
        conv_id=conv.id if conv else None,
        status="ok" if wa_sent else "error",
    )

    return wa_sent


# ════════════════════════════════════════════════════════════════
# WORKFLOW EXECUTORS — One function per workflow_type
# ════════════════════════════════════════════════════════════════

def execute_reminder_24h(db, workflow, tenant):
    """Send reminder 24 hours before appointment."""
    now = _now_colombia()
    tomorrow = now.date() + timedelta(days=1)

    appointments = (
        db.query(Appointment)
        .filter(Appointment.date == tomorrow, Appointment.status == "confirmed")
        .all()
    )

    for appt in appointments:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        staff = db.query(Staff).filter(Staff.id == appt.staff_id).first()
        service = db.query(Service).filter(Service.id == appt.service_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            hora=appt.time,
            profesional=staff.name.split()[0] if staff else "",
            servicio=service.name if service else "tu servicio",
            negocio=tenant.name,
            fecha=f"{tomorrow.day}/{tomorrow.month}",
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_reminder_1h(db, workflow, tenant):
    """Send reminder 1 hour before appointment."""
    now = _now_colombia()
    today = now.date()

    appointments = (
        db.query(Appointment)
        .filter(Appointment.date == today, Appointment.status == "confirmed")
        .all()
    )

    for appt in appointments:
        try:
            hour, minute = map(int, appt.time.split(":"))
            appt_dt = datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute))
        except (ValueError, AttributeError):
            continue

        diff_min = (appt_dt - now).total_seconds() / 60
        if not (55 <= diff_min <= 65):
            continue

        if _was_already_executed(db, workflow.id, appointment_id=appt.id):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        staff = db.query(Staff).filter(Staff.id == appt.staff_id).first()
        service = db.query(Service).filter(Service.id == appt.service_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            hora=appt.time,
            profesional=staff.name.split()[0] if staff else "",
            servicio=service.name if service else "tu servicio",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_post_visit(db, workflow, tenant):
    """Send follow-up message after a visit is completed."""
    now_utc = datetime.utcnow()
    delay_hours = (workflow.config or {}).get("delay_hours", 2)

    # Find visits completed in the last 3 hours that are past the delay window
    window_start = now_utc - timedelta(hours=delay_hours + 1)
    window_end = now_utc - timedelta(hours=delay_hours)

    # Check appointments that were recently marked completed
    today = _now_colombia().date()
    completed = (
        db.query(Appointment)
        .filter(
            Appointment.date == today,
            Appointment.status == "completed",
            Appointment.updated_at >= window_start,
            Appointment.updated_at <= window_end,
        )
        .all()
    )

    for appt in completed:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        service = db.query(Service).filter(Service.id == appt.service_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            servicio=service.name if service else "tu servicio",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_birthday(db, workflow, tenant):
    """Send birthday greetings."""
    now = _now_colombia()
    send_hour = (workflow.config or {}).get("send_hour", 9)

    # Only send within the target hour window
    if now.hour != send_hour:
        return

    today = now.date()

    # Find clients with birthday today (match month and day)
    clients = db.query(Client).filter(
        Client.birthday.isnot(None),
        Client.is_active == True,
        Client.accepts_whatsapp == True,
    ).all()

    for client in clients:
        if not client.birthday:
            continue
        if client.birthday.month != today.month or client.birthday.day != today.day:
            continue

        if _was_already_executed(db, workflow.id, client_id=client.id):
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )

        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(2)


def execute_reactivation(db, workflow, tenant):
    """Send re-engagement message to inactive clients."""
    now = _now_colombia()

    # Only run once per day at 10 AM
    if now.hour != 10:
        return

    config = workflow.config or {}
    days_threshold = config.get("days", 30)
    cutoff_date = now.date() - timedelta(days=days_threshold)

    # Find clients whose last visit was before the cutoff
    from sqlalchemy import func as sqlfunc
    clients_with_visits = (
        db.query(
            Client,
            sqlfunc.max(VisitHistory.visit_date).label("last_visit")
        )
        .join(VisitHistory, VisitHistory.client_id == Client.id)
        .filter(
            Client.is_active == True,
            Client.accepts_whatsapp == True,
            VisitHistory.status == "completed",
        )
        .group_by(Client.id)
        .having(sqlfunc.max(VisitHistory.visit_date) <= cutoff_date)
        .having(sqlfunc.max(VisitHistory.visit_date) >= cutoff_date - timedelta(days=7))  # Only clients in the window
        .limit(10)  # Max 10 per day to avoid spam
        .all()
    )

    for client, last_visit in clients_with_visits:
        if _was_already_executed(db, workflow.id, client_id=client.id, today_only=False):
            # Check if we sent in the last 7 days (avoid re-spamming)
            week_ago = datetime.utcnow() - timedelta(days=7)
            recent = db.query(WorkflowExecution).filter(
                WorkflowExecution.workflow_id == workflow.id,
                WorkflowExecution.client_id == client.id,
                WorkflowExecution.created_at >= week_ago,
            ).first()
            if recent:
                continue

        days_since = (now.date() - last_visit).days if last_visit else days_threshold

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
            dias=str(days_since),
        )

        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(3)


def execute_reactivation_60d(db, workflow, tenant):
    """Re-engage clients inactive for 60 days with a surprise offer."""
    now = _now_colombia()
    if now.hour != 10:
        return

    config = workflow.config or {}
    days_threshold = config.get("days", 60)
    cutoff_date = now.date() - timedelta(days=days_threshold)
    window_end = cutoff_date - timedelta(days=7)

    from sqlalchemy import func as sqlfunc
    candidates = (
        db.query(Client, sqlfunc.max(VisitHistory.visit_date).label("last_visit"))
        .join(VisitHistory, VisitHistory.client_id == Client.id)
        .filter(
            Client.is_active == True, Client.accepts_whatsapp == True,
            Client.tenant_id == tenant.id,
            VisitHistory.status == "completed",
        )
        .group_by(Client.id)
        .having(sqlfunc.max(VisitHistory.visit_date) <= cutoff_date)
        .having(sqlfunc.max(VisitHistory.visit_date) >= window_end)
        .limit(10)
        .all()
    )

    for client, last_visit in candidates:
        week_ago = datetime.utcnow() - timedelta(days=14)
        recent = db.query(WorkflowExecution).filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.client_id == client.id,
            WorkflowExecution.created_at >= week_ago,
        ).first()
        if recent:
            continue

        days_since = (now.date() - last_visit).days if last_visit else days_threshold
        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
            dias=str(days_since),
        )
        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(3)


def execute_reactivation_90d(db, workflow, tenant):
    """Last chance — 90 days inactive, offer exclusive discount."""
    now = _now_colombia()
    if now.hour != 10:
        return

    config = workflow.config or {}
    days_threshold = config.get("days", 90)
    cutoff_date = now.date() - timedelta(days=days_threshold)
    window_end = cutoff_date - timedelta(days=7)

    from sqlalchemy import func as sqlfunc
    candidates = (
        db.query(Client, sqlfunc.max(VisitHistory.visit_date).label("last_visit"))
        .join(VisitHistory, VisitHistory.client_id == Client.id)
        .filter(
            Client.is_active == True, Client.accepts_whatsapp == True,
            Client.tenant_id == tenant.id,
            VisitHistory.status == "completed",
        )
        .group_by(Client.id)
        .having(sqlfunc.max(VisitHistory.visit_date) <= cutoff_date)
        .having(sqlfunc.max(VisitHistory.visit_date) >= window_end)
        .limit(5)
        .all()
    )

    for client, last_visit in candidates:
        month_ago = datetime.utcnow() - timedelta(days=30)
        recent = db.query(WorkflowExecution).filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.client_id == client.id,
            WorkflowExecution.created_at >= month_ago,
        ).first()
        if recent:
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )
        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(3)


def execute_rebooking_cycle(db, workflow, tenant):
    """Suggest rebooking based on client's average visit cycle."""
    now = _now_colombia()
    if now.hour != 10:
        return

    from sqlalchemy import func as sqlfunc

    # Find clients with at least 3 visits to calculate cycle
    clients_data = (
        db.query(
            Client,
            sqlfunc.count(VisitHistory.id).label("visit_count"),
            sqlfunc.max(VisitHistory.visit_date).label("last_visit"),
            sqlfunc.min(VisitHistory.visit_date).label("first_visit"),
        )
        .join(VisitHistory, VisitHistory.client_id == Client.id)
        .filter(
            Client.is_active == True, Client.accepts_whatsapp == True,
            Client.tenant_id == tenant.id,
            VisitHistory.status == "completed",
        )
        .group_by(Client.id)
        .having(sqlfunc.count(VisitHistory.id) >= 3)
        .limit(10)
        .all()
    )

    for client, visit_count, last_visit, first_visit in clients_data:
        if not last_visit or not first_visit:
            continue

        # Calculate average cycle
        total_days = (last_visit - first_visit).days
        avg_cycle = total_days / (visit_count - 1) if visit_count > 1 else 30
        days_since = (now.date() - last_visit).days

        # Only trigger if overdue by 3+ days
        if days_since < avg_cycle + 3:
            continue

        week_ago = datetime.utcnow() - timedelta(days=7)
        recent = db.query(WorkflowExecution).filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.client_id == client.id,
            WorkflowExecution.created_at >= week_ago,
        ).first()
        if recent:
            continue

        # Find their most common service
        fav_service = (
            db.query(Service.name)
            .join(Appointment, Appointment.service_id == Service.id)
            .filter(Appointment.client_id == client.id)
            .group_by(Service.name)
            .order_by(sqlfunc.count(Appointment.id).desc())
            .first()
        )

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            servicio=fav_service[0] if fav_service else "tu servicio",
            negocio=tenant.name,
        )
        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(3)


def execute_winback_discount(db, workflow, tenant):
    """Win-back with discount — 120+ days inactive."""
    now = _now_colombia()
    if now.hour != 10:
        return

    cutoff_date = now.date() - timedelta(days=120)

    from sqlalchemy import func as sqlfunc
    candidates = (
        db.query(Client, sqlfunc.max(VisitHistory.visit_date).label("last_visit"))
        .join(VisitHistory, VisitHistory.client_id == Client.id)
        .filter(
            Client.is_active == True, Client.accepts_whatsapp == True,
            Client.tenant_id == tenant.id,
            VisitHistory.status == "completed",
        )
        .group_by(Client.id)
        .having(sqlfunc.max(VisitHistory.visit_date) <= cutoff_date)
        .limit(5)
        .all()
    )

    for client, last_visit in candidates:
        month_ago = datetime.utcnow() - timedelta(days=30)
        recent = db.query(WorkflowExecution).filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.client_id == client.id,
            WorkflowExecution.created_at >= month_ago,
        ).first()
        if recent:
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )
        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(3)


def execute_no_show_followup(db, workflow, tenant):
    """Send follow-up to clients who no-showed yesterday."""
    now = _now_colombia()

    # Only run at 10 AM
    if now.hour != 10:
        return

    yesterday = now.date() - timedelta(days=1)

    no_shows = (
        db.query(Appointment)
        .filter(
            Appointment.date == yesterday,
            Appointment.status == "no_show",
        )
        .all()
    )

    for appt in no_shows:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        service = db.query(Service).filter(Service.id == appt.service_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            servicio=service.name if service else "tu servicio",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_welcome(db, workflow, tenant):
    """Send welcome message to new clients (created in last 2 hours)."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(hours=2, minutes=10)
    window_end = now_utc - timedelta(minutes=5)  # 5 min buffer

    new_clients = (
        db.query(Client)
        .filter(
            Client.created_at >= window_start,
            Client.created_at <= window_end,
            Client.is_active == True,
            Client.accepts_whatsapp == True,
        )
        .all()
    )

    for client in new_clients:
        if _was_already_executed(db, workflow.id, client_id=client.id, today_only=False):
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )

        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(2)


def execute_auto_vip(db, workflow, tenant):
    """Auto-tag clients as VIP when they reach visit threshold. Optionally notify."""
    config = workflow.config or {}
    threshold = config.get("visits_threshold", 10)
    auto_tag = config.get("auto_tag", "VIP")

    # Find clients with enough visits who aren't already VIP
    from sqlalchemy import func as sqlfunc
    candidates = (
        db.query(Client, sqlfunc.count(VisitHistory.id).label("visit_count"))
        .join(VisitHistory, VisitHistory.client_id == Client.id)
        .filter(
            Client.is_active == True,
            VisitHistory.status == "completed",
        )
        .group_by(Client.id)
        .having(sqlfunc.count(VisitHistory.id) >= threshold)
        .all()
    )

    for client, visit_count in candidates:
        # Check if already tagged
        tags = client.tags or []
        if auto_tag in tags:
            continue

        if _was_already_executed(db, workflow.id, client_id=client.id, today_only=False):
            continue

        # Auto-tag in CRM
        tags.append(auto_tag)
        client.tags = tags
        if not client.status_override or client.status_override != "vip":
            client.status_override = "vip"
        db.commit()

        # Send WhatsApp notification if channel includes whatsapp
        channel = config.get("channel", "crm")
        if "whatsapp" in channel and client.phone and client.accepts_whatsapp:
            msg = _render_message(
                workflow.message_template,
                nombre=client.name.split()[0] if client.name else "",
                negocio=tenant.name,
            )
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(2)
        else:
            # Just log the CRM action
            execution = WorkflowExecution(
                workflow_id=workflow.id,
                tenant_id=workflow.tenant_id,
                client_id=client.id,
                phone=client.phone or "",
                message_sent=f"Auto-tagged as {auto_tag} (visit #{visit_count})",
                status="sent",
            )
            db.add(execution)
            workflow.stats_sent = (workflow.stats_sent or 0) + 1
            workflow.last_triggered_at = datetime.utcnow()
            db.commit()

            log_event(
                "sistema",
                f"Auto-VIP: {client.name}",
                detail=f"Etiquetado como {auto_tag} ({visit_count} visitas)",
                contact_name=client.name.split()[0] if client.name else "",
                status="ok",
            )


def execute_anniversary(db, workflow, tenant):
    """Celebrate client's anniversary (1 year since first visit)."""
    now = _now_colombia()
    if now.hour != 9:
        return

    today = now.date()
    one_year_ago = date(today.year - 1, today.month, today.day)

    from sqlalchemy import func as sqlfunc
    # Find clients whose first visit was exactly 1 year ago (within 1 day)
    candidates = (
        db.query(Client, sqlfunc.min(VisitHistory.visit_date).label("first_visit"))
        .join(VisitHistory, VisitHistory.client_id == Client.id)
        .filter(
            Client.is_active == True, Client.accepts_whatsapp == True,
            Client.tenant_id == tenant.id,
            VisitHistory.status == "completed",
        )
        .group_by(Client.id)
        .having(sqlfunc.min(VisitHistory.visit_date) == one_year_ago)
        .all()
    )

    for client, first_visit in candidates:
        if _was_already_executed(db, workflow.id, client_id=client.id, today_only=False):
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )
        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(2)


def execute_referral_thanks(db, workflow, tenant):
    """Thank client when someone visits from their referral.
    Detects clients with 'referido' tag added in last 5 min."""
    # This is event-driven — for now, check recently tagged clients
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(minutes=10)

    from database.models import ClientNote
    # Look for notes mentioning referral in last 10 min
    referral_notes = (
        db.query(ClientNote)
        .filter(
            ClientNote.tenant_id == tenant.id,
            ClientNote.created_at >= window_start,
            ClientNote.content.ilike("%referid%"),
        )
        .all()
    )

    for note in referral_notes:
        # The referrer is the client in the note
        client = db.query(Client).filter(Client.id == note.client_id).first()
        if not client or not client.phone or client.accepts_whatsapp is False:
            continue

        if _was_already_executed(db, workflow.id, client_id=client.id):
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )
        _send_and_log(db, workflow, client, client.phone, msg)
        time.sleep(2)


def execute_visit_milestone(db, workflow, tenant):
    """Celebrate when client reaches a visit milestone (5, 10, 25, 50)."""
    now = _now_colombia()
    if now.hour != 10:
        return

    milestones = [5, 10, 25, 50, 100]

    from sqlalchemy import func as sqlfunc
    clients_data = (
        db.query(Client, sqlfunc.count(VisitHistory.id).label("visit_count"))
        .join(VisitHistory, VisitHistory.client_id == Client.id)
        .filter(
            Client.is_active == True, Client.accepts_whatsapp == True,
            Client.tenant_id == tenant.id,
            VisitHistory.status == "completed",
        )
        .group_by(Client.id)
        .having(sqlfunc.count(VisitHistory.id).in_(milestones))
        .all()
    )

    for client, visit_count in clients_data:
        if _was_already_executed(db, workflow.id, client_id=client.id, today_only=False):
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            visitas=str(visit_count),
            negocio=tenant.name,
        )
        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(2)


def execute_pre_birthday(db, workflow, tenant):
    """Send pre-birthday teaser 3 days before birthday."""
    now = _now_colombia()
    if now.hour != 9:
        return

    target = now.date() + timedelta(days=3)

    clients = db.query(Client).filter(
        Client.birthday.isnot(None),
        Client.is_active == True, Client.accepts_whatsapp == True,
        Client.tenant_id == tenant.id,
    ).all()

    for client in clients:
        if not client.birthday:
            continue
        if client.birthday.month != target.month or client.birthday.day != target.day:
            continue
        if _was_already_executed(db, workflow.id, client_id=client.id):
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )
        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(2)


def execute_birthday_reminder_use(db, workflow, tenant):
    """Remind client to use birthday discount — 5 days after birthday."""
    now = _now_colombia()
    if now.hour != 10:
        return

    target = now.date() - timedelta(days=5)

    clients = db.query(Client).filter(
        Client.birthday.isnot(None),
        Client.is_active == True, Client.accepts_whatsapp == True,
        Client.tenant_id == tenant.id,
    ).all()

    for client in clients:
        if not client.birthday:
            continue
        if client.birthday.month != target.month or client.birthday.day != target.day:
            continue
        if _was_already_executed(db, workflow.id, client_id=client.id, today_only=False):
            continue

        # Check if they already visited since birthday
        birthday_this_year = date(now.date().year, client.birthday.month, client.birthday.day)
        visited_since = db.query(VisitHistory).filter(
            VisitHistory.client_id == client.id,
            VisitHistory.visit_date >= birthday_this_year,
        ).first()
        if visited_since:
            continue  # Already used their discount

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )
        if client.phone:
            _send_and_log(db, workflow, client, client.phone, msg)
            time.sleep(2)


def execute_payment_confirmed(db, workflow, tenant):
    """Send payment confirmation when appointment is marked as paid (last 5 min)."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(minutes=5)

    paid = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "paid",
            Appointment.updated_at >= window_start,
        )
        .all()
    )

    for appt in paid:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id, today_only=False):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            monto=f"{appt.price:,.0f}".replace(",", ".") if appt.price else "0",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_payment_reminder(db, workflow, tenant):
    """Remind about pending payment — 24h after completed but unpaid service."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(hours=25)
    window_end = now_utc - timedelta(hours=23)

    unpaid = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "completed",  # completed but NOT paid
            Appointment.updated_at >= window_start,
            Appointment.updated_at <= window_end,
        )
        .all()
    )

    for appt in unpaid:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id, today_only=False):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        service = db.query(Service).filter(Service.id == appt.service_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            monto=f"{appt.price:,.0f}".replace(",", ".") if appt.price else "0",
            servicio=service.name if service else "tu servicio",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_digital_receipt(db, workflow, tenant):
    """Send digital receipt immediately after payment (last 5 min)."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(minutes=5)

    paid = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status == "paid",
            Appointment.updated_at >= window_start,
        )
        .all()
    )

    for appt in paid:
        tag = f"receipt_{appt.id}"
        existing = db.query(WorkflowExecution).filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.appointment_id == appt.id,
        ).first()
        if existing:
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        service = db.query(Service).filter(Service.id == appt.service_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            servicio=service.name if service else "Servicio",
            monto=f"{appt.price:,.0f}".replace(",", ".") if appt.price else "0",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_daily_summary(db, workflow, tenant):
    """Send daily business summary to owner via WhatsApp."""
    now = _now_colombia()
    config = workflow.config or {}
    send_hour = config.get("send_hour", 20)

    if now.hour != send_hour:
        return

    if _was_already_executed(db, workflow.id):
        return

    today = now.date()
    from sqlalchemy import func as sqlfunc

    # Gather stats
    completed = db.query(sqlfunc.count(Appointment.id)).filter(
        Appointment.date == today, Appointment.status.in_(["completed", "paid"])
    ).scalar() or 0

    no_shows = db.query(sqlfunc.count(Appointment.id)).filter(
        Appointment.date == today, Appointment.status == "no_show"
    ).scalar() or 0

    revenue = db.query(sqlfunc.sum(VisitHistory.amount)).filter(
        VisitHistory.visit_date == today, VisitHistory.status == "completed"
    ).scalar() or 0

    new_clients = db.query(sqlfunc.count(Client.id)).filter(
        Client.created_at >= datetime.combine(today, datetime.min.time())
    ).scalar() or 0

    msg = _render_message(
        workflow.message_template,
        negocio=tenant.name,
        citas_completadas=str(completed),
        no_shows=str(no_shows),
        ingresos=f"{revenue:,.0f}".replace(",", "."),
        nuevos=str(new_clients),
    )

    owner_phone = tenant.owner_phone
    if owner_phone:
        from scheduler import _send_whatsapp_sync
        wa_sent = _send_whatsapp_sync(owner_phone, msg, db=db)

        execution = WorkflowExecution(
            workflow_id=workflow.id,
            tenant_id=workflow.tenant_id,
            phone=owner_phone,
            message_sent=msg,
            status="sent" if wa_sent else "failed",
        )
        db.add(execution)
        workflow.stats_sent = (workflow.stats_sent or 0) + 1
        workflow.last_triggered_at = datetime.utcnow()
        db.commit()

        log_event(
            "sistema",
            f"Resumen diario enviado al dueño",
            detail=f"Completadas: {completed}, No-shows: {no_shows}, Ingresos: ${revenue:,.0f}",
            status="ok" if wa_sent else "error",
        )


def execute_confirmation(db, workflow, tenant):
    """Send confirmation when a new appointment is created (last 5 min)."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(minutes=5)

    # Find appointments created in the last 5 minutes
    recent = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.created_at >= window_start,
            Appointment.status.in_(["confirmed", "pending"]),
        )
        .all()
    )

    for appt in recent:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id, today_only=False):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        staff = db.query(Staff).filter(Staff.id == appt.staff_id).first()
        service = db.query(Service).filter(Service.id == appt.service_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            fecha=f"{appt.date.day}/{appt.date.month}",
            hora=appt.time,
            profesional=staff.name.split()[0] if staff else "",
            servicio=service.name if service else "tu servicio",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_reschedule(db, workflow, tenant):
    """Send notification when an appointment is rescheduled (updated in last 5 min)."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(minutes=5)

    # Find appointments updated recently that are still confirmed
    updated = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.updated_at >= window_start,
            Appointment.status == "confirmed",
        )
        .all()
    )

    for appt in updated:
        # Only trigger if updated_at != created_at (means it was modified, not just created)
        if appt.created_at and appt.updated_at:
            diff = (appt.updated_at - appt.created_at).total_seconds()
            if diff < 60:
                continue  # Just created, not rescheduled

        # Use a unique tag per reschedule (allow multiple reschedules)
        tag = f"reschedule_{appt.id}_{int(appt.updated_at.timestamp())}"
        existing = db.query(WorkflowExecution).filter(
            WorkflowExecution.workflow_id == workflow.id,
            WorkflowExecution.appointment_id == appt.id,
            WorkflowExecution.message_sent.contains(tag),
        ).first()
        if existing:
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        staff = db.query(Staff).filter(Staff.id == appt.staff_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            fecha=f"{appt.date.day}/{appt.date.month}",
            hora=appt.time,
            profesional=staff.name.split()[0] if staff else "",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_cancellation(db, workflow, tenant):
    """Send notification when an appointment is cancelled (last 5 min)."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(minutes=5)

    cancelled = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.updated_at >= window_start,
            Appointment.status == "cancelled",
        )
        .all()
    )

    for appt in cancelled:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id, today_only=False):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            fecha=f"{appt.date.day}/{appt.date.month}",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_rating_request(db, workflow, tenant):
    """Ask client how their visit went — 4 hours after service completed."""
    now_utc = datetime.utcnow()
    delay_hours = (workflow.config or {}).get("delay_hours", 4)
    window_start = now_utc - timedelta(hours=delay_hours + 1)
    window_end = now_utc - timedelta(hours=delay_hours)

    completed = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status.in_(["completed", "paid"]),
            Appointment.updated_at >= window_start,
            Appointment.updated_at <= window_end,
        )
        .all()
    )

    for appt in completed:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id, today_only=False):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        service = db.query(Service).filter(Service.id == appt.service_id).first()

        # Create ReviewRequest with unique token for rating landing page
        review_url = ""
        try:
            from routes.review_endpoints import create_review_request
            review_req = create_review_request(db, client_id=client.id if client else None, appointment_id=appt.id, tenant_id=tenant.id)
            if review_req and review_req.token:
                base_url = os.getenv("FRONTEND_URL", "https://plexifystudio-projects.github.io/AlPelo-CRM")
                review_url = f"\n\nCalifica tu experiencia: {base_url}/review.html?token={review_req.token}"
        except Exception as rev_err:
            print(f"[WORKFLOW] ReviewRequest error: {rev_err}")

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            servicio=service.name if service else "tu servicio",
            negocio=tenant.name,
        )
        msg += review_url

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_review_google(db, workflow, tenant):
    """Request Google review — triggered after a positive rating (future: detect from conversation).
    For now, runs 24h after completed visit if rating_request was sent successfully."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(hours=25)
    window_end = now_utc - timedelta(hours=23)

    # Find appointments that had a rating_request sent ~24h ago
    rating_execs = (
        db.query(WorkflowExecution)
        .join(WorkflowTemplate, WorkflowExecution.workflow_id == WorkflowTemplate.id)
        .filter(
            WorkflowTemplate.tenant_id == tenant.id,
            WorkflowTemplate.workflow_type == "rating_request",
            WorkflowExecution.status == "sent",
            WorkflowExecution.created_at >= window_start,
            WorkflowExecution.created_at <= window_end,
        )
        .all()
    )

    for ex in rating_execs:
        if not ex.client_id:
            continue
        if _was_already_executed(db, workflow.id, client_id=ex.client_id, today_only=False):
            continue

        client = db.query(Client).filter(Client.id == ex.client_id).first()
        if not client or not client.phone or client.accepts_whatsapp is False:
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=client.name.split()[0] if client.name else "",
            negocio=tenant.name,
        )

        _send_and_log(db, workflow, client, client.phone, msg)
        time.sleep(2)


def execute_post_care_tips(db, workflow, tenant):
    """Send care tips 1 hour after service completed."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(hours=1, minutes=10)
    window_end = now_utc - timedelta(minutes=50)

    completed = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status.in_(["completed", "paid"]),
            Appointment.updated_at >= window_start,
            Appointment.updated_at <= window_end,
        )
        .all()
    )

    for appt in completed:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id, today_only=False):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        service = db.query(Service).filter(Service.id == appt.service_id).first()

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            servicio=service.name if service else "tu servicio",
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_suggest_next_service(db, workflow, tenant):
    """Suggest next service based on history — 24h after visit."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(hours=25)
    window_end = now_utc - timedelta(hours=23)

    completed = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.status.in_(["completed", "paid"]),
            Appointment.updated_at >= window_start,
            Appointment.updated_at <= window_end,
        )
        .all()
    )

    for appt in completed:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id, today_only=False):
            continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        # Find a service the client hasn't tried
        service = db.query(Service).filter(Service.id == appt.service_id).first()
        client_service_ids = set()
        if client:
            past = db.query(Appointment.service_id).filter(
                Appointment.client_id == client.id,
                Appointment.status.in_(["completed", "paid"]),
            ).distinct().all()
            client_service_ids = {r[0] for r in past}

        suggested = (
            db.query(Service)
            .filter(
                Service.tenant_id == tenant.id,
                Service.is_active == True,
                ~Service.id.in_(client_service_ids) if client_service_ids else True,
            )
            .first()
        )

        suggested_name = suggested.name if suggested else (service.name if service else "nuestros servicios")

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            servicio_sugerido=suggested_name,
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_client_confirmed(db, workflow, tenant):
    """Send confirmation acknowledgment when client responds 'SI' to a reminder.
    Detects appointments that changed from 'pending' to 'confirmed' in last 5 min."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(minutes=5)

    # Find appointments recently confirmed (updated_at recent + status confirmed)
    # We check if there was a reminder sent before (reminder_24h or reminder_1h execution exists)
    confirmed = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant.id,
            Appointment.updated_at >= window_start,
            Appointment.status == "confirmed",
        )
        .all()
    )

    for appt in confirmed:
        if _was_already_executed(db, workflow.id, appointment_id=appt.id, today_only=False):
            continue

        # Only send if there was a prior reminder execution for this appointment
        prior_reminder = db.query(WorkflowExecution).filter(
            WorkflowExecution.appointment_id == appt.id,
            WorkflowExecution.status == "sent",
        ).first()
        if not prior_reminder:
            continue  # No reminder was sent, so this isn't a client confirmation response

        # Don't send if the confirmation was within 1 min of creation (it was created as confirmed)
        if appt.created_at and appt.updated_at:
            diff = (appt.updated_at - appt.created_at).total_seconds()
            if diff < 60:
                continue

        client = db.query(Client).filter(Client.id == appt.client_id).first() if appt.client_id else None
        if client and client.accepts_whatsapp is False:
            continue

        msg = _render_message(
            workflow.message_template,
            nombre=(client.name if client else appt.client_name or "").split()[0],
            fecha=f"{appt.date.day}/{appt.date.month}",
            hora=appt.time,
            negocio=tenant.name,
        )

        phone = client.phone if client else appt.client_phone
        if phone:
            _send_and_log(db, workflow, client, phone, msg, appointment_id=appt.id)
            time.sleep(2)


def execute_weekly_summary(db, workflow, tenant):
    """Send weekly business summary to owner — Monday at 9 AM."""
    now = _now_colombia()
    if now.weekday() != 0 or now.hour != 9:  # Monday, 9 AM
        return
    if _was_already_executed(db, workflow.id):
        return

    from sqlalchemy import func as sqlfunc
    last_week_start = now.date() - timedelta(days=7)
    last_week_end = now.date() - timedelta(days=1)

    total_citas = db.query(sqlfunc.count(Appointment.id)).filter(
        Appointment.tenant_id == tenant.id,
        Appointment.date >= last_week_start, Appointment.date <= last_week_end,
        Appointment.status.in_(["completed", "paid"]),
    ).scalar() or 0

    revenue = db.query(sqlfunc.sum(Appointment.price)).filter(
        Appointment.tenant_id == tenant.id,
        Appointment.date >= last_week_start, Appointment.date <= last_week_end,
        Appointment.status == "paid",
    ).scalar() or 0

    new_clients = db.query(sqlfunc.count(Client.id)).filter(
        Client.tenant_id == tenant.id,
        Client.created_at >= datetime.combine(last_week_start, datetime.min.time()),
    ).scalar() or 0

    msg = _render_message(
        workflow.message_template,
        negocio=tenant.name,
        total_citas=str(total_citas),
        ingresos=f"{revenue:,.0f}".replace(",", "."),
        nuevos=str(new_clients),
    )

    owner_phone = tenant.owner_phone
    if owner_phone:
        from scheduler import _send_whatsapp_sync
        wa_sent = _send_whatsapp_sync(owner_phone, msg, db=db)
        execution = WorkflowExecution(
            workflow_id=workflow.id, tenant_id=tenant.id,
            phone=owner_phone, message_sent=msg,
            status="sent" if wa_sent else "failed",
        )
        db.add(execution)
        workflow.stats_sent = (workflow.stats_sent or 0) + 1
        workflow.last_triggered_at = datetime.utcnow()
        db.commit()


def execute_noshow_alert(db, workflow, tenant):
    """Alert owner at end of day if there were no-shows."""
    now = _now_colombia()
    config = workflow.config or {}
    send_hour = config.get("send_hour", 20)
    if now.hour != send_hour:
        return
    if _was_already_executed(db, workflow.id):
        return

    from sqlalchemy import func as sqlfunc
    today = now.date()
    count = db.query(sqlfunc.count(Appointment.id)).filter(
        Appointment.tenant_id == tenant.id,
        Appointment.date == today, Appointment.status == "no_show",
    ).scalar() or 0

    if count == 0:
        return  # No no-shows, don't send

    msg = _render_message(
        workflow.message_template,
        negocio=tenant.name,
        cantidad=str(count),
    )

    owner_phone = tenant.owner_phone
    if owner_phone:
        from scheduler import _send_whatsapp_sync
        wa_sent = _send_whatsapp_sync(owner_phone, msg, db=db)
        execution = WorkflowExecution(
            workflow_id=workflow.id, tenant_id=tenant.id,
            phone=owner_phone, message_sent=msg,
            status="sent" if wa_sent else "failed",
        )
        db.add(execution)
        workflow.stats_sent = (workflow.stats_sent or 0) + 1
        workflow.last_triggered_at = datetime.utcnow()
        db.commit()


def execute_new_client_alert(db, workflow, tenant):
    """Alert owner when a new client is registered (last 5 min)."""
    now_utc = datetime.utcnow()
    window_start = now_utc - timedelta(minutes=5)

    new_clients = (
        db.query(Client)
        .filter(
            Client.tenant_id == tenant.id,
            Client.created_at >= window_start,
            Client.is_active == True,
        )
        .all()
    )

    for client in new_clients:
        if _was_already_executed(db, workflow.id, client_id=client.id, today_only=False):
            continue

        msg = _render_message(
            workflow.message_template,
            negocio=tenant.name,
            nombre=client.name or "Sin nombre",
            telefono=client.phone or "Sin telefono",
        )

        owner_phone = tenant.owner_phone
        if owner_phone:
            from scheduler import _send_whatsapp_sync
            wa_sent = _send_whatsapp_sync(owner_phone, msg, db=db)
            execution = WorkflowExecution(
                workflow_id=workflow.id, tenant_id=tenant.id,
                client_id=client.id, phone=owner_phone, message_sent=msg,
                status="sent" if wa_sent else "failed",
            )
            db.add(execution)
            workflow.stats_sent = (workflow.stats_sent or 0) + 1
            workflow.last_triggered_at = datetime.utcnow()
            db.commit()
            time.sleep(2)


# ════════════════════════════════════════════════════════════════
# MAIN DISPATCHER — Called by scheduler every cycle
# ════════════════════════════════════════════════════════════════

# Map workflow_type → executor function
_EXECUTORS = {
    # Citas
    "confirmation": execute_confirmation,
    "reminder_24h": execute_reminder_24h,
    "reminder_1h": execute_reminder_1h,
    "reschedule": execute_reschedule,
    "cancellation": execute_cancellation,
    "client_confirmed": execute_client_confirmed,
    # Post-visita
    "post_visit": execute_post_visit,
    "post_visit_thanks": execute_post_visit,  # alias — 2h after service
    "rating_request": execute_rating_request,  # 4h after service
    "review_google": execute_review_google,  # 24h after rating sent
    "post_care_tips": execute_post_care_tips,  # 1h after service
    "suggest_next_service": execute_suggest_next_service,  # 24h after visit
    # Retención
    "reactivation": execute_reactivation,
    "reactivation_30d": execute_reactivation,  # alias — uses config.days
    "reactivation_60d": execute_reactivation_60d,
    "reactivation_90d": execute_reactivation_90d,
    "no_show_followup": execute_no_show_followup,
    "rebooking_cycle": execute_rebooking_cycle,
    "winback_discount": execute_winback_discount,
    # Fidelización
    "welcome": execute_welcome,
    "auto_vip": execute_auto_vip,
    "anniversary": execute_anniversary,
    "referral_thanks": execute_referral_thanks,
    "visit_milestone": execute_visit_milestone,
    # Cumpleaños
    "birthday": execute_birthday,
    "pre_birthday": execute_pre_birthday,
    "birthday_reminder_use": execute_birthday_reminder_use,
    # Marketing — these are manually triggered or scheduled, not event-driven
    "promo_weekly": None,  # Admin triggers manually from Campaigns
    "new_service": None,  # Admin triggers manually
    "flash_sale": None,  # Admin triggers manually
    "bring_friend": None,  # Admin triggers manually
    "combo_special": None,  # Admin triggers manually
    "seasonal_promo": None,  # Admin triggers manually
    # Pagos
    "payment_confirmed": execute_payment_confirmed,
    "payment_reminder": execute_payment_reminder,
    "digital_receipt": execute_digital_receipt,
    # Operativo
    "daily_summary": execute_daily_summary,
    "weekly_summary": execute_weekly_summary,
    "noshow_alert": execute_noshow_alert,
    "new_client_alert": execute_new_client_alert,
    # Disponibilidad
    "waitlist_available": None,  # Event-driven — triggered when cancellation frees a slot
    "special_hours": None,  # Admin triggers manually
}


def run_workflows(db):
    """Execute all enabled workflows for all active tenants.
    Called by the scheduler every 2 minutes during business hours."""

    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()

    for tenant in tenants:
        if tenant.ai_is_paused:
            continue

        workflows = (
            db.query(WorkflowTemplate)
            .filter(
                WorkflowTemplate.tenant_id == tenant.id,
                WorkflowTemplate.is_enabled == True,
            )
            .all()
        )

        for wf in workflows:
            executor = _EXECUTORS.get(wf.workflow_type)
            if not executor:
                continue

            try:
                executor(db, wf, tenant)
            except Exception as e:
                print(f"[WORKFLOW] Error executing {wf.workflow_type} for tenant {tenant.slug}: {e}")
