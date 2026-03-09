# ============================================================================
# AlPelo - Background Scheduler
# Runs periodic tasks:
#   1. 30-min default reminder for ALL appointments
#   2. Custom reminders from PENDIENTE notes (e.g. "avisame 10 min antes")
#   3. 24-hour no-show follow-up to re-engage clients
#   4. Expire old PENDIENTE notes
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

WA_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_PHONE_ID}"

# Track what we've already processed (avoid duplicates across scheduler runs)
_reminded_30min: set[int] = set()      # appointment IDs that got 30-min reminder
_reminded_custom: set[int] = set()     # appointment IDs that got custom reminder (10 min, etc.)
_reminded_notes: set[int] = set()      # note IDs already processed
_followed_up: set[int] = set()         # appointment IDs that got 24h no-show follow-up

SCHEDULER_INTERVAL = 120  # Check every 2 minutes


def _wa_headers():
    return {
        "Authorization": f"Bearer {WA_TOKEN}",
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


def _store_outbound_message(db, conv_id: int, text: str, wa_sent: bool):
    """Store a Lina IA outbound message in the DB."""
    msg = WhatsAppMessage(
        conversation_id=conv_id,
        wa_message_id=None,
        direction="outbound",
        content=text,
        message_type="text",
        status="sent" if wa_sent else "failed",
        sent_by="lina_ia",
    )
    db.add(msg)
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if conv:
        conv.last_message_at = datetime.utcnow()
    db.commit()


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


# ============================================================================
# 1. DEFAULT 30-MINUTE REMINDER — For ALL confirmed appointments
# ============================================================================
def _check_30min_reminders(db):
    """Send reminder 30 minutes before every confirmed appointment."""
    now = datetime.utcnow()
    today = now.date()

    appointments = (
        db.query(Appointment)
        .filter(Appointment.date == today)
        .filter(Appointment.status == "confirmed")
        .all()
    )

    for appt in appointments:
        if appt.id in _reminded_30min:
            continue

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
                _reminded_30min.add(appt.id)
                print(f"[SCHEDULER] No WA conv for appt #{appt.id} ({appt.client_name}), skip 30min reminder")
                continue

            client_first, service_name, staff_first = _get_appt_details(db, appt)

            msg = f"Hola {client_first}! 😊 Te recordamos que tienes una cita hoy a las {appt.time}"
            if staff_first:
                msg += f" con {staff_first}"
            msg += f" para {service_name}."
            msg += "\n\nTe esperamos en AlPelo Peluqueria (Cabecera) 💈"
            msg += "\n\nSi necesitas cambiar la hora, avisame y lo ajustamos sin problema!"

            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg)
            _store_outbound_message(db, conv.id, msg, wa_sent)
            _reminded_30min.add(appt.id)

            print(f"[SCHEDULER] 30-min reminder sent for appt #{appt.id} → {client_first} ({conv.wa_contact_phone})")


# ============================================================================
# 2. CUSTOM REMINDERS — From PENDIENTE notes ("avisame 10 min antes", etc.)
# ============================================================================
def _check_custom_reminders(db):
    """Handle custom reminder requests (e.g., "avisame 10 minutos antes")."""
    now = datetime.utcnow()
    today = now.date()

    appointments = (
        db.query(Appointment)
        .filter(Appointment.date == today)
        .filter(Appointment.status == "confirmed")
        .all()
    )

    for appt in appointments:
        if appt.id in _reminded_custom:
            continue

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
                _reminded_custom.add(appt.id)
                continue

            client_first, service_name, staff_first = _get_appt_details(db, appt)

            # More personal message — this was explicitly requested by the client
            msg = f"Hola {client_first}! 👋 Como me pediste, te aviso que tu cita es en 10 minutos"
            if staff_first:
                msg += f" con {staff_first}"
            msg += f" para {service_name}."
            msg += " Nos vemos! 💈"

            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg)
            _store_outbound_message(db, conv.id, msg, wa_sent)
            _reminded_custom.add(appt.id)

            # Resolve the PENDIENTE notes
            for note in pending_notes:
                note.content = note.content.replace("PENDIENTE:", "COMPLETADO:") + f" [Auto-resuelto {now.strftime('%H:%M')}]"
                _reminded_notes.add(note.id)
            db.commit()

            print(f"[SCHEDULER] Custom 10-min reminder sent for appt #{appt.id} → {client_first}")


# ============================================================================
# 3. 24-HOUR NO-SHOW FOLLOW-UP — Re-engagement message
# ============================================================================
def _check_noshow_followups(db):
    """
    Check appointments from yesterday that were no_show or never completed.
    Send a friendly re-engagement message offering to reschedule.
    """
    now = datetime.utcnow()
    yesterday = now.date() - timedelta(days=1)

    # Appointments from yesterday that are still "confirmed" (never showed up)
    # or explicitly marked as "no_show"
    missed = (
        db.query(Appointment)
        .filter(Appointment.date == yesterday)
        .filter(Appointment.status.in_(["confirmed", "no_show"]))
        .all()
    )

    for appt in missed:
        if appt.id in _followed_up:
            continue

        conv = _find_conversation(db, appt)
        if not conv:
            _followed_up.add(appt.id)
            continue

        client_first, service_name, staff_first = _get_appt_details(db, appt)

        # Friendly, non-accusatory re-engagement message
        msg = f"Hola {client_first}! 😊 Vimos que no pudiste asistir a tu cita de ayer"
        if service_name != "tu servicio":
            msg += f" ({service_name})"
        msg += "."
        msg += "\n\nNo te preocupes, estas cosas pasan! Si quieres, podemos reagendar para cuando te quede mejor."
        msg += "\n\nSolo dime el dia y la hora que prefieras y te la agendo de una 📅"

        wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg)
        _store_outbound_message(db, conv.id, msg, wa_sent)
        _followed_up.add(appt.id)

        # If appointment was still "confirmed" (never updated), mark as no_show
        if appt.status == "confirmed":
            appt.status = "no_show"
            db.commit()

        print(f"[SCHEDULER] 24h no-show follow-up sent for appt #{appt.id} → {client_first}")


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
        if note.id in _reminded_notes:
            continue
        if note.created_at and (now - note.created_at).total_seconds() > 172800:  # 48h
            note.content = note.content.replace("PENDIENTE:", "EXPIRADO:") + f" [Expirado {now.strftime('%d/%m %H:%M')}]"
            _reminded_notes.add(note.id)
            db.commit()
            print(f"[SCHEDULER] Expired old reminder note #{note.id}")


# ============================================================================
# MAIN LOOP
# ============================================================================
def _scheduler_loop():
    """Main scheduler loop — runs in a background thread."""
    print("[SCHEDULER] Started — checking every 2 minutes")
    print("[SCHEDULER] Features: 30-min reminders, custom reminders, 24h no-show follow-up")
    # Wait 30 seconds on startup before first check
    time.sleep(30)

    while True:
        try:
            db = SessionLocal()
            try:
                _check_30min_reminders(db)
                _check_custom_reminders(db)
                _check_noshow_followups(db)
                _expire_old_notes(db)
            finally:
                db.close()
        except Exception as e:
            print(f"[SCHEDULER] Error: {e}")

        # Clear tracking sets daily to prevent memory growth
        if len(_reminded_30min) > 300:
            _reminded_30min.clear()
        if len(_reminded_custom) > 300:
            _reminded_custom.clear()
        if len(_reminded_notes) > 300:
            _reminded_notes.clear()
        if len(_followed_up) > 300:
            _followed_up.clear()

        time.sleep(SCHEDULER_INTERVAL)


def start_scheduler():
    """Start the scheduler in a daemon thread."""
    thread = threading.Thread(target=_scheduler_loop, daemon=True)
    thread.start()
    print("[SCHEDULER] Background thread launched")
