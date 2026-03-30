"""No-show follow-ups + expire old notes.
Extracted from scheduler.py Phase 8."""
from datetime import datetime, timedelta, date
from database.models import Appointment, Client, ClientNote
from activity_log import log_event

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

        # Expire if older than 30 days
        if note.created_at and (now - note.created_at).total_seconds() > 2592000:
            should_expire = True
            expire_reason = "tarea tenia mas de 30 dias"

        # Expire reminder notes if the referenced appointment has passed
        if not should_expire and note.created_at:
            note_lower = note.content.lower()
            _is_reminder = any(kw in note_lower for kw in ["recordatorio", "avisar", "aviso", "min antes", "minutos antes"])
            if _is_reminder:
                # Check if client has any upcoming appointments (today or future)
                col_now = _now_colombia()
                client_future_apts = (
                    db.query(Appointment)
                    .filter(
                        Appointment.client_id == note.client_id,
                        Appointment.date >= col_now.date(),
                        Appointment.status.in_(["confirmed", "completed", "paid"]),
                    )
                    .all()
                )
                # Check if ALL future appointments have already passed
                all_passed = True
                for a in client_future_apts:
                    if a.date > col_now.date():
                        # Future date — not passed yet
                        all_passed = False
                        break
                    try:
                        ah, am = map(int, a.time.split(":"))
                        if ah * 60 + am > col_now.hour * 60 + col_now.minute - 5:
                            all_passed = False
                            break
                    except (ValueError, AttributeError):
                        pass
                if not client_future_apts or all_passed:
                    should_expire = True
                    expire_reason = "todas las citas ya pasaron"

        if should_expire:
            for prefix in ["PENDIENTE:", "RECORDATORIO:"]:
                note.content = note.content.replace(prefix, "EXPIRADO:")
            note.content += f" [Expirado — {expire_reason} {now.strftime('%d/%m %H:%M')}]"
            db.commit()
            print(f"[SCHEDULER] Expired note #{note.id}: {expire_reason}")


# ============================================================================
# 5. MORNING REVIEW — Process unread chats when AI reactivates at 7:30 AM
# ============================================================================
