# ============================================================================
# Plexify Studio - Background Scheduler (v3 — DB-aware, deploy-safe)
# Runs periodic tasks:
#   1. 30-min default reminder for ALL appointments
#   2. Custom reminders from PENDIENTE notes (e.g. "avisame 10 min antes")
#   3. 24-hour no-show follow-up to re-engage clients
#   4. Expire old PENDIENTE notes
#
# IMPORTANT: All deduplication uses the DATABASE, not in-memory sets.
# This means the scheduler survives redeploys without sending duplicates.
# ============================================================================

import os
import time
import threading
import httpx
from datetime import datetime, date, timedelta

from database.connection import SessionLocal
from database.models import (
    Appointment, Client, ClientNote, Staff, Service,
    WhatsAppConversation, WhatsAppMessage,
)
from routes._helpers import normalize_phone, now_colombia as _now_colombia, _COL_OFFSET
from activity_log import log_event

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")

SCHEDULER_INTERVAL = 120  # Check every 2 minutes

# Days of the week in Spanish for suggestions
_DAYS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

def _replace_note_prefix(content: str, new_prefix: str) -> str:
    """Replace PENDIENTE: or RECORDATORIO: prefix with a new one."""
    for old in ("PENDIENTE:", "RECORDATORIO:"):
        if old in content:
            return content.replace(old, new_prefix, 1)
    return content


def _get_wa_config(db=None):
    """Get WA token and phone_id from tenant DB (first active) or env vars."""
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    if db:
        try:
            from database.models import Tenant
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
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
    """Find WhatsApp conversation by phone, with name validation.
    Returns conversation or None. NEVER returns a wrong-person match."""
    if not phone_str:
        return None
    phone_clean = normalize_phone(phone_str)
    if len(phone_clean) < 7:
        return None
    phone_tail = phone_clean[-10:]
    client_name_lower = (client_name or "").lower().strip()
    client_first = client_name_lower.split()[0] if client_name_lower else ""

    q = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.wa_contact_phone.contains(phone_tail)
    )
    if tenant_id:
        q = q.filter(WhatsAppConversation.tenant_id == tenant_id)
    candidates = q.all()

    if not candidates:
        return None

    if len(candidates) == 1:
        conv = candidates[0]
        # Validate name if we have both
        if client_first:
            contact_first = ((conv.wa_contact_name or "").split()[0]).lower()
            if contact_first and client_first != contact_first:
                print(f"[SCHEDULER] SAFETY: Conv '{conv.wa_contact_name}' != client '{client_name}'. Skipping.")
                return None
        return conv

    # Multiple matches — find by name
    if client_first:
        for c in candidates:
            contact_first = ((c.wa_contact_name or "").split()[0]).lower()
            if contact_first and client_first == contact_first:
                return c
        print(f"[SCHEDULER] WARNING: {len(candidates)} convs match phone ...{phone_tail[-4:]} but none match '{client_name}'. Skipping.")
    return None


def _create_conversation_for_client(db, client, tenant_id=None):
    """Create a new WhatsAppConversation for a client who has a phone but no existing conversation."""
    phone = normalize_phone(client.phone)
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
    print(f"[SCHEDULER] Created new WA conversation #{conv.id} for {client.name} ({phone[-4:]})")
    return conv


def _find_conversation(db, appt):
    """Find WhatsApp conversation for an appointment's client.
    If client has a phone but no conversation, creates one automatically."""
    client_name = (appt.client_name or "").strip()
    tid = getattr(appt, 'tenant_id', None)
    conv = None

    # Try by phone in appointment
    if appt.client_phone:
        conv = _match_phone_to_conversation(db, appt.client_phone, client_name, tenant_id=tid)

    # Try by client record phone
    if not conv and appt.client_id:
        client = db.query(Client).filter(Client.id == appt.client_id).first()
        if client and client.phone:
            tid = tid or getattr(client, 'tenant_id', None)
            conv = _match_phone_to_conversation(db, client.phone, client_name, tenant_id=tid)
            # No conversation found but client has phone → create one
            if not conv:
                conv = _create_conversation_for_client(db, client, tenant_id=tid)

    return conv


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


# ============================================================================
# 1. DEFAULT 30-MINUTE REMINDER — For ALL confirmed appointments
# ============================================================================
def _check_30min_reminders(db):
    """Send reminder 30 minutes before every confirmed appointment."""
    now = _now_colombia()
    today = now.date()

    appointments = (
        db.query(Appointment)
        .filter(Appointment.date == today)
        .filter(Appointment.status == "confirmed")
        .all()
    )

    for appt in appointments:
        try:
            hour, minute = map(int, appt.time.split(":"))
            appt_dt = datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute))
        except (ValueError, AttributeError):
            continue

        diff_min = (appt_dt - now).total_seconds() / 60

        # Window: 25-35 minutes before (catches the ~30 min mark)
        if 25 <= diff_min <= 35:
            conv = _find_conversation(db, appt)
            if not conv:
                print(f"[SCHEDULER] No WA conv for appt #{appt.id} ({appt.client_name}), skip 30min reminder")
                continue

            # DB-SAFE DEDUP: per appointment ID (not per conversation — client may have 2+ appointments)
            if _already_sent_today(db, conv.id, f"reminder_30min_{appt.id}"):
                continue

            client_first, service_name, staff_first = _get_appt_details(db, appt)

            # Check if this is the first message ever to this client
            prev_msgs = db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv.id).count()
            from database.models import Tenant
            _tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
            _biz = _tenant.name if _tenant else "tu negocio de confianza"

            if prev_msgs == 0:
                msg = f"Hola {client_first}! Soy Lina de {_biz} 👋\n\nTe escribo para recordarte que tienes una cita hoy a las {appt.time}"
            else:
                msg = f"Hola {client_first}! Te recordamos que tienes una cita hoy a las {appt.time}"
            if staff_first:
                msg += f" con {staff_first}"
            msg += f" para {service_name}."
            msg += "\n\nTe esperamos! 💈"
            msg += "\n\nSi necesitas cambiar la hora, avisame y lo ajustamos sin problema!"

            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg, db=db)

            # If free text fails (24h window expired), try with approved template
            if not wa_sent:
                try:
                    from workflow_engine import _send_template_sync
                    # Use "recordatorio_de_cita_1h" or similar approved template
                    params = [client_first, appt.time, staff_first or "tu profesional", service_name]
                    wa_sent = _send_template_sync(conv.wa_contact_phone, "recordatorio_de_cita_1h", parameters=params, db=db)
                    if wa_sent:
                        msg = f"[Template] Recordatorio de cita a las {appt.time} con {staff_first} para {service_name}"
                        print(f"[SCHEDULER] 30-min reminder sent via TEMPLATE for appt #{appt.id}")
                except Exception as e:
                    print(f"[SCHEDULER] Template fallback failed: {e}")

            _store_outbound_message(db, conv.id, msg, wa_sent, tag=f"reminder_30min_{appt.id}")

            if wa_sent:
                print(f"[SCHEDULER] 30-min reminder sent for appt #{appt.id} → {client_first} ({conv.wa_contact_phone})")
                log_event("tarea", f"Recordatorio 30min enviado a {client_first}", detail=f"Cita a las {appt.time} con {staff_first} para {service_name}", contact_name=client_first, conv_id=conv.id, status="ok")
            else:
                print(f"[SCHEDULER] 30-min reminder FAILED for appt #{appt.id} → {client_first}")
                log_event("error", f"Recordatorio 30min fallido para {client_first}", detail=f"No se pudo enviar recordatorio de cita {appt.time}. Texto y template fallaron.", contact_name=client_first, conv_id=conv.id, status="error")


# ============================================================================
# 2. CUSTOM REMINDERS — From PENDIENTE notes ("avisame 10 min antes", etc.)
# ============================================================================
def _check_custom_reminders(db):
    """Handle custom reminder requests — match note content to correct appointment."""
    import re as _re
    from sqlalchemy import or_

    now = _now_colombia()
    today = now.date()

    _REMINDER_KEYWORDS = [
        "%recordar%", "%avisar%", "%aviso%", "%recordatorio%",
        "%10 minuto%", "%40 minuto%", "%faltando%",
        "%antes de la cita%", "%antes de su cita%",
        "%antes de cita%", "%enviar recordatorio%",
        "%manual%", "%minutos antes%", "%min antes%",
    ]

    # Step 1: Find ALL pending reminder notes (not per-appointment — avoids wrong match)
    keyword_filter = or_(*[ClientNote.content.ilike(kw) for kw in _REMINDER_KEYWORDS])
    pending_notes = (
        db.query(ClientNote)
        .filter(or_(
            ClientNote.content.ilike("%PENDIENTE:%"),
            ClientNote.content.ilike("%RECORDATORIO:%"),
        ))
        .filter(keyword_filter)
        .all()
    )

    if not pending_notes:
        return

    for note in pending_notes:
        client_id = note.client_id
        note_text = note.content.lower()

        # Step 2: Parse time hint from note (e.g., "cita 3:30pm", "cita 15:30")
        time_match = _re.search(r'cita\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?', note_text)
        target_hour, target_min = None, None
        if time_match:
            h = int(time_match.group(1))
            m = int(time_match.group(2) or 0)
            ampm = time_match.group(3)
            if ampm == "pm" and h < 12:
                h += 12
            elif ampm == "am" and h == 12:
                h = 0
            target_hour, target_min = h, m

        # Step 3: Parse requested lead time (e.g., "30min antes", "10 minutos antes")
        lead_match = _re.search(r'(\d+)\s*min', note_text)
        requested_lead = int(lead_match.group(1)) if lead_match else 30  # default 30 min

        # Step 4: Find the RIGHT appointment for this client today
        client_apts = (
            db.query(Appointment)
            .filter(
                Appointment.date == today,
                Appointment.client_id == client_id,
                Appointment.status.in_(["confirmed", "completed"]),
            )
            .order_by(Appointment.time)
            .all()
        )

        if not client_apts:
            continue

        # Match by time hint if available, otherwise pick the NEXT upcoming one
        best_appt = None
        if target_hour is not None:
            for a in client_apts:
                try:
                    ah, am = map(int, a.time.split(":"))
                    if ah == target_hour and abs(am - target_min) <= 5:
                        best_appt = a
                        break
                except (ValueError, AttributeError):
                    continue

        if not best_appt:
            # Pick the next upcoming appointment (not one that already passed)
            for a in client_apts:
                try:
                    ah, am = map(int, a.time.split(":"))
                    appt_dt = datetime.combine(today, datetime.min.time().replace(hour=ah, minute=am))
                    if (appt_dt - now).total_seconds() > -300:  # Not more than 5 min past
                        best_appt = a
                        break
                except (ValueError, AttributeError):
                    continue

        if not best_appt:
            # All appointments have passed — expire the note
            note.content = _replace_note_prefix(note.content, "EXPIRADO:") + f" [Todas las citas de hoy ya pasaron — {now.strftime('%H:%M')}]"
            db.commit()
            client = db.query(Client).filter(Client.id == client_id).first()
            client_first = (client.name or "").split()[0] if client else "?"
            print(f"[SCHEDULER] Expired reminder note #{note.id} — all appointments passed for {client_first}")
            log_event("tarea", f"Recordatorio expirado para {client_first}", detail="Todas las citas de hoy ya pasaron.", contact_name=client_first, status="warning")
            continue

        # Step 5: Calculate timing
        try:
            ah, am = map(int, best_appt.time.split(":"))
            appt_dt = datetime.combine(today, datetime.min.time().replace(hour=ah, minute=am))
        except (ValueError, AttributeError):
            continue

        diff_min = (appt_dt - now).total_seconds() / 60

        # Appointment already passed
        if diff_min < -5:
            note.content = _replace_note_prefix(note.content, "EXPIRADO:") + f" [La cita ya paso — {now.strftime('%H:%M')}]"
            db.commit()
            client_first = (best_appt.client_name or "").split()[0]
            print(f"[SCHEDULER] Expired reminder note #{note.id} for {client_first} (cita {best_appt.time} passed)")
            log_event("tarea", f"Recordatorio expirado para {client_first}", detail=f"La cita era a las {best_appt.time} y ya paso.", contact_name=client_first, status="warning")
            continue

        # Step 6: Send within precise window (requested_lead ± 5 min)
        window_min = max(0, requested_lead - 5)
        window_max = requested_lead + 5
        if not (window_min <= diff_min <= window_max):
            continue  # Not time yet

        conv = _find_conversation(db, best_appt)
        if not conv:
            # No WA conversation found — mark as failed instead of silently skipping
            client_first = (best_appt.client_name or "").split()[0]
            note.content = _replace_note_prefix(note.content, "FALLIDO:") + f" [Sin WhatsApp para {client_first} — {now.strftime('%H:%M')}]"
            db.commit()
            print(f"[SCHEDULER] No WA conv for reminder note #{note.id} ({client_first}). Marked as FALLIDO.")
            log_event("error", f"Recordatorio fallido: {client_first} sin WhatsApp", detail=f"No se pudo enviar recordatorio de cita {best_appt.time} — no hay conversacion WA", contact_name=client_first, status="error")
            continue

        # DB-SAFE DEDUP — per appointment ID to avoid conflicts with multiple appointments
        dedup_tag = f"reminder_custom_{best_appt.id}"
        if _already_sent_today(db, conv.id, dedup_tag):
            note.content = _replace_note_prefix(note.content, "COMPLETADO:") + f" [Auto-resuelto {now.strftime('%H:%M')}]"
            db.commit()
            continue

        client_first, service_name, staff_first = _get_appt_details(db, best_appt)

        # Check if first contact
        prev_msgs = db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv.id).count()
        from database.models import Tenant
        _tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
        _biz = _tenant.name if _tenant else "tu negocio de confianza"

        mins_left = int(diff_min)
        if prev_msgs == 0:
            if mins_left > 1:
                msg = f"Hola {client_first}! Soy Lina de {_biz} 👋\n\nTe escribo para recordarte que tu cita es en {mins_left} minutos"
            else:
                msg = f"Hola {client_first}! Soy Lina de {_biz} 👋\n\nTu cita es ahorita"
        else:
            if mins_left > 1:
                msg = f"Hola {client_first}! Te recuerdo que tu cita es en {mins_left} minutos"
            else:
                msg = f"Hola {client_first}! Tu cita es ahorita"

        if staff_first:
            msg += f" con {staff_first}"
        msg += f" para {service_name}."
        msg += " Te esperamos! 💈"

        wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg)
        _store_outbound_message(db, conv.id, msg, wa_sent, tag=dedup_tag)

        status_tag = "COMPLETADO:" if wa_sent else "FALLIDO:"
        note.content = _replace_note_prefix(note.content, status_tag) + f" [{'Enviado' if wa_sent else 'Fallo envio'} {now.strftime('%H:%M')}]"
        db.commit()

        print(f"[SCHEDULER] Custom reminder {'sent' if wa_sent else 'FAILED'} for appt #{best_appt.id} → {client_first} (with {staff_first})")
        log_event(
            "tarea",
            f"Recordatorio {'enviado' if wa_sent else 'fallido'} a {client_first}",
            detail=f"Cita a las {best_appt.time} con {staff_first} — recordatorio {requested_lead}min antes",
            contact_name=client_first, conv_id=conv.id,
            status="ok" if wa_sent else "error",
        )


# ============================================================================
# 3. NO-SHOW STATUS UPDATE — Mark missed appointments (NO unsolicited messages)
# ============================================================================
def _check_noshow_followups(db):
    """
    Check appointments from yesterday that were no_show or never completed.
    ONLY marks them as no_show in the DB — does NOT send any message.
    Unsolicited promotional/re-engagement messages are NOT allowed.
    """
    now = _now_colombia()
    yesterday = now.date() - timedelta(days=1)

    # Appointments from yesterday still "confirmed" (never showed)
    missed = (
        db.query(Appointment)
        .filter(Appointment.date == yesterday)
        .filter(Appointment.status == "confirmed")
        .all()
    )

    for appt in missed:
        appt.status = "no_show"
        db.commit()
        client_first = (appt.client_name or "").split()[0]
        print(f"[SCHEDULER] Marked appt #{appt.id} as no_show ({client_first})")
        log_event("sistema", f"Cita marcada como no-show: {client_first}", detail=f"Cita del {yesterday} a las {appt.time} no fue completada.", contact_name=client_first, status="warning")


# ============================================================================
# 4. EXPIRE OLD PENDIENTE NOTES
# ============================================================================
def _expire_old_notes(db):
    """Mark PENDIENTE/RECORDATORIO notes older than 24h as expired."""
    from sqlalchemy import or_
    now = datetime.utcnow()

    old_notes = (
        db.query(ClientNote)
        .filter(or_(ClientNote.content.ilike("%PENDIENTE:%"), ClientNote.content.ilike("%RECORDATORIO:%")))
        .filter(~ClientNote.content.ilike("%COMPLETADO:%"))
        .filter(~ClientNote.content.ilike("%EXPIRADO:%"))
        .filter(~ClientNote.content.ilike("%FALLIDO:%"))
        .filter(~ClientNote.content.ilike("%RESUELTO:%"))
        .all()
    )

    for note in old_notes:
        should_expire = False
        expire_reason = ""

        # Expire if older than 24h
        if note.created_at and (now - note.created_at).total_seconds() > 86400:
            should_expire = True
            expire_reason = "tarea tenia mas de 24h"

        # Expire reminder notes if the referenced appointment has passed
        if not should_expire and note.created_at:
            note_lower = note.content.lower()
            _is_reminder = any(kw in note_lower for kw in ["recordatorio", "avisar", "aviso", "min antes", "minutos antes"])
            if _is_reminder:
                # Check if client has any upcoming appointments today
                col_now = _now_colombia()
                client_future_apts = (
                    db.query(Appointment)
                    .filter(Appointment.client_id == note.client_id, Appointment.date == col_now.date(), Appointment.status.in_(["confirmed", "completed", "paid"]))
                    .all()
                )
                all_passed = True
                for a in client_future_apts:
                    try:
                        ah, am = map(int, a.time.split(":"))
                        if ah * 60 + am > col_now.hour * 60 + col_now.minute - 5:
                            all_passed = False
                            break
                    except (ValueError, AttributeError):
                        pass
                if not client_future_apts or all_passed:
                    should_expire = True
                    expire_reason = "todas las citas del dia ya pasaron"

        if should_expire:
            for prefix in ["PENDIENTE:", "RECORDATORIO:"]:
                note.content = note.content.replace(prefix, "EXPIRADO:")
            note.content += f" [Expirado — {expire_reason} {now.strftime('%d/%m %H:%M')}]"
            db.commit()
            print(f"[SCHEDULER] Expired note #{note.id}: {expire_reason}")


# ============================================================================
# 5. MORNING REVIEW — Process unread chats when AI reactivates at 7:30 AM
# ============================================================================
def _is_business_hours():
    """True if current Colombia time is within business hours (7:30 AM - 8:30 PM)."""
    now = _now_colombia()
    hour, minute = now.hour, now.minute
    if hour > 20 or (hour == 20 and minute >= 30):
        return False
    if hour < 7 or (hour == 7 and minute < 30):
        return False
    return True

# Track whether we already did morning review today
_last_morning_review_date = None

def _morning_review(db):
    """
    At 7:30 AM Colombia time, check all conversations that have unread
    inbound messages from off-hours. Trigger AI auto-reply for each.
    This runs in sync scheduler thread, so we use httpx sync + direct AI call.
    """
    global _last_morning_review_date

    now_col = _now_colombia()
    today = now_col.date()

    # Only run once per day, and only between 7:30 AM and 8:00 AM
    if _last_morning_review_date == today:
        return
    if now_col.hour != 7 or now_col.minute < 30:
        return
    # Don't run after 8:00 AM (we had our window)
    if now_col.hour == 7 and now_col.minute > 59:
        return

    _last_morning_review_date = today

    # Check if ALL tenants have AI paused (multi-tenant safe)
    from database.models import Tenant
    active_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    all_paused = all(t.ai_is_paused for t in active_tenants) if active_tenants else True
    if all_paused:
        print(f"[SCHEDULER] Morning review SKIPPED — AI is paused for all tenants")
        return

    print(f"[SCHEDULER] Morning review started at {now_col.strftime('%H:%M')}")
    log_event("sistema", "Revision matutina iniciada", detail="Revisando mensajes que llegaron anoche fuera de horario.", status="info")

    # Find conversations with unread inbound messages from off-hours (last night)
    # Look for inbound messages after 8:30 PM yesterday (UTC) or before 7:30 AM today
    yesterday_offhours_start = datetime.combine(
        (today - timedelta(days=1)), datetime.min.time()
    ).replace(hour=20, minute=30) - _COL_OFFSET  # Convert to UTC

    now_utc = datetime.utcnow()

    # Get conversations with recent unread inbound messages
    convs_with_pending = (
        db.query(WhatsAppConversation)
        .filter(WhatsAppConversation.unread_count > 0)
        .all()
    )

    processed = 0
    for conv in convs_with_pending:
        if not conv.is_ai_active:
            continue  # Admin manually paused AI — don't touch

        # Check for inbound messages during off-hours
        pending_msgs = (
            db.query(WhatsAppMessage)
            .filter(
                WhatsAppMessage.conversation_id == conv.id,
                WhatsAppMessage.direction == "inbound",
                WhatsAppMessage.created_at >= yesterday_offhours_start,
            )
            .order_by(WhatsAppMessage.created_at.desc())
            .all()
        )

        if not pending_msgs:
            continue

        # Check if there was already a non-offhours AI reply after these messages
        last_ai = (
            db.query(WhatsAppMessage)
            .filter(
                WhatsAppMessage.conversation_id == conv.id,
                WhatsAppMessage.sent_by == "lina_ia",
                WhatsAppMessage.created_at >= yesterday_offhours_start,
            )
            .first()
        )
        if last_ai:
            continue  # AI already replied — skip

        # Get the latest inbound text
        latest_inbound = pending_msgs[0].content or ""

        # Build context and generate AI response
        try:
            from routes.ai_endpoints import _build_system_prompt, _call_ai_sync

            system_prompt = _build_system_prompt(db, is_whatsapp=True, conv_id=conv.id)

            # Get conversation history
            recent_msgs = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == conv.id)
                .order_by(WhatsAppMessage.created_at.desc())
                .limit(40)
                .all()
            )
            recent_msgs.reverse()

            history = []
            for m in recent_msgs:
                role = "user" if m.direction == "inbound" else "assistant"
                history.append({"role": role, "content": m.content})

            # Remove trailing user messages (we'll add combined text)
            while history and history[-1]["role"] == "user":
                history.pop()

            # Prefix so Lina knows this is morning follow-up — ONLY respond to what was asked
            morning_context = f"[CONTEXTO: Es la manana siguiente. El cliente escribio anoche fuera de horario. Respondele amablemente, retomando su consulta. SOLO responde a lo que el cliente pregunto o pidio. NO inventes mensajes promocionales ni de reactivacion.]\n\n{latest_inbound}"

            ai_response = _call_ai_sync(system_prompt, history, morning_context)

            if not ai_response or not ai_response.strip():
                continue

            # Clean markdown
            import re as re_mod
            clean = ai_response
            clean = re_mod.sub(r'\*\*(.+?)\*\*', r'\1', clean)
            clean = re_mod.sub(r'\*(.+?)\*', r'\1', clean)
            clean = re_mod.sub(r'#{1,3}\s+', '', clean)
            clean = re_mod.sub(r'`([^`]+)`', r'\1', clean)
            # Remove action blocks
            clean = re_mod.sub(r'[`]{1,3}\s*action.*', '', clean, flags=re_mod.DOTALL | re_mod.IGNORECASE)
            clean = re_mod.sub(r'\{[^}]*"action"\s*:.*?\}', '', clean, flags=re_mod.DOTALL)
            clean = re_mod.sub(r'\n{3,}', '\n\n', clean).strip()

            if not clean:
                continue

            # Send via WhatsApp
            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, clean)

            # Store in DB
            msg = WhatsAppMessage(
                conversation_id=conv.id,
                wa_message_id=None,
                direction="outbound",
                content=clean,
                message_type="text",
                status="sent" if wa_sent else "failed",
                sent_by="lina_ia",
            )
            db.add(msg)
            conv.last_message_at = datetime.utcnow()
            db.commit()

            processed += 1
            print(f"[SCHEDULER] Morning review: replied to conv #{conv.id} ({conv.wa_contact_name})")

            # Small delay between messages to not hit rate limits
            time.sleep(3)

        except Exception as e:
            print(f"[SCHEDULER] Morning review error for conv #{conv.id}: {e}")

    print(f"[SCHEDULER] Morning review complete — processed {processed} conversations")


# ============================================================================
# 6. SWEEP MISSED CONVERSATIONS — Catch-up for messages Lina missed
# ============================================================================
def _sweep_missed_conversations(db):
    """
    Find active conversations where a client wrote but Lina never replied.
    This catches messages that were dropped due to rate limits, cooldowns,
    transient errors, or other silent skips in the auto-reply pipeline.
    Only processes messages 3-120 min old (avoids racing with normal flow).
    """
    from sqlalchemy import desc

    # Check if ALL tenants have AI paused (multi-tenant safe)
    from database.models import Tenant
    active_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    all_paused = all(t.ai_is_paused for t in active_tenants) if active_tenants else True
    if all_paused:
        return

    now_utc = datetime.utcnow()
    min_age = now_utc - timedelta(minutes=3)    # Don't touch very recent (normal flow handles)
    max_age = now_utc - timedelta(minutes=120)  # Don't touch very old

    convs = (
        db.query(WhatsAppConversation)
        .filter(
            WhatsAppConversation.is_ai_active == True,
            WhatsAppConversation.unread_count > 0,
        )
        .all()
    )

    processed = 0
    for conv in convs:
        if processed >= 3:
            break  # Max 3 per cycle to avoid overload

        # Get last inbound message
        last_inbound = (
            db.query(WhatsAppMessage)
            .filter(
                WhatsAppMessage.conversation_id == conv.id,
                WhatsAppMessage.direction == "inbound",
            )
            .order_by(desc(WhatsAppMessage.created_at))
            .first()
        )
        if not last_inbound or not last_inbound.created_at:
            continue

        # Must be within the 3-120 min window
        if last_inbound.created_at > min_age or last_inbound.created_at < max_age:
            continue

        # Check if Lina already SUCCESSFULLY replied after this message (exclude failed sends)
        last_ai = (
            db.query(WhatsAppMessage)
            .filter(
                WhatsAppMessage.conversation_id == conv.id,
                WhatsAppMessage.direction == "outbound",
                WhatsAppMessage.sent_by.in_(["lina_ia", "lina_ia_sweep"]),
                WhatsAppMessage.status != "failed",
                WhatsAppMessage.created_at > last_inbound.created_at,
            )
            .first()
        )
        if last_ai:
            continue  # Already replied

        # Dedup: don't sweep same conversation twice in a day
        if _already_sent_today(db, conv.id, "sweep"):
            continue

        # Collect pending inbound text
        pending = (
            db.query(WhatsAppMessage)
            .filter(
                WhatsAppMessage.conversation_id == conv.id,
                WhatsAppMessage.direction == "inbound",
                WhatsAppMessage.created_at >= max_age,
            )
            .order_by(WhatsAppMessage.created_at.asc())
            .all()
        )
        inbound_text = " | ".join(
            m.content for m in pending
            if m.content and not m.content.startswith("📎")
        ) or last_inbound.content or ""

        if not inbound_text.strip():
            continue

        try:
            from routes.ai_endpoints import _build_system_prompt, _call_ai_sync
            import re as re_mod

            system_prompt = _build_system_prompt(db, is_whatsapp=True, conv_id=conv.id)

            # Build history
            recent_msgs = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == conv.id)
                .order_by(desc(WhatsAppMessage.created_at))
                .limit(20)
                .all()
            )
            recent_msgs.reverse()

            history = []
            for m in recent_msgs:
                role = "user" if m.direction == "inbound" else "assistant"
                content = m.content or ""
                if m.sent_by == "lina_ia_offhours":
                    continue  # Skip off-hours templates
                history.append({"role": role, "content": content})

            # Merge consecutive same-role messages
            merged = []
            for h in history:
                if merged and merged[-1]["role"] == h["role"]:
                    merged[-1]["content"] += "\n" + h["content"]
                else:
                    merged.append(h)
            history = merged

            # Remove trailing user messages (we'll add the combined inbound text)
            while history and history[-1]["role"] == "user":
                history.pop()

            # CRITICAL: Only respond to what the client wrote — NO promotional/re-engagement messages
            safe_context = f"[INSTRUCCION CRITICA: SOLO responde al mensaje del cliente. NO inventes mensajes promocionales, de reactivacion, ni de seguimiento. Si el cliente dijo algo, respondele a ESO. Si no hay nada concreto que responder, NO envies nada.]\n\n{inbound_text}"

            ai_response = _call_ai_sync(system_prompt, history, safe_context)

            if not ai_response or not ai_response.strip():
                continue

            # Clean response (same as morning review)
            clean = ai_response
            clean = re_mod.sub(r'\*\*(.+?)\*\*', r'\1', clean)
            clean = re_mod.sub(r'\*(.+?)\*', r'\1', clean)
            clean = re_mod.sub(r'#{1,3}\s+', '', clean)
            clean = re_mod.sub(r'`([^`]+)`', r'\1', clean)
            clean = re_mod.sub(r'[`]{1,3}\s*action.*', '', clean, flags=re_mod.DOTALL | re_mod.IGNORECASE)
            clean = re_mod.sub(r'\{[^}]*"action"\s*:.*?\}', '', clean, flags=re_mod.DOTALL)
            clean = re_mod.sub(r'\n{3,}', '\n\n', clean).strip()

            if not clean:
                continue

            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, clean)
            _store_outbound_message(db, conv.id, clean, wa_sent, tag="sweep")

            processed += 1
            age_min = int((now_utc - last_inbound.created_at).total_seconds() / 60)
            print(f"[SCHEDULER] Sweep: replied to conv #{conv.id} ({conv.wa_contact_name}) — msg was {age_min}min old")
            log_event("respuesta", f"Recupere mensaje perdido de {conv.wa_contact_name or 'cliente'}", detail=f"El mensaje tenia {age_min} minutos sin respuesta. Ya lo resolvi.", contact_name=conv.wa_contact_name or "", conv_id=conv.id, status="ok")

            time.sleep(5)

        except Exception as e:
            print(f"[SCHEDULER] Sweep error for conv #{conv.id}: {e}")

    if processed:
        print(f"[SCHEDULER] Sweep complete — caught up {processed} conversations")


# ============================================================================
# 7. GENERIC PENDING TASKS — Execute timed messages (e.g., "write in 10 min")
# ============================================================================
def _execute_pending_tasks(db):
    """
    Process PENDIENTE notes that are NOT appointment reminders.
    These are generic tasks like "write to client in 10 min", "follow up tomorrow", etc.
    Uses AI to generate the message based on the task description.
    """
    import re as _re

    # Check if ALL tenants have AI paused (multi-tenant safe)
    from database.models import Tenant
    active_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    all_paused = all(t.ai_is_paused for t in active_tenants) if active_tenants else True
    if all_paused:
        return

    now = _now_colombia()
    now_utc = datetime.utcnow()

    # Appointment reminder keywords — SKIP these (handled by _check_custom_reminders)
    _REMINDER_KEYWORDS = [
        "recordatorio", "avisar", "aviso", "antes de la cita",
        "antes de su cita", "antes de cita", "min antes",
        "minutos antes", "faltando",
    ]

    # Find all PENDIENTE and RECORDATORIO notes (not yet resolved)
    from sqlalchemy import or_
    pending_notes = (
        db.query(ClientNote)
        .filter(or_(ClientNote.content.ilike("%PENDIENTE:%"), ClientNote.content.ilike("%RECORDATORIO:%")))
        .filter(~ClientNote.content.ilike("%COMPLETADO:%"))
        .filter(~ClientNote.content.ilike("%EXPIRADO:%"))
        .filter(~ClientNote.content.ilike("%FALLIDO:%"))
        .filter(~ClientNote.content.ilike("%RESUELTO:%"))
        .all()
    )

    for note in pending_notes:
        note_lower = note.content.lower()

        # Skip appointment reminders — those are handled separately
        if any(kw in note_lower for kw in _REMINDER_KEYWORDS):
            continue

        # Check if enough time has passed since the note was created
        # Parse time hints: "en 10 min", "en 10 minutos", "en 5 min"
        time_match = _re.search(r'en\s+(\d+)\s*min', note_lower)
        if time_match:
            delay_min = int(time_match.group(1))
        else:
            # No time hint — execute after 5 min by default
            delay_min = 5

        if not note.created_at:
            continue

        elapsed_min = (now_utc - note.created_at).total_seconds() / 60
        if elapsed_min < delay_min:
            continue  # Not time yet

        # Find the client and their conversation
        client = db.query(Client).filter(Client.id == note.client_id).first()
        if not client:
            continue

        client_name = (client.name or "").strip()
        client_first = client_name.split()[0] if client_name else ""

        # Find WA conversation — with safety validation
        conv = None
        if client.phone:
            conv = _match_phone_to_conversation(db, client.phone, client_name, tenant_id=getattr(client, 'tenant_id', None))
            # No conversation but has phone → create one
            if not conv:
                conv = _create_conversation_for_client(db, client)

        if not conv:
            # No conversation found — mark as failed, don't silently skip
            print(f"[SCHEDULER] No WA conversation found for {client_name} (task #{note.id}). Marking as failed.")
            note.content = _replace_note_prefix(note.content, "FALLIDO:") + f" [Sin conversacion WhatsApp para este cliente — {now.strftime('%H:%M')}]"
            db.commit()
            log_event("error", f"Tarea fallida: {client_first} sin WhatsApp", detail=f"No se encontro conversacion WhatsApp para '{client_name}'", contact_name=client_first, status="error")
            continue

        # Dedup
        dedup_tag = f"task_{note.id}"
        if _already_sent_today(db, conv.id, dedup_tag):
            note.content = _replace_note_prefix(note.content, "COMPLETADO:") + f" [Auto-resuelto {now.strftime('%H:%M')}]"
            db.commit()
            continue

        # Extract the task description (everything after PENDIENTE:/RECORDATORIO:)
        if "PENDIENTE:" in note.content:
            task_desc = note.content.split("PENDIENTE:")[-1].strip()
        elif "RECORDATORIO:" in note.content:
            task_desc = note.content.split("RECORDATORIO:")[-1].strip()
        else:
            task_desc = note.content

        # Generate AI message based on task description
        try:
            from routes.ai_endpoints import _build_system_prompt, _call_ai_sync

            system_prompt = _build_system_prompt(db, is_whatsapp=True, conv_id=conv.id)

            # Build conversation history
            from sqlalchemy import desc
            recent_msgs = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == conv.id)
                .order_by(desc(WhatsAppMessage.created_at))
                .limit(20)
                .all()
            )
            recent_msgs.reverse()

            history = []
            for m in recent_msgs:
                role = "user" if m.direction == "inbound" else "assistant"
                if m.sent_by == "lina_ia_offhours":
                    continue
                history.append({"role": role, "content": m.content or ""})

            # Merge consecutive same-role
            merged = []
            for h in history:
                if merged and merged[-1]["role"] == h["role"]:
                    merged[-1]["content"] += "\n" + h["content"]
                else:
                    merged.append(h)
            history = merged

            while history and history[-1]["role"] == "user":
                history.pop()

            # Detect if this is the FIRST interaction with the client (no prior messages)
            is_first_contact = len(history) == 0

            # Get business name from tenant
            from database.models import Tenant
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
            business_name = tenant.name if tenant else "el negocio"

            if is_first_contact:
                context = (
                    f"[SISTEMA: Tienes una tarea pendiente que debes ejecutar AHORA. La tarea es: {task_desc}. "
                    f"IMPORTANTE: Esta es la PRIMERA VEZ que le escribes a este cliente por WhatsApp. "
                    f"DEBES presentarte: 'Hola {client_first}! Soy Lina de {business_name}' y luego ejecutar la tarea de forma natural y calida. "
                    f"El cliente no te conoce aun, asi que se amable y clara sobre quien eres y de donde vienes. "
                    f"NO menciones que es una tarea programada.]"
                )
            else:
                context = (
                    f"[SISTEMA: Tienes una tarea pendiente que debes ejecutar AHORA. La tarea es: {task_desc}. "
                    f"Escribe el mensaje al cliente de forma natural y calida, como si fuera espontaneo. "
                    f"NO menciones que es una tarea programada.]"
                )

            ai_response = _call_ai_sync(system_prompt, history, context)

            if not ai_response or not ai_response.strip():
                continue

            # Clean response
            import re as re_mod
            clean = ai_response
            clean = re_mod.sub(r'\*\*(.+?)\*\*', r'\1', clean)
            clean = re_mod.sub(r'\*(.+?)\*', r'\1', clean)
            clean = re_mod.sub(r'#{1,3}\s+', '', clean)
            clean = re_mod.sub(r'`([^`]+)`', r'\1', clean)
            clean = re_mod.sub(r'[`]{1,3}\s*action.*', '', clean, flags=re_mod.DOTALL | re_mod.IGNORECASE)
            clean = re_mod.sub(r'\{[^}]*"action"\s*:.*?\}', '', clean, flags=re_mod.DOTALL)
            clean = re_mod.sub(r'\n{3,}', '\n\n', clean).strip()

            if not clean:
                continue

            # Send via WhatsApp
            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, clean)
            _store_outbound_message(db, conv.id, clean, wa_sent, tag=dedup_tag)

            # Mark note as completed
            status_tag = "COMPLETADO:" if wa_sent else "FALLIDO:"
            for prefix in ["PENDIENTE:", "RECORDATORIO:"]:
                note.content = note.content.replace(prefix, status_tag)
            note.content += f" [{'Enviado' if wa_sent else 'Fallo'} {now.strftime('%H:%M')}]"
            db.commit()

            client_first = (client.name or "").split()[0]
            print(f"[SCHEDULER] Task executed for {client_first}: {task_desc[:60]}")
            log_event(
                "tarea",
                f"Tarea completada: {task_desc[:50]}",
                detail=f"Mensaje enviado a {client_first}" if wa_sent else f"Fallo envio a {client_first}",
                contact_name=client_first, conv_id=conv.id,
                status="ok" if wa_sent else "error",
            )

            time.sleep(3)

        except Exception as e:
            print(f"[SCHEDULER] Task error for note #{note.id}: {e}")


# ============================================================================
# UNRESOLVED MESSAGE DETECTOR — Never leave a client without reply
# Uses the SAME pattern as sweep (sync AI call + _store_outbound_message)
# to avoid the asyncio.new_event_loop fragility and ensure dedup works.
# ============================================================================
def _detect_unresolved_messages(db):
    """Find WhatsApp conversations where the client wrote but Lina NEVER replied,
    and generate + send a response. Catches messages that fell through the cracks.

    Differs from sweep:
    - Sweep checks conversations with unread_count > 0 and 3-120 min window
    - This checks ALL conversations where last message is inbound with 5-30 min window
    - Both use dedup tags (sweep / unresolved) to prevent double-replies
    """
    from routes.whatsapp_endpoints import _wa_token_paused
    from sqlalchemy import desc

    if _wa_token_paused:
        return  # Can't send if token is dead

    # Check if ALL tenants have AI paused (multi-tenant safe)
    from database.models import Tenant
    active_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    all_paused = all(t.ai_is_paused for t in active_tenants) if active_tenants else True
    if all_paused:
        return

    now_utc = datetime.utcnow()
    min_age = now_utc - timedelta(minutes=5)    # Give normal flow time to work
    max_age = now_utc - timedelta(minutes=30)   # Don't touch older (sweep handles 3-120 min)

    convs = (
        db.query(WhatsAppConversation)
        .filter(WhatsAppConversation.is_ai_active == True)
        .all()
    )

    recovered = 0
    for conv in convs:
        if recovered >= 3:  # Max 3 per cycle
            break

        # Get the last message in this conversation
        last_msg = (
            db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.conversation_id == conv.id)
            .order_by(desc(WhatsAppMessage.created_at))
            .first()
        )
        if not last_msg or not last_msg.created_at:
            continue

        # Must be inbound (client wrote last)
        if last_msg.direction != "inbound":
            continue

        # Must be in our 5-30 minute window
        if last_msg.created_at > min_age or last_msg.created_at < max_age:
            continue

        # Check if there's ANY successful outbound after this inbound
        has_reply = (
            db.query(WhatsAppMessage)
            .filter(
                WhatsAppMessage.conversation_id == conv.id,
                WhatsAppMessage.direction == "outbound",
                WhatsAppMessage.status != "failed",
                WhatsAppMessage.created_at > last_msg.created_at,
            )
            .first()
        )
        if has_reply:
            continue  # Already replied

        # Dedup: don't recover same conversation twice today
        if _already_sent_today(db, conv.id, "unresolved"):
            continue

        # Also check if sweep already handled it
        if _already_sent_today(db, conv.id, "sweep"):
            continue

        # FOUND: unresolved message!
        client_name = conv.wa_contact_name or "cliente"
        msg_age = int((now_utc - last_msg.created_at).total_seconds() / 60)
        print(f"[UNRESOLVED] Found unresolved msg in conv {conv.id} ({client_name}) — {msg_age}min old")
        log_event(
            "sistema",
            f"Mensaje sin respuesta detectado — recuperando",
            detail=f"{client_name} escribio hace {msg_age} min sin respuesta. Generando respuesta.",
            conv_id=conv.id, contact_name=client_name, status="warning",
        )

        # Generate AI response (same sync pattern as sweep — no asyncio.new_event_loop needed)
        try:
            from routes.ai_endpoints import _build_system_prompt, _call_ai_sync
            import re as re_mod

            system_prompt = _build_system_prompt(db, is_whatsapp=True, conv_id=conv.id)

            # Build conversation history
            recent_msgs = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == conv.id)
                .order_by(desc(WhatsAppMessage.created_at))
                .limit(20)
                .all()
            )
            recent_msgs.reverse()

            history = []
            for m in recent_msgs:
                role = "user" if m.direction == "inbound" else "assistant"
                if m.sent_by == "lina_ia_offhours":
                    continue
                history.append({"role": role, "content": m.content or ""})

            # Merge consecutive same-role
            merged = []
            for h in history:
                if merged and merged[-1]["role"] == h["role"]:
                    merged[-1]["content"] += "\n" + h["content"]
                else:
                    merged.append(h)
            history = merged

            while history and history[-1]["role"] == "user":
                history.pop()

            inbound_text = last_msg.content or ""
            safe_context = f"[INSTRUCCION CRITICA: SOLO responde al mensaje del cliente. NO inventes mensajes promocionales ni de seguimiento. Responde a lo que el cliente escribio.]\n\n{inbound_text}"

            ai_response = _call_ai_sync(system_prompt, history, safe_context)

            if not ai_response or not ai_response.strip():
                continue

            # Clean response
            clean = ai_response
            clean = re_mod.sub(r'\*\*(.+?)\*\*', r'\1', clean)
            clean = re_mod.sub(r'\*(.+?)\*', r'\1', clean)
            clean = re_mod.sub(r'#{1,3}\s+', '', clean)
            clean = re_mod.sub(r'`([^`]+)`', r'\1', clean)
            clean = re_mod.sub(r'[`]{1,3}\s*action.*', '', clean, flags=re_mod.DOTALL | re_mod.IGNORECASE)
            clean = re_mod.sub(r'\{[^}]*"action"\s*:.*?\}', '', clean, flags=re_mod.DOTALL)
            clean = re_mod.sub(r'\n{3,}', '\n\n', clean).strip()

            if not clean:
                continue

            # Send via WhatsApp and store with dedup tag
            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, clean)
            _store_outbound_message(db, conv.id, clean, wa_sent, tag="unresolved")

            recovered += 1
            print(f"[UNRESOLVED] Replied to conv #{conv.id} ({client_name}) — msg was {msg_age}min old")
            log_event(
                "respuesta",
                f"Mensaje recuperado de {client_name}",
                detail=f"El mensaje tenia {msg_age} min sin respuesta. Ya lo resolvi.",
                contact_name=client_name, conv_id=conv.id,
                status="ok",
            )

            time.sleep(5)

        except Exception as e:
            print(f"[UNRESOLVED] Error for conv #{conv.id}: {e}")

    if recovered:
        print(f"[UNRESOLVED] Recovered {recovered} conversation(s)")
        log_event("sistema", f"Mensajes recuperados: {recovered}", detail=f"Se respondieron {recovered} conversacion(es) que estaban sin respuesta.", status="ok")


# ============================================================================
# TOKEN HEALTH CHECK — Auto-resume Lina when token is restored
# ============================================================================
def _check_token_health():
    """Check if WA token is valid. Auto-resume Lina if it was paused and token is back."""
    from routes.whatsapp_endpoints import _wa_token_paused, _trigger_token_resume

    if not _wa_token_paused:
        return  # Token is fine, nothing to do

    # Token is paused — check if it's back
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")

    if not token:
        return

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"https://graph.facebook.com/{api_version}/{phone_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                _trigger_token_resume()
                print("[SCHEDULER] Token health check PASSED — Lina resumed!")
            else:
                print(f"[SCHEDULER] Token still expired — Lina remains paused.")
    except Exception as e:
        print(f"[SCHEDULER] Token health check error: {e}")


# ============================================================================
# PROACTIVE RECONNECT — Contact clients overdue for visits
# ============================================================================
_reconnect_ran_today = None  # Track daily execution

def _proactive_reconnect(db):
    """Once daily at ~10 AM, find overdue clients and send them a personalized
    reconnect message via approved WhatsApp template."""
    global _reconnect_ran_today

    now = _now_colombia()
    today = now.date()

    # Only run once per day, between 10:00-10:30 AM
    if _reconnect_ran_today == today:
        return
    if not (10 <= now.hour <= 10 and now.minute < 30):
        return

    _reconnect_ran_today = today

    try:
        from client_intelligence import get_reconnect_candidates
        from database.models import Tenant, MessageTemplate, ClientNote, WhatsAppConversation, WhatsAppMessage

        # Process each active tenant
        tenants = db.query(Tenant).filter(Tenant.is_active == True, Tenant.ai_is_paused == False).all()

        for tenant in tenants:
            candidates = get_reconnect_candidates(tenant.id, limit=5, db=db)
            if not candidates:
                continue

            # Find approved reconnect template for this tenant
            template = db.query(MessageTemplate).filter(
                MessageTemplate.tenant_id == tenant.id,
                MessageTemplate.category == "reactivacion",
                MessageTemplate.status == "approved",
            ).first()

            for client in candidates:
                phone = client.get("phone")
                name = client.get("client_name", "")
                if not phone:
                    continue

                # Check if we already sent a reconnect to this client today
                first_name = name.split()[0] if name else ""

                # Find or create conversation
                conv = db.query(WhatsAppConversation).filter(
                    WhatsAppConversation.wa_contact_phone == phone,
                ).first()

                if template:
                    # Use approved template (works outside 24h window)
                    try:
                        from routes.whatsapp_endpoints import _get_wa_base_url, wa_headers, _get_wa_phone_id
                        import httpx

                        # Build template params
                        params = []
                        for var in (template.variables or []):
                            if var == "nombre":
                                params.append(first_name or "cliente")
                            elif var == "negocio":
                                params.append(tenant.name or "nuestro negocio")
                            elif var == "dias":
                                params.append(str(client.get("days_since", "?")))
                            elif var == "profesional":
                                params.append(client.get("preferred_staff") or "nuestro equipo")
                            elif var == "servicio":
                                params.append(client.get("favorite_service") or "tu servicio favorito")
                            else:
                                params.append("")

                        body_components = [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}] if params else []

                        with httpx.Client(timeout=15) as http:
                            resp = http.post(
                                f"{_get_wa_base_url(db)}/messages",
                                headers=wa_headers(db),
                                json={
                                    "messaging_product": "whatsapp",
                                    "to": phone,
                                    "type": "template",
                                    "template": {
                                        "name": template.slug,
                                        "language": {"code": template.language or "es"},
                                        "components": body_components,
                                    },
                                },
                            )

                        if resp.status_code == 200:
                            # Log reconnect note to prevent re-sending
                            note = ClientNote(
                                tenant_id=tenant.id,
                                client_id=client["client_id"],
                                content=f"RECONNECT: Mensaje de reactivacion enviado (llevaba {client.get('days_since', '?')} dias sin venir, ciclo normal: {client.get('avg_cycle', '?')} dias)",
                                created_by="lina_ia",
                            )
                            db.add(note)
                            db.commit()

                            log_event("tarea", f"Reconnect enviado a {first_name}", detail=f"Llevaba {client.get('days_since', '?')} dias sin venir (ciclo: {client.get('avg_cycle', '?')}d). Template: {template.slug}", contact_name=name, conv_id=conv.id if conv else None, status="ok", tenant_id=tenant.id)
                        else:
                            log_event("error", f"Reconnect fallido para {first_name}", detail=f"HTTP {resp.status_code}: {resp.text[:200]}", contact_name=name, status="error", tenant_id=tenant.id)

                    except Exception as send_err:
                        log_event("error", f"Error enviando reconnect a {first_name}", detail=str(send_err)[:200], contact_name=name, status="error", tenant_id=tenant.id)
                else:
                    # No approved template — log warning (admin needs to create one)
                    log_event("skip", f"Reconnect pendiente: {first_name} ({client.get('days_since', '?')}d)", detail=f"No hay template de reactivacion aprobada. Crea una en Plantillas y enviala a Meta.", contact_name=name, status="warning", tenant_id=tenant.id)

        print(f"[SCHEDULER] Proactive reconnect completed for {len(tenants)} tenant(s)")

    except Exception as e:
        print(f"[SCHEDULER] Reconnect error: {e}")
        log_event("error", "Error en reconnect automatico", detail=str(e)[:200], status="error")


# ============================================================================
# 8. META TOKEN AUTO-REFRESH — Renew tokens before they expire
# ============================================================================
_last_token_refresh_date = None

def _auto_refresh_meta_tokens(db):
    """Once daily, check all tenant tokens and refresh any expiring within 7 days.
    Reads Meta App credentials from PlatformConfig (DB), not env vars."""
    global _last_token_refresh_date

    now = _now_colombia()
    today = now.date()

    # Only run once per day, at ~6 AM
    if _last_token_refresh_date == today:
        return
    if now.hour != 6:
        return

    _last_token_refresh_date = today

    from database.models import Tenant, PlatformConfig

    # Get Meta App credentials from PlatformConfig
    creds = {}
    configs = db.query(PlatformConfig).filter(
        PlatformConfig.key.in_(["META_APP_ID", "META_APP_SECRET"])
    ).all()
    for c in configs:
        if c.value:
            creds[c.key] = c.value

    # Fallback to env vars
    app_id = creds.get("META_APP_ID", "")
    app_secret = creds.get("META_APP_SECRET", "")

    if not app_id or not app_secret:
        return  # Can't refresh without credentials

    # Find tenants with tokens expiring within 7 days
    threshold = datetime.utcnow() + timedelta(days=7)
    expiring_tenants = (
        db.query(Tenant)
        .filter(
            Tenant.is_active == True,
            Tenant.wa_access_token.isnot(None),
            Tenant.wa_token_expires_at.isnot(None),
            Tenant.wa_token_expires_at <= threshold,
        )
        .all()
    )

    if not expiring_tenants:
        return

    for tenant in expiring_tenants:
        days_left = (tenant.wa_token_expires_at - datetime.utcnow()).days if tenant.wa_token_expires_at else 0
        print(f"[SCHEDULER] Token refresh: {tenant.name} (expires in {days_left} days)")

        try:
            resp = httpx.get(
                f"https://graph.facebook.com/v22.0/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "fb_exchange_token": tenant.wa_access_token,
                },
                timeout=15,
            )

            if resp.status_code == 200:
                token_data = resp.json()
                new_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", 5184000)

                if new_token:
                    tenant.wa_access_token = new_token
                    tenant.wa_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                    db.commit()

                    new_days = expires_in // 86400
                    print(f"[SCHEDULER] Token refreshed for {tenant.name} — valid for {new_days} more days")
                    log_event(
                        "sistema",
                        f"Token Meta renovado automaticamente para {tenant.name}",
                        detail=f"Token valido por {new_days} dias mas. Expira: {tenant.wa_token_expires_at.strftime('%Y-%m-%d')}",
                        status="ok", tenant_id=tenant.id,
                    )
            else:
                error_msg = ""
                try:
                    error_msg = resp.json().get("error", {}).get("message", f"HTTP {resp.status_code}")
                except Exception:
                    error_msg = f"HTTP {resp.status_code}"

                print(f"[SCHEDULER] Token refresh FAILED for {tenant.name}: {error_msg}")
                log_event(
                    "error",
                    f"Fallo renovacion de token para {tenant.name}",
                    detail=f"Error: {error_msg}. Token expira en {days_left} dias. El admin debe reconectar Facebook.",
                    status="error", tenant_id=tenant.id,
                )

        except Exception as e:
            print(f"[SCHEDULER] Token refresh error for {tenant.name}: {e}")

    print(f"[SCHEDULER] Token refresh check complete — {len(expiring_tenants)} tenant(s) checked")


# ============================================================================
# CLOSED-DAY APPOINTMENT CHECK — Proactive error correction
# ============================================================================
_closed_day_last_check = 0  # Timestamp of last check

def _check_closed_day_appointments(db):
    """Check if there are confirmed appointments on days the business is closed.
    If found, cancel them and proactively notify the client via WhatsApp.
    Runs every 5 minutes."""
    global _closed_day_last_check
    from database.models import AIConfig, Tenant

    # Run every 5 minutes
    if time.time() - _closed_day_last_check < 300:
        return
    _closed_day_last_check = time.time()

    now = _now_colombia(db)
    today = now.date()

    day_name = _DAYS_ES[today.weekday()]  # e.g. "domingo"

    # Check each active tenant's business hours
    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    for tenant in tenants:
        config = db.query(AIConfig).filter(
            AIConfig.tenant_id == tenant.id,
            AIConfig.is_active == True
        ).first()
        if not config or not config.system_prompt:
            continue

        prompt_lower = config.system_prompt.lower()

        # Detect if today is a closed day by looking for patterns like "domingo: cerrado" or "domingos cerrados"
        is_closed = False
        for pattern in [
            f"{day_name}: cerrado", f"{day_name}s: cerrado",
            f"{day_name} cerrado", f"{day_name}s cerrado",
            f"cerrado los {day_name}s", f"cerrados los {day_name}s",
            f"no abrimos los {day_name}s", f"no abrimos {day_name}s",
        ]:
            if pattern in prompt_lower:
                is_closed = True
                break

        if not is_closed:
            continue

        print(f"[SCHEDULER] Today ({day_name}) is CLOSED for tenant {tenant.name} — checking appointments...")

        # Find confirmed appointments for today
        todays_apts = db.query(Appointment).filter(
            Appointment.date == today,
            Appointment.tenant_id == tenant.id,
            Appointment.status.in_(["confirmed", "pending"]),
        ).all()

        if not todays_apts:
            print(f"[SCHEDULER] No appointments to fix for {tenant.name}")
            continue

        # Find next open day (check next 7 days)
        next_open_day = None
        for offset in range(1, 8):
            check_date = today + timedelta(days=offset)
            check_day = _DAYS_ES[check_date.weekday()]
            check_closed = False
            for pattern in [
                f"{check_day}: cerrado", f"{check_day}s: cerrado",
                f"{check_day} cerrado", f"{check_day}s cerrado",
                f"cerrado los {check_day}s", f"cerrados los {check_day}s",
            ]:
                if pattern in prompt_lower:
                    check_closed = True
                    break
            if not check_closed:
                next_open_day = check_date
                break

        next_day_str = f"{_DAYS_ES[next_open_day.weekday()]} {next_open_day.strftime('%d/%m')}" if next_open_day else "el proximo dia habil"

        for apt in todays_apts:
            client = db.query(Client).filter(Client.id == apt.client_id).first() if apt.client_id else None
            client_name = client.name if client else apt.client_name
            client_first = client_name.split()[0] if client_name else "cliente"

            # Find conversation to send message
            phone = apt.client_phone or (client.phone if client else None)
            if not phone:
                continue

            clean_phone = normalize_phone(phone)

            # Build correction message
            staff_name = apt.staff_name or "tu profesional"
            service_name = apt.service_name or "tu servicio"
            msg = (
                f"{client_first}, te escribo porque detecte un error con tu cita de hoy. "
                f"Hoy {day_name} estamos cerrados y no debimos agendarla para hoy. Disculpa la confusion!\n\n"
                f"Te la puedo mover para {next_day_str} a las {apt.time} con {staff_name} para {service_name}. "
                f"Te queda bien ese horario?"
            )

            # Send WhatsApp message
            sent = _send_whatsapp_sync(clean_phone, msg, db)

            # Store message in conversation
            conv = db.query(WhatsAppConversation).filter(
                WhatsAppConversation.wa_contact_phone == clean_phone,
                WhatsAppConversation.tenant_id == tenant.id,
            ).first()
            if not conv:
                # Try normalized match
                from sqlalchemy import func
                all_convs = db.query(WhatsAppConversation).filter(
                    WhatsAppConversation.tenant_id == tenant.id
                ).all()
                import re
                clean_digits = re.sub(r'\D', '', clean_phone)[-10:]
                for c in all_convs:
                    c_digits = re.sub(r'\D', '', c.wa_contact_phone or '')[-10:]
                    if c_digits == clean_digits:
                        conv = c
                        break

            if conv:
                wa_msg = WhatsAppMessage(
                    conversation_id=conv.id,
                    direction="outbound",
                    content=msg,
                    message_type="text",
                    status="sent" if sent else "failed",
                    sent_by="lina_ia_correction",
                )
                db.add(wa_msg)
                conv.last_message_at = datetime.utcnow()

            # Cancel the appointment
            apt.status = "cancelled"
            apt.notes = f"Auto-cancelada: {day_name} cerrado. Lina notifico al cliente."
            db.commit()

            status = "enviado" if sent else "fallo envio"
            print(f"[SCHEDULER] Closed-day correction: {client_name} apt {apt.id} cancelled, msg {status}")
            log_event("accion", f"Cita cancelada — {day_name} cerrado",
                      detail=f"{client_name}: {service_name} a las {apt.time}. Notificacion {status}.",
                      conv_id=conv.id if conv else None,
                      contact_name=client_name,
                      status="ok" if sent else "error")


# ============================================================================
# MAIN LOOP
# ============================================================================
def _scheduler_loop():
    """Main scheduler loop — runs in a background thread."""
    print("[SCHEDULER] Started v7 (DB-aware, deploy-safe, off-hours, sweep, token-aware, unresolved detector)")
    print("[SCHEDULER] Features: 30-min reminders, custom reminders, no-show status, morning review, sweep, token health, unresolved messages")
    log_event("sistema", "Lina IA iniciada", detail="Sistema de tareas automaticas activo: recordatorios, seguimientos, revision matutina, verificacion de token.", status="ok")
    # Wait 60 seconds on startup before first check (let everything initialize)
    time.sleep(60)

    while True:
        try:
            # Always check token health (even outside business hours)
            _check_token_health()

            db = SessionLocal()
            try:
                # Check for appointments on closed days (runs once daily, even outside business hours)
                try:
                    _check_closed_day_appointments(db)
                except Exception as e:
                    print(f"[SCHEDULER] Closed-day check error: {e}")

                # Only run appointment-related tasks during business hours
                if _is_business_hours():
                    _check_30min_reminders(db)
                    _check_custom_reminders(db)
                    _execute_pending_tasks(db)

                    # Lina background task worker (bulk operations)
                    try:
                        from lina_task_worker import process_lina_tasks
                        process_lina_tasks(db)
                    except Exception as e:
                        print(f"[SCHEDULER] Lina task worker error: {e}")

                    _morning_review(db)
                    _sweep_missed_conversations(db)
                    _detect_unresolved_messages(db)

                    # Automated workflows engine (all enabled workflows)
                    try:
                        from workflow_engine import run_workflows
                        run_workflows(db)
                    except Exception as e:
                        print(f"[SCHEDULER] Workflow engine error: {e}")

                _check_noshow_followups(db)
                _expire_old_notes(db)

                # Proactive Reconnect — contact overdue clients (once daily at 10 AM)
                try:
                    _proactive_reconnect(db)
                except Exception as e:
                    print(f"[SCHEDULER] Reconnect error: {e}")

                # Meta Token Auto-Refresh — renew tokens expiring within 7 days (once daily at 6 AM)
                try:
                    _auto_refresh_meta_tokens(db)
                except Exception as e:
                    print(f"[SCHEDULER] Token refresh error: {e}")
            finally:
                db.close()
        except Exception as e:
            print(f"[SCHEDULER] Error: {e}")

        time.sleep(SCHEDULER_INTERVAL)


def start_scheduler():
    """Start the scheduler in a daemon thread."""
    thread = threading.Thread(target=_scheduler_loop, daemon=True)
    thread.start()
    print("[SCHEDULER] Background thread launched (v5)")
