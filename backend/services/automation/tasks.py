"""Staff briefings, closed day checks, reconnect, daily summary.
Extracted from scheduler.py Phase 8."""
import os
import time
from datetime import datetime, timedelta, date
from sqlalchemy import func
from database.models import (
    Appointment, Client, Staff, Service, Tenant,
    WhatsAppConversation, WhatsAppMessage,
)
from activity_log import log_event
from routes._helpers import now_colombia as _now_colombia, normalize_phone
from services.automation.helpers import _send_whatsapp_sync, _DAYS_ES

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

    now = _now_colombia()
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
                f"{client_first}, te pido disculpas. Cometí un error al agendar tu cita para hoy — "
                f"los {day_name}s no estamos en servicio.\n\n"
                f"¿Te parece bien si te la muevo para {next_day_str} a las {apt.time} con {staff_name} "
                f"para tu {service_name}? Quedo atenta."
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
# DAILY SUMMARY PUSH — End of day report to admin
# ============================================================================
_daily_summary_sent = {}

def _daily_summary_push(db):
    """Send a push notification to admin with today's summary at ~8 PM."""
    now = _now_colombia()
    if now.hour != 20:  # Only at 8 PM
        return

    today_key = now.strftime("%Y-%m-%d")
    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()

    for tenant in tenants:
        cache_key = f"{tenant.id}_{today_key}"
        if cache_key in _daily_summary_sent:
            continue

        try:
            today = now.date()
            # Count today's appointments
            appts_today = db.query(Appointment).filter(
                Appointment.tenant_id == tenant.id,
                Appointment.date == today,
            ).all()
            total_appts = len(appts_today)
            completed = len([a for a in appts_today if a.status == "completed"])
            no_shows = len([a for a in appts_today if a.status == "no_show"])

            # Calculate today's revenue from completed appointments
            revenue = sum(a.price or 0 for a in appts_today if a.status == "completed")

            # New clients today
            new_clients = db.query(Client).filter(
                Client.tenant_id == tenant.id,
                func.date(Client.created_at) == today,
            ).count()

            if total_appts == 0 and new_clients == 0:
                _daily_summary_sent[cache_key] = True
                continue

            # Build summary
            parts = []
            if completed > 0:
                parts.append(f"{completed} citas completadas")
            if no_shows > 0:
                parts.append(f"{no_shows} no-show")
            if revenue > 0:
                parts.append(f"${revenue:,.0f} generados")
            if new_clients > 0:
                parts.append(f"{new_clients} clientes nuevos")

            body = " | ".join(parts) if parts else f"{total_appts} citas hoy"

            from push_sender import send_push
            send_push(
                tenant_id=tenant.id,
                title="Resumen del dia",
                body=body,
                url="/dashboard",
                user_type="admin",
            )

            _daily_summary_sent[cache_key] = True
            print(f"[SCHEDULER] Daily summary push sent for tenant {tenant.id}: {body}")
        except Exception as e:
            print(f"[SCHEDULER] Daily summary error for tenant {tenant.id}: {e}")


