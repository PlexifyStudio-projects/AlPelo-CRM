# ============================================================================
# AlPelo - Background Scheduler
# Runs periodic tasks: appointment reminders, pending task resolution
# ============================================================================

import os
import time
import threading
import httpx
import asyncio
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

# Track which appointments already got reminders (avoid duplicates across runs)
_reminded_appointments: set[int] = set()
# Track which notes have been auto-messaged
_reminded_notes: set[int] = set()

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


def _check_appointment_reminders(db):
    """
    Check for appointments happening within the next 8-12 minutes.
    Send a WhatsApp reminder to the client if they have a conversation.
    """
    now = datetime.utcnow()
    today = now.date()

    # Get all confirmed appointments for today
    appointments = (
        db.query(Appointment)
        .filter(Appointment.date == today)
        .filter(Appointment.status == "confirmed")
        .all()
    )

    for appt in appointments:
        if appt.id in _reminded_appointments:
            continue

        # Parse appointment time
        try:
            hour, minute = map(int, appt.time.split(":"))
            appt_datetime = datetime.combine(today, datetime.min.time().replace(hour=hour, minute=minute))
        except (ValueError, AttributeError):
            continue

        # Check if appointment is 8-15 minutes from now (sweet spot for "10 min reminder")
        diff_minutes = (appt_datetime - now).total_seconds() / 60

        if 8 <= diff_minutes <= 15:
            # Find WhatsApp conversation for this client
            conv = None
            if appt.client_phone:
                phone_normalized = normalize_phone(appt.client_phone)
                conv = (
                    db.query(WhatsAppConversation)
                    .filter(WhatsAppConversation.wa_contact_phone.contains(appt.client_phone[-10:]))
                    .first()
                )

            if not conv and appt.client_id:
                client = db.query(Client).filter(Client.id == appt.client_id).first()
                if client and client.phone:
                    conv = (
                        db.query(WhatsAppConversation)
                        .filter(WhatsAppConversation.wa_contact_phone.contains(client.phone[-10:]))
                        .first()
                    )

            if conv:
                # Build reminder message
                client_first_name = (appt.client_name or "").split()[0] if appt.client_name else ""
                service = db.query(Service).filter(Service.id == appt.service_id).first()
                staff = db.query(Staff).filter(Staff.id == appt.staff_id).first()

                service_name = service.name if service else "tu servicio"
                staff_name = staff.name.split()[0] if staff else ""

                msg = f"Hola {client_first_name}! 👋 Te recuerdo que tu cita es en aproximadamente 10 minutos"
                if staff_name:
                    msg += f" con {staff_name}"
                msg += f" para {service_name}."
                msg += " Te esperamos! 💈"

                # Send via WhatsApp
                wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg)
                _store_outbound_message(db, conv.id, msg, wa_sent)

                # Mark as reminded
                _reminded_appointments.add(appt.id)

                # Resolve any related PENDIENTE notes about reminders for this client
                if appt.client_id:
                    pending_notes = (
                        db.query(ClientNote)
                        .filter(ClientNote.client_id == appt.client_id)
                        .filter(ClientNote.content.ilike("%PENDIENTE:%"))
                        .filter(
                            ClientNote.content.ilike("%recordar%") |
                            ClientNote.content.ilike("%avisar%") |
                            ClientNote.content.ilike("%aviso%") |
                            ClientNote.content.ilike("%reminder%") |
                            ClientNote.content.ilike("%10 minuto%") |
                            ClientNote.content.ilike("%antes de la cita%") |
                            ClientNote.content.ilike("%faltando%")
                        )
                        .all()
                    )
                    for note in pending_notes:
                        note.content = note.content.replace("PENDIENTE:", "COMPLETADO:") + f" [Auto-resuelto {now.strftime('%H:%M')}]"
                    if pending_notes:
                        db.commit()
                        print(f"[SCHEDULER] Resolved {len(pending_notes)} reminder notes for client {appt.client_id}")

                print(f"[SCHEDULER] Sent 10-min reminder for appointment #{appt.id} to {client_first_name} ({conv.wa_contact_phone})")
            else:
                # No conversation found, skip but don't re-check
                _reminded_appointments.add(appt.id)
                print(f"[SCHEDULER] No WA conversation for appointment #{appt.id} ({appt.client_name}), skipping reminder")


def _check_pending_reminder_notes(db):
    """
    Check for PENDIENTE notes that contain time-based reminders we can resolve.
    E.g., "PENDIENTE: Avisar a Luis 10 min antes de su cita"
    """
    now = datetime.utcnow()
    today = now.date()

    # Get pending notes with reminder keywords
    notes = (
        db.query(ClientNote)
        .filter(ClientNote.content.ilike("%PENDIENTE:%"))
        .filter(
            ClientNote.content.ilike("%recordar%") |
            ClientNote.content.ilike("%avisar%") |
            ClientNote.content.ilike("%aviso%") |
            ClientNote.content.ilike("%faltando%") |
            ClientNote.content.ilike("%antes de%")
        )
        .all()
    )

    for note in notes:
        if note.id in _reminded_notes:
            continue

        # Check if this client has an appointment today
        appts_today = (
            db.query(Appointment)
            .filter(Appointment.date == today)
            .filter(Appointment.client_id == note.client_id)
            .filter(Appointment.status == "confirmed")
            .all()
        )

        for appt in appts_today:
            if appt.id in _reminded_appointments:
                # Already handled by appointment reminder check
                note.content = note.content.replace("PENDIENTE:", "COMPLETADO:") + f" [Auto-resuelto {now.strftime('%H:%M')}]"
                _reminded_notes.add(note.id)
                db.commit()
                break

    # Also: mark notes as expired if they reference a time that already passed
    for note in notes:
        if note.id in _reminded_notes:
            continue

        # If the note is older than 24h and references a reminder, mark as expired
        if note.created_at and (now - note.created_at).total_seconds() > 86400:
            note.content = note.content.replace("PENDIENTE:", "EXPIRADO:") + f" [Expirado {now.strftime('%d/%m %H:%M')}]"
            _reminded_notes.add(note.id)
            db.commit()
            print(f"[SCHEDULER] Expired old reminder note #{note.id}")


def _scheduler_loop():
    """Main scheduler loop — runs in a background thread."""
    print("[SCHEDULER] Started — checking every 2 minutes")
    # Wait 30 seconds on startup before first check
    time.sleep(30)

    while True:
        try:
            db = SessionLocal()
            try:
                _check_appointment_reminders(db)
                _check_pending_reminder_notes(db)
            finally:
                db.close()
        except Exception as e:
            print(f"[SCHEDULER] Error: {e}")

        # Clear old reminded appointments (keep set from growing forever)
        today = date.today()
        if len(_reminded_appointments) > 200:
            _reminded_appointments.clear()
        if len(_reminded_notes) > 200:
            _reminded_notes.clear()

        time.sleep(SCHEDULER_INTERVAL)


def start_scheduler():
    """Start the scheduler in a daemon thread."""
    thread = threading.Thread(target=_scheduler_loop, daemon=True)
    thread.start()
    print("[SCHEDULER] Background thread launched")
