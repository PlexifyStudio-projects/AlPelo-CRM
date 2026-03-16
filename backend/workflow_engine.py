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
import httpx
from datetime import datetime, date, timedelta

from database.connection import SessionLocal
from database.models import (
    WorkflowTemplate, WorkflowExecution, Tenant, Client,
    Appointment, VisitHistory, Staff, Service,
    WhatsAppConversation, WhatsAppMessage,
)
from routes._helpers import normalize_phone, now_colombia as _now_colombia
from activity_log import log_event

WA_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")


def _find_conv_by_phone(db, phone):
    """Find WhatsApp conversation by phone number."""
    if not phone:
        return None
    tail = phone[-10:]
    return (
        db.query(WhatsAppConversation)
        .filter(WhatsAppConversation.wa_contact_phone.contains(tail))
        .first()
    )


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


def _send_template_sync(phone, template_name, language_code="es", parameters=None):
    """Send an approved WhatsApp template message synchronously.
    Parameters is a list of strings for the template body variables."""
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "") or WA_TOKEN
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "") or WA_PHONE_ID
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
        components = [{
            "type": "body",
            "parameters": [{"type": "text", "text": str(p)} for p in parameters],
        }]
        template_obj["components"] = components

    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"https://graph.facebook.com/{api_version}/{phone_id}/messages",
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


def _send_and_log(db, workflow, client, phone, message, appointment_id=None):
    """Send WhatsApp message and log the execution.
    Uses template if configured, otherwise text (only within 24h window)."""
    from scheduler import _send_whatsapp_sync, _store_outbound_message

    conv = _find_conv_by_phone(db, phone)
    config = workflow.config or {}
    template_name = config.get("template_name")
    template_lang = config.get("template_language", "es")
    template_params = config.get("template_params", [])

    # Decide: template or free-text?
    if template_name:
        # Use approved template (works always, even outside 24h window)
        # Replace param placeholders with actual values from the rendered message
        wa_sent = _send_template_sync(phone, template_name, template_lang, template_params)
    elif conv and _is_within_24h_window(db, conv):
        # Client messaged recently — free text is OK
        wa_sent = _send_whatsapp_sync(phone, message)
    else:
        # No template configured AND outside 24h window — skip with warning
        print(f"[WORKFLOW] Skipped {workflow.workflow_type} for {phone[-4:]}: no template and outside 24h window")
        log_event(
            "sistema",
            f"Workflow '{workflow.name}' omitido — sin plantilla configurada",
            detail=f"El cliente no ha escrito en 24h. Configura una plantilla aprobada de Meta para enviar este workflow.",
            status="warning",
        )
        return False

    # Store in conversation thread if conversation exists
    if conv:
        tag = f"workflow_{workflow.workflow_type}_{workflow.id}"
        if appointment_id:
            tag += f"_appt_{appointment_id}"
        _store_outbound_message(db, conv.id, message, wa_sent, tag=tag)
    elif not conv and wa_sent:
        # Template was sent but no conversation existed — it'll be created when client responds
        pass

    wa_sent = wa_sent if wa_sent is not None else False

    # Store in WhatsApp messages for conversation thread
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
        conv_id=conv.id,
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
        if client and not client.accepts_whatsapp:
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
        if client and not client.accepts_whatsapp:
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
        if client and not client.accepts_whatsapp:
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
        if client and not client.accepts_whatsapp:
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
        Appointment.date == today, Appointment.status == "completed"
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
        wa_sent = _send_whatsapp_sync(owner_phone, msg)

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


# ════════════════════════════════════════════════════════════════
# MAIN DISPATCHER — Called by scheduler every cycle
# ════════════════════════════════════════════════════════════════

# Map workflow_type → executor function
_EXECUTORS = {
    "reminder_24h": execute_reminder_24h,
    "reminder_1h": execute_reminder_1h,
    "post_visit": execute_post_visit,
    "birthday": execute_birthday,
    "reactivation": execute_reactivation,
    "no_show_followup": execute_no_show_followup,
    "welcome": execute_welcome,
    "auto_vip": execute_auto_vip,
    "review_request": None,  # Handled by review pipeline, not scheduler
    "daily_summary": execute_daily_summary,
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
