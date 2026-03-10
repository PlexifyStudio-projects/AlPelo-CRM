# ============================================================================
# AlPelo - Background Scheduler (v3 — DB-aware, deploy-safe)
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
from routes._helpers import normalize_phone
from activity_log import log_event

WA_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_PHONE_ID}"

SCHEDULER_INTERVAL = 120  # Check every 2 minutes

# Colombia timezone offset (UTC-5)
_COL_OFFSET = timedelta(hours=-5)

def _now_colombia():
    """Current time in Colombia (UTC-5)."""
    return datetime.utcnow() + _COL_OFFSET

# Days of the week in Spanish for suggestions
_DAYS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


def _wa_headers():
    """Read token fresh from env — survives Railway env var updates without redeploy."""
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "") or WA_TOKEN
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _send_whatsapp_sync(phone: str, text: str) -> bool:
    """Send a WhatsApp message synchronously (for use in scheduler thread)."""
    try:
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"{WA_BASE_URL}/messages",
                headers=_wa_headers(),
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
                print(f"[SCHEDULER] WA send failed: {data}")
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


def _find_conversation(db, appt):
    """Find WhatsApp conversation for an appointment's client."""
    conv = None

    # Try by phone in appointment
    if appt.client_phone:
        phone_tail = appt.client_phone[-10:]
        conv = (
            db.query(WhatsAppConversation)
            .filter(WhatsAppConversation.wa_contact_phone.contains(phone_tail))
            .first()
        )

    # Try by client record phone
    if not conv and appt.client_id:
        client = db.query(Client).filter(Client.id == appt.client_id).first()
        if client and client.phone:
            phone_tail = client.phone[-10:]
            conv = (
                db.query(WhatsAppConversation)
                .filter(WhatsAppConversation.wa_contact_phone.contains(phone_tail))
                .first()
            )

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

            # DB-SAFE DEDUP: Check if we already sent a reminder to this conv today
            if _already_sent_today(db, conv.id, "reminder_30min"):
                continue

            client_first, service_name, staff_first = _get_appt_details(db, appt)

            msg = f"Hola {client_first}! Te recordamos que tienes una cita hoy a las {appt.time}"
            if staff_first:
                msg += f" con {staff_first}"
            msg += f" para {service_name}."
            msg += "\n\nTe esperamos en AlPelo Peluqueria (Cabecera) 💈"
            msg += "\n\nSi necesitas cambiar la hora, avisame y lo ajustamos sin problema!"

            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg)
            _store_outbound_message(db, conv.id, msg, wa_sent, tag="reminder_30min")

            print(f"[SCHEDULER] 30-min reminder sent for appt #{appt.id} → {client_first} ({conv.wa_contact_phone})")
            log_event("tarea", f"Recordatorio 30min enviado a {client_first}", detail=f"Cita a las {appt.time} con {staff_first} para {service_name}", contact_name=client_first, conv_id=conv.id, status="ok")


# ============================================================================
# 2. CUSTOM REMINDERS — From PENDIENTE notes ("avisame 10 min antes", etc.)
# ============================================================================
def _check_custom_reminders(db):
    """Handle custom reminder requests (e.g., "avisame 10 minutos antes")."""
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

        # Check for custom reminder notes (8-15 min window for "10 min" requests)
        if 8 <= diff_min <= 15 and appt.client_id:
            pending_notes = (
                db.query(ClientNote)
                .filter(ClientNote.client_id == appt.client_id)
                .filter(ClientNote.content.ilike("%PENDIENTE:%"))
                .filter(
                    ClientNote.content.ilike("%recordar%") |
                    ClientNote.content.ilike("%avisar%") |
                    ClientNote.content.ilike("%aviso%") |
                    ClientNote.content.ilike("%10 minuto%") |
                    ClientNote.content.ilike("%faltando%") |
                    ClientNote.content.ilike("%antes de la cita%") |
                    ClientNote.content.ilike("%antes de su cita%")
                )
                .all()
            )

            if not pending_notes:
                continue

            conv = _find_conversation(db, appt)
            if not conv:
                continue

            # DB-SAFE DEDUP: Check if we already sent a custom reminder to this conv today
            if _already_sent_today(db, conv.id, "reminder_custom"):
                continue

            client_first, service_name, staff_first = _get_appt_details(db, appt)

            msg = f"Hola {client_first}! Como me pediste, te aviso que tu cita es en 10 minutos"
            if staff_first:
                msg += f" con {staff_first}"
            msg += f" para {service_name}."
            msg += " Nos vemos! 💈"

            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg)
            _store_outbound_message(db, conv.id, msg, wa_sent, tag="reminder_custom")

            # Resolve the PENDIENTE notes
            for note in pending_notes:
                note.content = note.content.replace("PENDIENTE:", "COMPLETADO:") + f" [Auto-resuelto {now.strftime('%H:%M')}]"
            db.commit()

            print(f"[SCHEDULER] Custom 10-min reminder sent for appt #{appt.id} → {client_first}")
            log_event("tarea", f"Recordatorio personalizado enviado a {client_first}", detail=f"Tarea PENDIENTE completada: recordar 10 min antes de cita", contact_name=client_first, conv_id=conv.id, status="ok")


# ============================================================================
# 3. 24-HOUR NO-SHOW FOLLOW-UP — Re-engagement message
# ============================================================================
def _check_noshow_followups(db):
    """
    Check appointments from yesterday that were no_show or never completed.
    Send a personalized re-engagement message. ONE message per conversation.
    Uses DB for deduplication — survives redeploys.
    """
    now = _now_colombia()
    yesterday = now.date() - timedelta(days=1)

    # Appointments from yesterday still "confirmed" (never showed) or "no_show"
    missed = (
        db.query(Appointment)
        .filter(Appointment.date == yesterday)
        .filter(Appointment.status.in_(["confirmed", "no_show"]))
        .all()
    )

    # Track which conversations we've already handled THIS run
    contacted_convs = set()

    for appt in missed:
        conv = _find_conversation(db, appt)
        if not conv:
            # Mark as no_show so we don't keep checking
            if appt.status == "confirmed":
                appt.status = "no_show"
                db.commit()
            continue

        # Skip if we already handled this conversation in this loop iteration
        if conv.id in contacted_convs:
            if appt.status == "confirmed":
                appt.status = "no_show"
                db.commit()
            continue

        # DB-SAFE DEDUP: Check if we already sent a no-show follow-up to this conv
        # Check from yesterday onwards (covers redeploys)
        if _already_sent_for_date(db, conv.id, "noshow_followup", yesterday):
            contacted_convs.add(conv.id)
            if appt.status == "confirmed":
                appt.status = "no_show"
                db.commit()
            continue

        # SKIP if there's been recent conversation activity (client or Lina talking)
        # Don't interrupt an active conversation with a scheduler message
        recent_activity = (
            db.query(WhatsAppMessage)
            .filter(
                WhatsAppMessage.conversation_id == conv.id,
                WhatsAppMessage.created_at >= now - timedelta(hours=3),
            )
            .first()
        )
        if recent_activity:
            print(f"[SCHEDULER] Skipping no-show follow-up for conv #{conv.id} — active conversation in last 3h")
            contacted_convs.add(conv.id)
            if appt.status == "confirmed":
                appt.status = "no_show"
                db.commit()
            continue

        client_first, service_name, staff_first = _get_appt_details(db, appt)
        suggestion = _suggest_day()

        # Personalized, warm, human-like message
        msg = f"Hola {client_first}, notamos que ayer no pudiste venir"
        if service_name and service_name != "tu servicio":
            msg += f" a tu cita de {service_name}"
        msg += "."

        msg += "\n\nSin embargo, tenemos disponibilidad esta semana para reagendar tu visita."

        if staff_first:
            msg += f" {staff_first} tiene espacio disponible"
            msg += f", te sugiero el {suggestion} si te queda bien."
        else:
            msg += f" Te sugiero el {suggestion} si te queda bien."

        msg += f"\n\nQuedamos atentos {client_first}, gracias! 💈"

        wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg)
        _store_outbound_message(db, conv.id, msg, wa_sent, tag="noshow_followup")
        contacted_convs.add(conv.id)

        # Mark as no_show
        if appt.status == "confirmed":
            appt.status = "no_show"
            db.commit()

        print(f"[SCHEDULER] No-show follow-up sent for appt #{appt.id} → {client_first} (conv #{conv.id})")


# ============================================================================
# 4. EXPIRE OLD PENDIENTE NOTES
# ============================================================================
def _expire_old_notes(db):
    """Mark PENDIENTE notes older than 48h as expired."""
    now = datetime.utcnow()

    old_notes = (
        db.query(ClientNote)
        .filter(ClientNote.content.ilike("%PENDIENTE:%"))
        .filter(
            ClientNote.content.ilike("%recordar%") |
            ClientNote.content.ilike("%avisar%") |
            ClientNote.content.ilike("%faltando%") |
            ClientNote.content.ilike("%antes de%")
        )
        .all()
    )

    for note in old_notes:
        if note.created_at and (now - note.created_at).total_seconds() > 172800:  # 48h
            note.content = note.content.replace("PENDIENTE:", "EXPIRADO:") + f" [Expirado {now.strftime('%d/%m %H:%M')}]"
            db.commit()
            print(f"[SCHEDULER] Expired old reminder note #{note.id}")


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

            # Prefix so Lina knows this is morning follow-up
            morning_context = f"[CONTEXTO: Es la manana siguiente. El cliente escribio anoche fuera de horario. Respondele amablemente, retomando su consulta.]\n\n{latest_inbound}"

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

            ai_response = _call_ai_sync(system_prompt, history, inbound_text)

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
# MAIN LOOP
# ============================================================================
def _scheduler_loop():
    """Main scheduler loop — runs in a background thread."""
    print("[SCHEDULER] Started v5 (DB-aware, deploy-safe, off-hours, sweep)")
    print("[SCHEDULER] Features: 30-min reminders, custom reminders, no-show follow-up, morning review, sweep")
    log_event("sistema", "Lina IA iniciada", detail="Sistema de tareas automaticas activo: recordatorios, seguimientos, revision matutina.", status="ok")
    # Wait 60 seconds on startup before first check (let everything initialize)
    time.sleep(60)

    while True:
        try:
            db = SessionLocal()
            try:
                # Only run appointment-related tasks during business hours
                if _is_business_hours():
                    _check_30min_reminders(db)
                    _check_custom_reminders(db)
                    _morning_review(db)
                    _sweep_missed_conversations(db)

                _check_noshow_followups(db)
                _expire_old_notes(db)
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
