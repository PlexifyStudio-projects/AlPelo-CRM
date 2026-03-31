"""Scheduler helpers — WA send, store msg, dedup, rate limit, phone match.
Extracted from scheduler.py Phase 8."""
import os, httpx, json
from datetime import datetime, timedelta, date
from database.connection import SessionLocal
from database.models import Tenant, WhatsAppConversation, WhatsAppMessage, Client
from routes._helpers import normalize_phone, now_colombia as _now_colombia

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
_DAYS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
_DIAS_ES = _DAYS_ES  # Alias

def _replace_note_prefix(content: str, new_prefix: str) -> str:
    """Replace PENDIENTE: or RECORDATORIO: prefix with a new one."""
    for old in ("PENDIENTE:", "RECORDATORIO:"):
        if old in content:
            return content.replace(old, new_prefix, 1)
    return content


def _get_wa_config(db=None, tenant_id=None):
    """Get WA token and phone_id from tenant DB or env vars.
    Prefers tenant with wa_access_token configured (not just first active)."""
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    if db:
        try:
            from database.models import Tenant
            if tenant_id:
                tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            else:
                # Pick tenant that actually has WA configured
                tenant = db.query(Tenant).filter(
                    Tenant.is_active == True,
                    Tenant.wa_access_token.isnot(None),
                ).first()
            if tenant:
                if tenant.wa_access_token:
                    token = tenant.wa_access_token
                if tenant.wa_phone_number_id:
                    phone_id = tenant.wa_phone_number_id
        except Exception:
            pass
    return token, phone_id


def _wa_headers(db=None):
    """Read token from tenant DB first, fallback to env."""
    token, _ = _get_wa_config(db)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _send_whatsapp_sync(phone: str, text: str, db=None) -> bool:
    """Send a WhatsApp message synchronously (for use in scheduler thread)."""
    # Check token pause before attempting send
    try:
        from routes.whatsapp_endpoints import _wa_token_paused, _trigger_token_pause, _is_token_error
        if _wa_token_paused:
            print(f"[SCHEDULER] Token paused — skipping WA send to {phone[-4:]}")
            return False
    except ImportError:
        pass

    try:
        _, phone_id = _get_wa_config(db)
        wa_url = f"https://graph.facebook.com/{WA_API_VERSION}/{phone_id}/messages"
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                wa_url,
                headers=_wa_headers(db),
                json={
                    "messaging_product": "whatsapp",
                    "to": normalize_phone(phone),
                    "type": "text",
                    "text": {"body": text},
                },
            )
            data = resp.json()
            if resp.status_code == 200 and "messages" in data:
                # Increment tenant messages_used
                try:
                    if db:
                        from database.models import Tenant
                        t = db.query(Tenant).filter(
                            Tenant.is_active == True,
                            Tenant.wa_access_token.isnot(None),
                        ).first()
                        if t:
                            t.messages_used = (t.messages_used or 0) + 1
                            db.commit()
                except Exception:
                    pass
                return True
            else:
                error_msg = data.get("error", {}).get("message", str(data)[:100])
                print(f"[SCHEDULER] WA send failed: {error_msg}")
                # Detect token expiration → auto-pause
                try:
                    from routes.whatsapp_endpoints import _is_token_error, _trigger_token_pause
                    if _is_token_error(error_msg):
                        _trigger_token_pause()
                except ImportError:
                    pass
                return False
    except Exception as e:
        print(f"[SCHEDULER] WA send error: {e}")
        return False


def _store_outbound_message(db, conv_id: int, text: str, wa_sent: bool, tag: str = "scheduler"):
    """Store a scheduler outbound message in the DB with a tag for deduplication."""
    msg = WhatsAppMessage(
        conversation_id=conv_id,
        wa_message_id=None,
        direction="outbound",
        content=text,
        message_type="text",
        status="sent" if wa_sent else "failed",
        sent_by=f"lina_ia_{tag}",
    )
    db.add(msg)
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if conv:
        conv.last_message_at = datetime.utcnow()
    db.commit()


def _conv_rate_limited(db, conv_id: int, max_per_hour: int = 3, max_per_day: int = 6) -> bool:
    """Global rate limiter: max N outbound messages per conversation per hour/day.
    Prevents spam regardless of which system sends (scheduler, workflows, automations)."""
    now = _now_colombia()
    hour_ago = now - timedelta(hours=1)
    today_start = datetime.combine(now.date(), datetime.min.time())

    # Count ALL outbound messages in last hour (not just tagged ones)
    hour_count = (
        db.query(WhatsAppMessage)
        .filter(
            WhatsAppMessage.conversation_id == conv_id,
            WhatsAppMessage.sent_by.like("lina_%"),
            WhatsAppMessage.created_at >= hour_ago,
        )
        .count()
    )
    if hour_count >= max_per_hour:
        return True

    # Count ALL outbound messages today
    day_count = (
        db.query(WhatsAppMessage)
        .filter(
            WhatsAppMessage.conversation_id == conv_id,
            WhatsAppMessage.sent_by.like("lina_%"),
            WhatsAppMessage.created_at >= today_start,
        )
        .count()
    )
    return day_count >= max_per_day


def _already_sent_today(db, conv_id: int, tag: str) -> bool:
    """Check if the scheduler already sent a message with this tag to this conversation today."""
    today_start = datetime.combine(_now_colombia().date(), datetime.min.time())
    existing = (
        db.query(WhatsAppMessage)
        .filter(
            WhatsAppMessage.conversation_id == conv_id,
            WhatsAppMessage.sent_by == f"lina_ia_{tag}",
            WhatsAppMessage.created_at >= today_start,
        )
        .first()
    )
    return existing is not None


def _already_sent_for_date(db, conv_id: int, tag: str, target_date: date) -> bool:
    """Check if the scheduler already sent a message with this tag for a specific date range."""
    # Check messages from target_date onwards (for no-show follow-ups)
    check_start = datetime.combine(target_date, datetime.min.time())
    existing = (
        db.query(WhatsAppMessage)
        .filter(
            WhatsAppMessage.conversation_id == conv_id,
            WhatsAppMessage.sent_by == f"lina_ia_{tag}",
            WhatsAppMessage.created_at >= check_start,
        )
        .first()
    )
    return existing is not None


def _match_phone_to_conversation(db, phone_str, client_name="", tenant_id=None):
    """Find WhatsApp conversation by phone (digits-only comparison).
    Returns conversation or None. NEVER returns a wrong-person match."""
    import re as _re
    if not phone_str:
        return None
    phone_digits = _re.sub(r'\D', '', phone_str or '')
    if len(phone_digits) < 10:
        return None
    phone_tail = phone_digits[-10:]
    client_name_lower = (client_name or "").lower().strip()
    client_first = client_name_lower.split()[0] if client_name_lower else ""

    # Load all tenant conversations and compare digits-only (handles any stored format)
    q = db.query(WhatsAppConversation)
    if tenant_id:
        q = q.filter(WhatsAppConversation.tenant_id == tenant_id)
    all_convs = q.all()

    candidates = []
    for c in all_convs:
        conv_digits = _re.sub(r'\D', '', c.wa_contact_phone or '')
        if len(conv_digits) >= 7 and conv_digits[-10:] == phone_tail:
            candidates.append(c)

    if not candidates:
        return None

    # Single match — validate name to avoid sending to wrong person
    if len(candidates) == 1:
        conv = candidates[0]
        # If we have a client name, verify it matches (at least first name)
        if client_name_lower:
            conv_name_lower = (conv.wa_contact_name or "").lower().strip()
            conv_first = conv_name_lower.split()[0] if conv_name_lower else ""
            # Also check linked client name
            linked_name = ""
            if conv.client_id:
                from database.models import Client as _Client
                linked = db.query(_Client).filter(_Client.id == conv.client_id).first()
                if linked:
                    linked_name = (linked.name or "").lower().strip()
            # Match if first name matches WA name OR linked CRM name
            name_match = (
                (conv_first and client_first and client_first == conv_first) or
                (linked_name and client_first in linked_name) or
                (not conv_first and not linked_name)  # no name to compare = allow
            )
            if not name_match:
                print(f"[SCHEDULER] SAFETY: Phone matches conv #{conv.id} '{conv.wa_contact_name}' but name '{client_name}' doesn't match. Skipping.")
                return None
        return conv

    # Multiple matches — prefer one with matching name
    if client_first:
        for c in candidates:
            contact_first = ((c.wa_contact_name or "").split()[0]).lower()
            if contact_first and client_first == contact_first:
                return c

    # No name match found — don't return wrong person
    print(f"[SCHEDULER] WARNING: {len(candidates)} convs match phone but none match '{client_name}'. Skipping.")
    return None


def _create_conversation_for_client(db, client, tenant_id=None):
    """Create conversation with VERIFIED client data — correct phone + correct name."""
    import re as _re
    phone = _re.sub(r'\D', '', client.phone or '')
    if len(phone) < 10:
        print(f"[SCHEDULER] Cannot create conversation for {client.name}: invalid phone '{client.phone}'")
        return None

    # Double-check no existing conversation with these digits
    all_convs = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.tenant_id == (tenant_id or client.tenant_id)
    ).all()
    phone_tail = phone[-10:]
    for c in all_convs:
        c_digits = _re.sub(r'\D', '', c.wa_contact_phone or '')
        if c_digits[-10:] == phone_tail:
            print(f"[SCHEDULER] Found existing conv #{c.id} for {client.name} by digits. Reusing.")
            # Update name if needed
            if client.name and c.wa_contact_name != client.name:
                c.wa_contact_name = client.name
            if not c.client_id:
                c.client_id = client.id
            db.commit()
            return c

    conv = WhatsAppConversation(
        tenant_id=tenant_id or client.tenant_id,
        client_id=client.id,
        wa_contact_phone=phone,
        wa_contact_name=client.name or "",
        is_ai_active=True,
        unread_count=0,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    print(f"[SCHEDULER] Created conversation #{conv.id} for {client.name} (phone: {phone})")
    return conv


def _find_conversation(db, appt):
    """Find or create WhatsApp conversation for an appointment's client.
    Creates ONLY if client has a valid phone and no existing conversation."""
    client_name = (appt.client_name or "").strip()
    tid = getattr(appt, 'tenant_id', None)

    # 1. Try by phone in appointment
    if appt.client_phone:
        conv = _match_phone_to_conversation(db, appt.client_phone, client_name, tenant_id=tid)
        if conv:
            return conv

    # 2. Try by client record phone
    if appt.client_id:
        client = db.query(Client).filter(Client.id == appt.client_id).first()
        if client and client.phone:
            tid = tid or getattr(client, 'tenant_id', None)
            conv = _match_phone_to_conversation(db, client.phone, client_name, tenant_id=tid)
            if conv:
                return conv

    # No conversation found — callers that need to send should use _create_conversation_for_client() directly
    return None


def _get_appt_details(db, appt):
    """Get service name, staff name for an appointment."""
    service = db.query(Service).filter(Service.id == appt.service_id).first()
    staff = db.query(Staff).filter(Staff.id == appt.staff_id).first()
    service_name = service.name if service else "tu servicio"
    staff_first = staff.name.split()[0] if staff else ""
    client_first = (appt.client_name or "").split()[0] if appt.client_name else ""
    return client_first, service_name, staff_first


def _suggest_day():
    """Suggest a friendly day to reschedule (next 2-3 business days)."""
    now = _now_colombia()
    for offset in [1, 2, 3]:
        candidate = now.date() + timedelta(days=offset)
        weekday = candidate.weekday()
        if weekday < 6:  # Mon-Sat
            return _DAYS_ES[weekday]
    return "esta semana"

