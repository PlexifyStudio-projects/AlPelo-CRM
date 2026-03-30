"""Daily tasks — morning review, sweep, unresolved detector, pending tasks.
Extracted from scheduler.py Phase 8."""
import os
from datetime import datetime, timedelta, date
from database.models import (
    Appointment, Client, Staff, Service, ClientNote, Tenant,
    WhatsAppConversation, WhatsAppMessage,
)
from activity_log import log_event

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
            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, clean, db=db)

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

            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, clean, db=db)
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
            tid = getattr(client, 'tenant_id', None)
            conv = _match_phone_to_conversation(db, client.phone, client_name, tenant_id=tid)
            if not conv:
                conv = _create_conversation_for_client(db, client, tenant_id=tid)

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
            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, clean, db=db)
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
            wa_sent = _send_whatsapp_sync(conv.wa_contact_phone, clean, db=db)
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
