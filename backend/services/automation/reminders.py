"""30min + custom reminders.
Extracted from scheduler.py Phase 8."""
from datetime import datetime, timedelta, date
from database.models import Appointment, Client, Staff, Service, ClientNote, Tenant
from activity_log import log_event

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
            if not conv and appt.client_id:
                client = db.query(Client).filter(Client.id == appt.client_id).first()
                if client and client.phone:
                    conv = _create_conversation_for_client(db, client, tenant_id=getattr(appt, 'tenant_id', None))
            if not conv:
                print(f"[SCHEDULER] No WA conv for appt #{appt.id} ({appt.client_name}), skip 30min reminder")
                continue

            # DB-SAFE DEDUP: per appointment ID (not per conversation — client may have 2+ appointments)
            if _already_sent_today(db, conv.id, f"reminder_30min_{appt.id}"):
                continue

            # GLOBAL RATE LIMIT: prevent spam (max 3/hour, 6/day per client)
            if _conv_rate_limited(db, conv.id):
                print(f"[SCHEDULER] Rate-limited: skipping 30min reminder for {appt.client_name} (too many messages)")
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
                    from services.whatsapp.template_sender import send_template_sync
                    params = [client_first, appt.time, staff_first or "tu profesional", service_name]
                    wa_sent = send_template_sync(conv.wa_contact_phone, "recordatorio_de_cita_1h", parameters=params, db=db)
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

            # Push notification to the STAFF member assigned to this appointment
            try:
                from push_sender import send_push
                if appt.staff_id:
                    send_push(
                        tenant_id=appt.tenant_id,
                        title=f"Cita en 30 min — {client_first}",
                        body=f"{service_name} a las {appt.time}",
                        url="/agenda",
                        user_type="staff",
                        user_id=appt.staff_id,
                    )
                # Also notify admin
                send_push(
                    tenant_id=appt.tenant_id,
                    title=f"Proxima cita: {client_first}",
                    body=f"{service_name} a las {appt.time} con {staff_first}",
                    url="/agenda",
                    user_type="admin",
                )
            except Exception:
                pass


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
        if not conv and best_appt.client_id:
            client = db.query(Client).filter(Client.id == best_appt.client_id).first()
            if client and client.phone:
                conv = _create_conversation_for_client(db, client, tenant_id=getattr(best_appt, 'tenant_id', None))
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
        if _conv_rate_limited(db, conv.id):
            continue
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

        wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, msg, db=db)
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


