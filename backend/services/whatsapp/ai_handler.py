"""
WhatsApp AI Auto-Reply Handler — Lina responds to incoming messages.
Extracted from whatsapp_endpoints.py during Phase 7 refactor.
"""
import os
import json
import random
import re
import asyncio
import httpx
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.connection import SessionLocal, get_db
from database.models import (
    Client, Staff, Service, Appointment, Tenant, AIConfig,
    WhatsAppConversation, WhatsAppMessage, ClientNote,
)
from services.whatsapp.helpers import (
    _in_flight_convs, _pending_queue, _PENDING_QUEUE_MAX,
    _ai_reply_timestamps, _AI_REPLY_MAX, _AI_REPLY_WINDOW,
    _is_off_hours, _off_hours_greeting, _wa_token_paused,
    _is_token_error, _trigger_token_pause, _trigger_token_resume,
    _get_wa_config_cached, wa_headers, _get_wa_base_url,
    _transcribe_audio, _download_media_base64, _send_read_receipt,
)
from ai_security import detect_prompt_injection, validate_response, clean_response_for_whatsapp
from sentiment_analyzer import analyze_sentiment
from activity_log import log_event
from routes._helpers import normalize_phone, safe_tid, now_colombia as _now_colombia


async def ai_auto_reply(conv_id: int, to_phone: str, inbound_text: str, inbound_wa_msg_id: str = None, needs_transcription: bool = False, media_id: str = None, needs_vision: bool = False, media_mime: str = None, is_catchup: bool = False):
    """Background task: mark as read, wait, generate AI response, send. Supports image vision.
    When is_catchup=True, skips off-hours check and reduces delay (admin explicitly re-enabled AI)."""
    import time
    import base64

    image_data_b64 = None
    image_media_type = None

    try:
        # Step -1: In-flight lock — prevent concurrent replies to same conversation
        if conv_id in _in_flight_convs:
            # Queue the message instead of dropping it
            if conv_id not in _pending_queue:
                _pending_queue[conv_id] = []
            if len(_pending_queue[conv_id]) < _PENDING_QUEUE_MAX:
                _pending_queue[conv_id].append(inbound_text)
                log_event("sistema", "Mensaje encolado (Lina ocupada)", detail=f"Cola: {len(_pending_queue[conv_id])} mensaje(s) pendiente(s). Se procesara al terminar.", conv_id=conv_id, status="info")
            else:
                log_event("skip", "Cola llena — mensaje descartado", detail=f"Ya hay {_PENDING_QUEUE_MAX} mensajes en cola.", conv_id=conv_id, status="warning")
            return
        _in_flight_convs.add(conv_id)

        # Step -0.5: Token pause check — skip if token is dead
        if _wa_token_paused:
            print(f"[Lina IA] Token paused — skipping reply for conv {conv_id}")
            log_event("skip", "Token expirado — respuesta en pausa", detail="Esperando a que se renueve el token de WhatsApp.", conv_id=conv_id, status="warning")
            return

        # Step -0.4: PROMPT INJECTION PROTECTION
        from ai_security import detect_prompt_injection, get_safe_response_for_injection
        is_injection, matched = detect_prompt_injection(inbound_text or "")
        if is_injection:
            print(f"[Lina IA] PROMPT INJECTION BLOCKED for conv {conv_id}: '{matched}'")
            log_event("sistema", f"Intento de manipulación bloqueado", detail=f"Patrón detectado: {matched}", conv_id=conv_id, status="warning")
            # Send safe generic response instead of processing with AI
            safe_response = get_safe_response_for_injection()
            try:
                async with httpx.AsyncClient(timeout=15) as http:
                    await http.post(
                        f"{_get_wa_base_url(db)}/messages", headers=wa_headers(db),
                        json={"messaging_product": "whatsapp", "to": normalize_phone(to_phone),
                              "type": "text", "text": {"body": safe_response}},
                    )
            except Exception:
                pass
            db = SessionLocal()
            try:
                msg = WhatsAppMessage(
                    conversation_id=conv_id, wa_message_id=None, direction="outbound",
                    content=safe_response, message_type="text", status="sent", sent_by="lina_ia",
                )
                db.add(msg)
                conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
                if conv:
                    conv.last_message_at = datetime.utcnow()
                db.commit()
            finally:
                db.close()
            return

        # Step 0: Read receipt is sent LATER (right before Lina's response) so the client
        # sees blue ticks only when Lina is about to reply, not immediately.
        # OFF-HOURS: Removed hardcoded check. Lina decides based on the business context
        # prompt (each agency has different hours/timezone). She'll mention closing time
        # naturally if it's relevant.

        # Step 0.5a: Transcribe audio if needed
        if needs_transcription and media_id:
            print(f"[Lina IA] Transcribing audio for conv {conv_id}...")
            _audio_db = SessionLocal()
            try:
                transcript = await _transcribe_audio(media_id, db=_audio_db)
            finally:
                _audio_db.close()
            inbound_text = f"[Audio del cliente]: {transcript}"
            print(f"[Lina IA] Transcript: {transcript[:100]}...")

            db_temp = SessionLocal()
            try:
                last_inbound = (
                    db_temp.query(WhatsAppMessage)
                    .filter(
                        WhatsAppMessage.conversation_id == conv_id,
                        WhatsAppMessage.direction == "inbound",
                        WhatsAppMessage.message_type == "audio",
                    )
                    .order_by(WhatsAppMessage.created_at.desc())
                    .first()
                )
                if last_inbound and last_inbound.content.startswith("📎"):
                    last_inbound.content = f"🎤 {transcript}"
                    db_temp.commit()
            finally:
                db_temp.close()

        # Step 0.5b: Download image for Claude Vision
        if needs_vision and media_id:
            print(f"[Lina IA] Downloading image for vision (conv {conv_id})...")
            _vision_db = SessionLocal()
            try:
                raw_bytes, detected_mime = await _download_media_base64(media_id, db=_vision_db)
            finally:
                _vision_db.close()
            if raw_bytes:
                mime_map = {"image/jpeg": "image/jpeg", "image/png": "image/png", "image/gif": "image/gif", "image/webp": "image/webp"}
                image_media_type = mime_map.get(detected_mime, "image/jpeg")
                image_data_b64 = base64.standard_b64encode(raw_bytes).decode("utf-8")
                if not inbound_text or inbound_text.startswith("📎"):
                    inbound_text = "[El cliente envio esta imagen]"
                print(f"[Lina IA] Image ready ({len(raw_bytes)} bytes, {image_media_type})")
            else:
                print(f"[Lina IA] Could not download image")
                if not inbound_text or inbound_text.startswith("📎"):
                    inbound_text = "[El cliente envio una imagen pero no se pudo descargar. Dile que recibiste la imagen pero no cargo, y preguntale que necesita.]"

        # Step 1: Wait random delay (shorter for catchup, natural for live messages)
        # Get contact name for logging
        _log_db = SessionLocal()
        _log_contact = ""
        try:
            _log_conv = _log_db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
            _log_contact = _log_conv.wa_contact_name if _log_conv else ""
        finally:
            _log_db.close()

        if is_catchup:
            delay = random.randint(3, 8)
            print(f"[Lina IA] CATCHUP — waiting {delay}s before replying to conv {conv_id}...")
            log_event("sistema", "Recuperando mensajes pendientes", detail=f"Preparando respuesta (demora {delay}s)", conv_id=conv_id, contact_name=_log_contact, status="info")
        else:
            delay = random.randint(20, 40)
            print(f"[Lina IA] Waiting {delay}s before replying to conv {conv_id}...")
            log_event("sistema", "Preparando respuesta", detail=f"Leyendo conversacion y escribiendo ({delay}s)", conv_id=conv_id, contact_name=_log_contact, status="info")
        await asyncio.sleep(delay)

        # Step 1.3: DEBOUNCE — After delay, check if MORE messages arrived during the wait.
        # If so, the last messages contain the full intent. Re-read from DB.
        try:
            _debounce_db = SessionLocal()
            try:
                _latest_inbound = (
                    _debounce_db.query(WhatsAppMessage)
                    .filter(
                        WhatsAppMessage.conversation_id == conv_id,
                        WhatsAppMessage.direction == "inbound",
                    )
                    .order_by(WhatsAppMessage.created_at.desc())
                    .first()
                )
                if _latest_inbound and _latest_inbound.content:
                    _latest_text = _latest_inbound.content.strip()
                    if _latest_text and _latest_text != (inbound_text or "").strip():
                        # New messages arrived during delay — combine all pending inbound
                        _recent_inbound = (
                            _debounce_db.query(WhatsAppMessage)
                            .filter(
                                WhatsAppMessage.conversation_id == conv_id,
                                WhatsAppMessage.direction == "inbound",
                            )
                            .order_by(WhatsAppMessage.created_at.desc())
                            .limit(6)
                            .all()
                        )
                        _recent_inbound.reverse()
                        # Find messages that came AFTER the last Lina reply
                        _last_lina = (
                            _debounce_db.query(WhatsAppMessage)
                            .filter(
                                WhatsAppMessage.conversation_id == conv_id,
                                WhatsAppMessage.sent_by.like("lina_ia%"),
                            )
                            .order_by(WhatsAppMessage.created_at.desc())
                            .first()
                        )
                        _lina_time = _last_lina.created_at if _last_lina else None
                        _new_msgs = []
                        for m in _recent_inbound:
                            if _lina_time and m.created_at and m.created_at <= _lina_time:
                                continue
                            if m.content and not m.content.startswith("📎"):
                                _new_msgs.append(m.content)
                        if len(_new_msgs) > 1:
                            inbound_text = "\n".join(_new_msgs)
                            print(f"[Lina IA] DEBOUNCE: Combined {len(_new_msgs)} messages for conv {conv_id}: {inbound_text[:100]}")
            finally:
                _debounce_db.close()
        except Exception as debounce_err:
            print(f"[Lina IA] Debounce error (non-critical): {debounce_err}")

        # Step 1.5: Check global rate limit — max 10 AI replies per 60 seconds
        now = time.time()
        # Prune old timestamps
        _ai_reply_timestamps[:] = [t for t in _ai_reply_timestamps if now - t < _AI_REPLY_WINDOW]
        if len(_ai_reply_timestamps) >= _AI_REPLY_MAX:
            print(f"[Lina IA] Global rate limit reached ({_AI_REPLY_MAX}/min). Skipping conv {conv_id}.")
            log_event("skip", "Limite de mensajes por minuto alcanzado", detail=f"Maximo {_AI_REPLY_MAX} respuestas por minuto. Reintentare en el proximo ciclo.", conv_id=conv_id, status="warning")
            return

        # Step 2: Check per-conversation cooldown — skip if Lina already replied in last 15 seconds
        db = SessionLocal()
        try:
            conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
            if not conv or not conv.is_ai_active:
                log_event("skip", "IA desactivada en esta conversacion", conv_id=conv_id, contact_name=conv.wa_contact_name if conv else "", status="info")
                return

            # Check tenant-level AI pause — if paused, just stay silent (no message sent)
            from database.models import Tenant
            # Get tenant from conversation
            conv_tenant_id = conv.tenant_id if hasattr(conv, 'tenant_id') and conv.tenant_id else None
            if conv_tenant_id:
                tenant = db.query(Tenant).filter(Tenant.id == conv_tenant_id).first()
            else:
                tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
            if tenant and tenant.ai_is_paused:
                log_event("skip", "IA pausada a nivel de agencia", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="warning")
                return

            # Check message limit — use persistent counter (survives chat deletion)
            if tenant and tenant.messages_limit and tenant.messages_limit > 0:
                lina_msg_count = tenant.messages_used or 0
                if lina_msg_count >= tenant.messages_limit:
                    # Auto-pause Lina
                    if not tenant.ai_is_paused:
                        tenant.ai_is_paused = True
                        db.commit()
                        log_event("limit", f"Limite de mensajes alcanzado ({lina_msg_count}/{tenant.messages_limit}) — Lina pausada automaticamente", status="error")
                    return

            last_ai_msg = (
                db.query(WhatsAppMessage)
                .filter(
                    WhatsAppMessage.conversation_id == conv_id,
                    WhatsAppMessage.sent_by == "lina_ia",
                )
                .order_by(WhatsAppMessage.created_at.desc())
                .first()
            )
            if last_ai_msg and last_ai_msg.created_at:
                seconds_since = (datetime.utcnow() - last_ai_msg.created_at).total_seconds()
                if seconds_since < 15:
                    print(f"[Lina IA] Cooldown active for conv {conv_id} ({seconds_since:.0f}s ago). Skipping.")
                    log_event("skip", "Esperando entre respuestas", detail=f"Ultima respuesta hace {int(seconds_since)}s. Espero 15s entre mensajes para no saturar.", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")
                    return

            # Step 2.5: Goodbye detection — if Lina recently said goodbye and client sends short farewell
            GOODBYE_WORDS = [
                "hasta luego", "nos vemos", "buen dia", "que estes bien", "que te vaya bien",
                "que te quede", "cuídate", "cuidate", "fue un placer", "buena tarde",
                "buenas noches", "hasta pronto", "un abrazo", "feliz dia", "feliz tarde",
            ]
            CLIENT_BYE_WORDS = [
                "bye", "byee", "byeee", "chao", "adios", "adiós", "nos vemos", "hasta luego",
                "gracias", "ok gracias", "listo gracias", "vale", "bueno", "dale", "igualmente",
                "igual", "grax", "ty", "thanks", "tkm", "chau",
            ]
            if last_ai_msg and last_ai_msg.content and last_ai_msg.created_at:
                # Only trigger if Lina's bye was within last 10 minutes (not a stale old goodbye)
                seconds_since_bye = (datetime.utcnow() - last_ai_msg.created_at).total_seconds()
                inbound_lower = inbound_text.lower().strip() if inbound_text else ""
                inbound_word_count = len(inbound_lower.split()) if inbound_lower else 0

                if seconds_since_bye < 600 and inbound_word_count <= 4:
                    last_ai_lower = last_ai_msg.content.lower()
                    lina_said_bye = any(gw in last_ai_lower for gw in GOODBYE_WORDS)
                    client_says_bye = any(cw == inbound_lower or inbound_lower.startswith(cw + " ") or inbound_lower.endswith(" " + cw) or cw in inbound_lower.split() for cw in CLIENT_BYE_WORDS)
                    if lina_said_bye and client_says_bye:
                        print(f"[Lina IA] Goodbye detected — Lina said bye {int(seconds_since_bye)}s ago, client replied '{inbound_lower}'. Staying silent for conv {conv_id}.")
                        log_event("skip", "Conversacion cerrada — no respondo", detail=f"Ya me despedi hace {int(seconds_since_bye)}s y el cliente respondio '{inbound_lower}'. No es una nueva consulta.", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")
                        return

            # Step 3: Get conversation history and generate AI response
            # 15 messages is sufficient context — saves ~1,500 tokens vs 40
            recent_msgs = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == conv_id)
                .order_by(WhatsAppMessage.created_at.desc())
                .limit(15)
                .all()
            )
            recent_msgs.reverse()

            # Collect ALL recent inbound messages that came after the last Lina reply
            # This ensures we don't miss any text sent alongside/after an image
            pending_inbound = []
            for m in reversed(recent_msgs):
                if m.direction == "inbound":
                    pending_inbound.append(m.content)
                elif m.sent_by == "lina_ia":
                    pending_inbound = []  # Reset — only care about msgs after last AI reply

            # Combine pending inbound messages BUT keep the CURRENT message as priority
            # inbound_text already has the LATEST message (the one that triggered this reply)
            # pending_inbound has ALL messages since last Lina reply (including old ones)
            # Strategy: put old context first, then the CURRENT message last (most important)
            _current_msg = inbound_text  # Save the original trigger message
            if len(pending_inbound) > 1:
                # Filter out the current message from pending to avoid duplication
                other_msgs = [t for t in pending_inbound if t and t.strip() != (_current_msg or "").strip() and not t.startswith("📎")]
                if other_msgs:
                    context_text = "\n".join(other_msgs)
                    inbound_text = f"{context_text}\n\n{_current_msg}"
                    print(f"[Lina IA] Combined {len(other_msgs)} old + current message: ...{_current_msg[:80]}")

            # Build history with proper role alternation (Claude API requires user/assistant/user/assistant)
            raw_history = []
            for m in recent_msgs:
                role = "user" if m.direction == "inbound" else "assistant"
                # Skip off-hours template — it confuses the AI into repeating "mañana abrimos"
                if m.sent_by == "lina_ia_offhours":
                    continue
                content = m.content or ""
                if not content.strip():
                    continue
                raw_history.append({"role": role, "content": content})

            # Merge consecutive same-role messages to ensure proper alternation
            history = []
            for entry in raw_history:
                if history and history[-1]["role"] == entry["role"]:
                    history[-1]["content"] += "\n" + entry["content"]
                else:
                    history.append(dict(entry))

            from routes.ai_endpoints import _build_system_prompt, _call_ai

            log_event("sistema", f"💬 Paso 1: Leyendo chat de {conv.wa_contact_name or 'cliente'}", detail=f"Analizando {len(history)} mensajes del historial", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")

            log_event("sistema", f"👤 Paso 2: Cargando contexto del cliente y agenda", detail=f"Verificando perfil, citas, servicios y disponibilidad del equipo", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")

            system_prompt = _build_system_prompt(db, is_whatsapp=True, conv_id=conv_id)

            # The inbound messages are already in history (from DB).
            # Build the final user message: combined text + image if applicable.
            # Remove the last N inbound entries from history to avoid duplication.
            while history and history[-1]["role"] == "user":
                history.pop()

            log_event("sistema", f"🧠 Paso 3: Analizando y generando respuesta", detail=f"Mensaje del cliente: {(inbound_text or '')[:100]}", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")

            _conv_tid = getattr(conv, 'tenant_id', None) or 1
            ai_response = await _call_ai(system_prompt, history, inbound_text, image_b64=image_data_b64, image_mime=image_media_type, tenant_id=_conv_tid, max_tokens=800)

            if not ai_response or not ai_response.strip():
                print(f"[Lina IA] No response generated for conv {conv_id}, staying silent.")
                log_event("error", "Sin respuesta de Claude — revisa API key y creditos", detail="La llamada a la IA no devolvio texto. Posible falta de creditos o error de API.", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="error")
                return

            # Anti-repetition: block if response is too similar to last AI message
            if last_ai_msg and last_ai_msg.content:
                from difflib import SequenceMatcher
                prev = last_ai_msg.content.lower().strip()
                curr = ai_response.lower().strip()
                similarity = SequenceMatcher(None, prev, curr).ratio()
                if similarity > 0.75:
                    print(f"[Lina IA] BLOCKED repetitive response for conv {conv_id} (similarity={similarity:.2f}): {ai_response[:60]}")
                    # Instead of staying silent, ask the AI to respond differently
                    retry_response = await _call_ai(
                        system_prompt + f"\n\nIMPORTANTE: Tu respuesta anterior fue: \"{last_ai_msg.content}\". NO repitas eso. Responde de forma diferente, abordando lo que el cliente acaba de decir.",
                        history, inbound_text, image_b64=image_data_b64, image_mime=image_media_type, tenant_id=_conv_tid, max_tokens=400
                    )
                    if retry_response and retry_response.strip():
                        retry_sim = SequenceMatcher(None, prev, retry_response.lower().strip()).ratio()
                        if retry_sim <= 0.75:
                            ai_response = retry_response
                            print(f"[Lina IA] Retry succeeded (similarity={retry_sim:.2f}): {ai_response[:60]}")
                        else:
                            print(f"[Lina IA] Retry also repetitive (similarity={retry_sim:.2f}). Staying silent.")
                            return
                    else:
                        return

            # Debug: log raw response with repr() to see exact chars
            print(f"[Lina IA] RAW response: {repr(ai_response[:300])}")

            # Step 3.5: Parse and execute actions from AI response
            import re
            import json

            # NUCLEAR CLEANUP: Normalize ALL quote variants to straight quotes
            for ch in '\u201c\u201d\u00ab\u00bb\u201e\u201f':
                ai_response = ai_response.replace(ch, '"')
            for ch in '\u2018\u2019\u201a\u201b':
                ai_response = ai_response.replace(ch, "'")
            # Also normalize backtick variants
            for ch in '\u0060\u2018\u2019\u02CB\u02CA':
                ai_response = ai_response.replace(ch, '`')

            # Extract action JSON blocks — try multiple patterns
            ACTION_PATTERN = re.compile(r'`{1,3}\s*action\s*\n?\s*(\{.*?\})\s*\n?\s*`{0,3}', re.DOTALL)
            # Fallback: bare JSON with "action" key (no backticks)
            BARE_ACTION = re.compile(r'(\{"action"\s*:.*?\})', re.DOTALL)

            action_matches = ACTION_PATTERN.findall(ai_response)
            if not action_matches:
                action_matches = BARE_ACTION.findall(ai_response)

            # SAFETY NET: If Lina promised to do something (schedule, create, etc.) but NO action block found,
            # retry once with explicit instruction to include the action block
            _PROMISE_WORDS = [
                "te agend", "te program", "listo, queda", "ya te agend", "queda agendad",
                "cita para", "te registr", "ya te registr", "te aviso", "te recuerdo",
                "te notifico", "te cambio la cita", "te movi la cita", "te reagend",
                "30 minutos antes", "10 minutos antes", "40 minutos antes", "te confirmo",
                "te cambio para", "te paso para", "te creo", "ya te cre",
                "te anoto", "queda registrad", "nota agregad", "te mando recordatorio",
                "te escribo", "queda confirmad", "te agendo para",
            ]
            if not action_matches:
                response_lower = ai_response.lower()
                promised_action = any(w in response_lower for w in _PROMISE_WORDS)
                if promised_action:
                    print(f"[Lina IA] WARNING: Response promises action but NO action block found. Retrying...")
                    log_event("error", "Lina prometio accion sin ejecutarla — reintentando", detail=f"Respuesta: {ai_response[:100]}...", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="warning")

                    # Find which promises were made to give better retry instruction
                    found_promises = [w for w in _PROMISE_WORDS if w in response_lower]
                    # Build action mapping hints
                    _action_map = {
                        "te agend": "create_appointment", "te program": "create_appointment",
                        "queda agendad": "create_appointment", "ya te agend": "create_appointment",
                        "te agendo para": "create_appointment", "cita para": "create_appointment",
                        "te registr": "create_client", "ya te registr": "create_client",
                        "te creo": "create_client", "ya te cre": "create_client",
                        "te cambio la cita": "update_appointment", "te movi la cita": "update_appointment",
                        "te reagend": "update_appointment", "te cambio para": "update_appointment",
                        "te aviso": "add_note", "te recuerdo": "add_note", "te notifico": "add_note",
                        "te mando recordatorio": "add_note", "te confirmo": "add_note",
                        "nota agregad": "add_note", "queda registrad": "add_note",
                    }
                    needed_actions = []
                    for promise in found_promises:
                        action_type = _action_map.get(promise)
                        if action_type and action_type not in needed_actions:
                            needed_actions.append(action_type)

                    # Retry with explicit instruction including exact action format
                    retry_msg = (
                        f"[SISTEMA CRITICO: Tu respuesta anterior NO incluyo bloques ```action```. "
                        f"Promesas detectadas: {', '.join(found_promises[:5])}. "
                        f"DEBES incluir estos bloques al final de tu respuesta:\n"
                    )
                    for na in needed_actions:
                        if na == "create_appointment":
                            retry_msg += '```action\n{"action":"create_appointment","client_name":"...","staff_name":"...","service_name":"...","date":"YYYY-MM-DD","time":"HH:MM"}\n```\n'
                        elif na == "update_appointment":
                            retry_msg += '```action\n{"action":"update_appointment","appointment_id":...,"time":"HH:MM"}\n```\n'
                        elif na == "create_client":
                            retry_msg += '```action\n{"action":"create_client","name":"...","phone":"..."}\n```\n'
                        elif na == "add_note":
                            retry_msg += '```action\n{"action":"add_note","search_name":"...","content":"PENDIENTE: ..."}\n```\n'
                    retry_msg += f"Rellena los datos reales del cliente y responde.]\n\n{inbound_text}"
                    retry_response = await _call_ai(system_prompt, history, retry_msg, tenant_id=_conv_tid, max_tokens=500)
                    if retry_response:
                        # Re-parse actions from retry
                        for ch in '\u201c\u201d\u00ab\u00bb\u201e\u201f':
                            retry_response = retry_response.replace(ch, '"')
                        for ch in '\u2018\u2019\u201a\u201b':
                            retry_response = retry_response.replace(ch, "'")
                        for ch in '\u0060\u2018\u2019\u02CB\u02CA':
                            retry_response = retry_response.replace(ch, '`')

                        retry_actions = ACTION_PATTERN.findall(retry_response)
                        if not retry_actions:
                            retry_actions = BARE_ACTION.findall(retry_response)

                        if retry_actions:
                            action_matches = retry_actions
                            print(f"[Lina IA] Retry SUCCESS — found {len(retry_actions)} action(s)")
                            log_event("accion", "Reintento exitoso — acciones encontradas", detail=f"{len(retry_actions)} accion(es) recuperadas", conv_id=conv_id, status="ok")
                        else:
                            print(f"[Lina IA] Retry FAILED — still no actions")
                            log_event("error", "Reintento fallido — Lina no incluyo acciones", detail="Dos intentos sin bloque action", conv_id=conv_id, status="error")

            for action_json in action_matches:
                try:
                    action_data = json.loads(action_json.strip())
                    action_type = action_data.get("action")

                    if action_type == "tag_conversation":
                        # Handle conversation tagging (special — needs conv object)
                        tags = action_data.get("tags", [])
                        if tags:
                            existing_tags = conv.tags or []
                            conv.tags = list(set(existing_tags + tags))
                            db.commit()
                            print(f"[Lina IA] Tagged conv {conv_id}: {tags}")

                    elif action_type == "queue_bulk_task" and action_data.get("items"):
                        # BULK TASK: execute all items inline (same as admin chat)
                        items = action_data["items"]
                        conv_tid = getattr(conv, 'tenant_id', None)
                        ok_count = 0
                        fail_count = 0
                        from routes.ai_endpoints import _execute_action
                        for item in items:
                            try:
                                if conv_tid:
                                    item["tenant_id"] = conv_tid
                                action_db = SessionLocal()
                                try:
                                    _execute_action(item, action_db)
                                    ok_count += 1
                                except Exception:
                                    fail_count += 1
                                    action_db.rollback()
                                finally:
                                    action_db.close()
                            except Exception:
                                fail_count += 1
                        log_event("accion", f"Tarea masiva completada: {ok_count} creados", detail=f"{ok_count} ok, {fail_count} fallaron. Tipo: {action_data.get('task_type','')}", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="ok")
                        print(f"[Lina IA] Bulk task: {ok_count} ok, {fail_count} failed")

                    elif action_type in (
                        "create_client", "update_client", "delete_client",
                        "add_note", "complete_task", "list_clients_by_filter",
                        "create_appointment", "update_appointment", "delete_appointment", "list_appointments",
                        "list_services", "add_visit",
                        "create_service", "update_service", "delete_service",
                    ):
                        # ALWAYS propagate tenant_id from conversation to ALL actions
                        if hasattr(conv, 'tenant_id') and conv.tenant_id:
                            action_data["tenant_id"] = conv.tenant_id

                        # Client creation: use conv phone ONLY if creating the conversation's own contact
                        # If creating a third party (primo, esposa), DON'T override their phone
                        if action_type == "create_client" and conv.wa_contact_phone:
                            client_name = (action_data.get("name") or "").strip().lower()
                            contact_name = (conv.wa_contact_name or "").strip().lower()
                            # Only use conv phone if the name matches the WhatsApp contact
                            if not action_data.get("phone") or client_name == contact_name or contact_name.startswith(client_name.split()[0] if client_name else "???"):
                                action_data["phone"] = conv.wa_contact_phone

                        # For create_appointment, only auto-fill phone if the client name matches
                        # the person writing (not when someone is booking for another person)
                        if action_type == "create_appointment" and not action_data.get("client_phone"):
                            appt_client = (action_data.get("client_name") or "").lower().strip()
                            contact = (conv.wa_contact_name or "").lower().strip()
                            if appt_client and contact and (appt_client in contact or contact in appt_client):
                                action_data["client_phone"] = conv.wa_contact_phone

                        if action_type == "pause_ai" and conv.wa_contact_phone:
                            action_data["client_phone"] = conv.wa_contact_phone

                        # Route ALL actions through the unified executor
                        from routes.ai_endpoints import _execute_action
                        # Log the action BEFORE executing
                        _action_labels = {
                            "create_client": "Registrando nuevo cliente",
                            "update_client": "Actualizando datos de cliente",
                            "create_appointment": "Agendando cita",
                            "update_appointment": "Modificando cita",
                            "delete_appointment": "Cancelando cita",
                            "add_note": "Guardando nota/tarea",
                            "complete_task": "Completando tarea pendiente",
                            "add_visit": "Registrando visita",
                            "list_appointments": "Consultando agenda",
                            "list_services": "Consultando servicios",
                            "list_clients_by_filter": "Buscando clientes",
                            "tag_conversation": "Etiquetando conversacion",
                            "send_whatsapp": "Enviando mensaje WhatsApp",
                            "create_service": "Creando servicio",
                            "update_service": "Actualizando servicio",
                            "delete_service": "Eliminando servicio",
                        }
                        action_label = _action_labels.get(action_type, f"Ejecutando: {action_type}")
                        log_event("accion", action_label, detail=str(action_data)[:200], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")

                        # Use FRESH DB session for each action to avoid InFailedSqlTransaction cascade
                        action_db = SessionLocal()
                        try:
                            result = _execute_action(action_data, action_db)
                            print(f"[Lina IA] Action {action_type}: {result}")
                            action_ok = "ERROR" not in result and "CONFLICTO" not in result
                            log_event("accion", f"{action_label} — {'Listo' if action_ok else 'Error'}", detail=result[:150], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="ok" if action_ok else "error")

                            # Track results for override
                            if not hasattr(ai_auto_reply, '_action_results'):
                                ai_auto_reply._action_results = []
                            ai_auto_reply._action_results.append(result)

                            # If client was created, link to conversation
                            if action_type == "create_client" and "ERROR" not in result:
                                from database.models import Client as ClientModel
                                new_client = action_db.query(ClientModel).filter(
                                    ClientModel.phone == conv.wa_contact_phone
                                ).first()
                                if new_client and not conv.client_id:
                                    conv_link = action_db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
                                    if conv_link:
                                        conv_link.client_id = new_client.id
                                        action_db.commit()
                                        print(f"[Lina IA] Linked conv {conv_id} to client {new_client.client_id}")
                        except Exception as exec_err:
                            action_db.rollback()
                            print(f"[Lina IA] Action execution error: {exec_err}")
                            log_event("error", f"{action_label} — Error de ejecucion", detail=str(exec_err)[:200], conv_id=conv_id, status="error")
                        finally:
                            action_db.close()

                    else:
                        print(f"[Lina IA] Unknown action type: {action_type}")
                except Exception as action_err:
                    print(f"[Lina IA] Action parse error: {action_err}")
                    log_event("error", "Error parseando accion", detail=str(action_err)[:200], conv_id=conv_id, status="error")

            # ACTION RESULTS HANDLING: Generate follow-up response with action results
            _all_results = getattr(ai_auto_reply, '_action_results', [])
            _conflicts = [r for r in _all_results if "CONFLICTO" in r]
            _errors = [r for r in _all_results if "ERROR" in r and "CONFLICTO" not in r]
            _successes = [r for r in _all_results if "CONFLICTO" not in r and "ERROR" not in r]

            # If actions executed successfully, make a SECOND AI call with results
            # This call CAN also execute actions (e.g., search → then create appointment)
            if _successes and not _conflicts and not _errors:
                try:
                    results_summary = "\n".join(_successes)
                    continuation_msg = (
                        f"[SISTEMA: Ejecutaste estas acciones y obtuviste estos resultados:\n{results_summary}\n\n"
                        f"Ahora RESPONDE al cliente Y ejecuta las acciones que falten. "
                        f"Si buscaste un cliente y el cliente pidio agendar, AGENDA LA CITA con un bloque action create_appointment. "
                        f"Si ya agendaste, confirma fecha, hora, profesional y servicio. "
                        f"NO repitas 'dejame buscar'. Haz todo lo que falta en UNA sola respuesta.]\n\n{inbound_text}"
                    )
                    from routes.ai_endpoints import _call_ai, _execute_action
                    final_response = await _call_ai(system_prompt, history + [
                        {"role": "assistant", "content": ai_response},
                    ], continuation_msg, tenant_id=_conv_tid, max_tokens=500)
                    if final_response and final_response.strip():
                        print(f"[Lina IA] Continuation RAW: {final_response[:200]}")

                        # Execute any actions in the continuation response
                        cont_action_pattern = re.compile(r'```\s*action\s*\n(.*?)```', re.DOTALL | re.IGNORECASE)
                        cont_actions = cont_action_pattern.findall(final_response)
                        for ca_json in cont_actions:
                            try:
                                ca_data = json.loads(ca_json.strip())
                                ca_type = ca_data.get("action")
                                if ca_type:
                                    # Inject tenant_id
                                    ca_data["tenant_id"] = _conv_tid
                                    if ca_type == "create_appointment" and not ca_data.get("client_phone"):
                                        ca_client = (ca_data.get("client_name") or "").lower().strip()
                                        ca_contact = (conv.wa_contact_name or "").lower().strip()
                                        if ca_client and ca_contact and (ca_client in ca_contact or ca_contact in ca_client):
                                            ca_data["client_phone"] = conv.wa_contact_phone
                                    ca_db = SessionLocal()
                                    try:
                                        ca_result = _execute_action(ca_data, ca_db)
                                        print(f"[Lina IA] Continuation action {ca_type}: {ca_result}")
                                        ca_ok = "ERROR" not in ca_result and "CONFLICTO" not in ca_result
                                        log_event("accion", f"Continuacion: {ca_type}", detail=ca_result[:150], conv_id=conv_id, status="ok" if ca_ok else "error")

                                        # If continuation action FAILED, regenerate response with the error
                                        if not ca_ok:
                                            print(f"[Lina IA] Continuation action FAILED — regenerating response")
                                            fix_msg = (
                                                f"[SISTEMA: Intentaste agendar pero FALLO: {ca_result}\n"
                                                f"GENERA una respuesta amigable explicando el conflicto y sugiriendo las alternativas que aparecen en el mensaje de error. "
                                                f"NO digas que agendaste. Di que hay conflicto y ofrece opciones.]\n\n{inbound_text}"
                                            )
                                            fix_response = await _call_ai(system_prompt, history, fix_msg, tenant_id=_conv_tid, max_tokens=500)
                                            if fix_response:
                                                fix_response = re.sub(r'`{1,3}\s*action.*', '', fix_response, flags=re.DOTALL | re.IGNORECASE).strip()
                                                if fix_response:
                                                    final_response = fix_response
                                    finally:
                                        ca_db.close()
                            except Exception as ca_err:
                                print(f"[Lina IA] Continuation action error: {ca_err}")

                        # Strip action blocks from the text that goes to client
                        final_response = re.sub(r'`{1,3}\s*action.*', '', final_response, flags=re.DOTALL | re.IGNORECASE)
                        final_response = re.sub(r'\{[^}]*"action"\s*:.*?\}', '', final_response, flags=re.DOTALL).strip()
                        final_response = re.sub(r'\n{3,}', '\n\n', final_response).strip()
                        if final_response:
                            ai_response = final_response
                            print(f"[Lina IA] Continuation response generated for conv {conv_id}")
                except Exception as cont_err:
                    print(f"[Lina IA] Continuation call failed: {cont_err}")

            if _conflicts or _errors:
                all_issues = _conflicts + _errors
                print(f"[Lina IA] ACTION ISSUES — {len(all_issues)} problem(s) detected, asking AI for client-friendly response")
                log_event("error", f"Accion fallida — regenerando respuesta", detail=str(all_issues)[:300], conv_id=conv_id, status="warning")
                try:
                    # Ask AI to generate a friendly client-facing response about the issue
                    issue_summary = "; ".join(all_issues)
                    friendly_msg = (
                        f"[SISTEMA: La accion que intentaste ejecutar FALLO con este resultado interno: {issue_summary}. "
                        f"GENERA una respuesta AMIGABLE para el cliente explicando el problema SIN mostrar datos tecnicos, "
                        f"IDs internos, nombres de otros clientes, ni mensajes de error. "
                        f"Si hay conflicto de horario, sugiere horarios alternativos disponibles. "
                        f"Responde en maximo 2 oraciones, de forma natural y calida.]\n\n{inbound_text}"
                    )
                    friendly_response = await _call_ai(system_prompt, history, friendly_msg, tenant_id=_conv_tid, max_tokens=300, model_override="claude-haiku-4-5-20251001")
                    if friendly_response and friendly_response.strip():
                        # Strip any action blocks from the friendly response
                        friendly_response = re.sub(r'`{1,3}\s*action.*', '', friendly_response, flags=re.DOTALL | re.IGNORECASE)
                        friendly_response = re.sub(r'\{[^}]*"action"\s*:.*?\}', '', friendly_response, flags=re.DOTALL).strip()
                        if friendly_response:
                            ai_response = friendly_response
                except Exception as friendly_err:
                    print(f"[Lina IA] Failed to generate friendly error response: {friendly_err}")
                    # Ultimate fallback — NEVER send raw error, send generic message
                    if _conflicts:
                        ai_response = "Ese horario no esta disponible. Quieres que te busque otro horario?"
                    else:
                        ai_response = "Hubo un inconveniente, pero ya lo estoy revisando. Dame un momento."
            # Reset for next call
            ai_auto_reply._action_results = []

            # NUCLEAR STRIP: Remove ALL traces of action blocks from client-facing text
            clean_response = ai_response

            # STEP 0: Normalize ALL unicode chars that look like backticks to ASCII backtick
            import unicodedata
            normalized = []
            for ch in clean_response:
                if ch == '`':
                    normalized.append('`')
                elif unicodedata.category(ch) in ('Pc', 'Sk', 'Po', 'Pf', 'Pi') and ch in '\u0060\u02CB\u02CA\u2018\u2019\u201A\u201B\u0027\u2032\u2035\uFF40':
                    normalized.append('`')
                else:
                    normalized.append(ch)
            clean_response = ''.join(normalized)

            # STEP 1: ULTIMATE FIX — truncate everything from the word "action" when preceded by backtick-like chars or at line start
            # This catches ```action, ``action, `action, and any unicode variant
            clean_response = re.sub(r'[`\u0060\u02CB\u02CA\u2018\u2019\u201B\uFF40]{1,3}\s*action.*', '', clean_response, flags=re.DOTALL | re.IGNORECASE)

            # STEP 2: Remove bare "action" word on its own line (if AI just puts "action" without backticks)
            clean_response = re.sub(r'^\s*action\s*$', '', clean_response, flags=re.MULTILINE | re.IGNORECASE)

            # STEP 3: Remove any bare JSON with "action" key
            clean_response = re.sub(r'\{[^}]*"action"\s*:.*?\}', '', clean_response, flags=re.DOTALL)

            # STEP 4: Remove any line containing "action":
            clean_response = re.sub(r'^.*"action"\s*:.*$', '', clean_response, flags=re.MULTILINE)

            # STEP 5: Clean up excessive whitespace
            clean_response = re.sub(r'\n{3,}', '\n\n', clean_response).strip()

            # STEP 6: (removed — phone numbers allowed when client asks for them)

            if not clean_response:
                print(f"[Lina IA] Response was only actions, no text for conv {conv_id}.")
                return

            # Step 3.8: Block dismissive/rude responses
            BLOCKED_PHRASES = [
                "no hay nada que responder",
                "no entiendo tu mensaje",
                "no comprendo",
                "mensaje vacio",
                "no me has dicho nada",
                "no has escrito nada",
            ]
            if any(bp in clean_response.lower() for bp in BLOCKED_PHRASES):
                print(f"[Lina IA] Blocked dismissive response for conv {conv_id}: {clean_response[:60]}")
                clean_response = "Hola! Soy Lina. En que te puedo ayudar?"

            # Step 3.85: Strip markdown — WhatsApp doesn't render it properly
            clean_response = re.sub(r'\*\*(.+?)\*\*', r'\1', clean_response)  # **bold** → bold
            clean_response = re.sub(r'\*(.+?)\*', r'\1', clean_response)      # *italic* → italic
            clean_response = re.sub(r'#{1,3}\s+', '', clean_response)         # ## heading → heading
            clean_response = re.sub(r'`([^`]+)`', r'\1', clean_response)      # `code` → code

            # Step 3.86: RESPONSE VALIDATOR — check before sending
            from ai_security import validate_response
            is_valid, issues = validate_response(clean_response)
            if not is_valid:
                print(f"[Lina IA] Response validation issues for conv {conv_id}: {issues}")
                log_event("sistema", f"Respuesta con problemas: {', '.join(issues)}", conv_id=conv_id, status="warning")
                if "reveals_ai_nature" in issues:
                    clean_response = re.sub(
                        r'(soy|como)\s+(un[ao]?\s+)?(bot|ia|inteligencia\s+artificial|modelo|chatbot|asistente\s+virtual\s+de\s+ia)[\.,]?',
                        '', clean_response, flags=re.IGNORECASE
                    ).strip()
                if "contains_action_block" in issues:
                    clean_response = re.sub(r'```.*?```', '', clean_response, flags=re.DOTALL).strip()
                if "too_long" in issues:
                    # Truncate at last sentence before 1200 chars
                    if len(clean_response) > 1200:
                        truncated = clean_response[:1200]
                        last_period = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
                        if last_period > 500:
                            clean_response = truncated[:last_period + 1]

            # Step 3.9: Payment/comprobante detection — tag alert + pause AI
            # ONLY trigger for ACTUAL payment confirmations (receipts, proof of payment)
            # NOT for questions about payment ("cuanto debo?", "puedo pagar?", "pago adelantado?")
            inbound_lower = (inbound_text or "").lower()

            # Strong indicators: client says they ALREADY paid/sent money
            PAYMENT_CONFIRM_PHRASES = [
                "ya pague", "ya pagué", "ya te pague", "ya te pagué",
                "ya transferi", "ya transferí", "te envie el pago", "te envié el pago",
                "te hice la transferencia", "ahi te envie", "ahí te envié",
                "hice el pago", "realice el pago", "realicé el pago",
                "te envie el comprobante", "te envié el comprobante",
                "ahi va el comprobante", "ahí va el comprobante",
                "mira el comprobante", "aqui esta el comprobante",
                "aquí está el comprobante", "te mando el recibo",
            ]
            is_payment = any(phrase in inbound_lower for phrase in PAYMENT_CONFIRM_PHRASES)

            # If client sent an image and recent messages mention payment confirmation
            if needs_vision and not is_payment:
                recent_check = (
                    db.query(WhatsAppMessage)
                    .filter(WhatsAppMessage.conversation_id == conv_id, WhatsAppMessage.direction == "inbound")
                    .order_by(WhatsAppMessage.created_at.desc())
                    .limit(3)
                    .all()
                )
                for rc in recent_check:
                    rc_lower = (rc.content or "").lower()
                    if any(phrase in rc_lower for phrase in PAYMENT_CONFIRM_PHRASES):
                        is_payment = True
                        break

            # Also check if the AI response itself flags it as payment
            ai_lower = clean_response.lower()
            if any(phrase in ai_lower for phrase in ["verificar.*pago", "confirmar.*pago", "recibido.*pago"]):
                pass  # Let the AI handle it naturally

            if is_payment:
                # Tag conversation as payment alert
                existing_tags = conv.tags or []
                if "⚠️ Pago pendiente" not in existing_tags:
                    conv.tags = list(set(existing_tags + ["⚠️ Pago pendiente"]))
                # Pause AI on this conversation so admin handles it
                conv.is_ai_active = False
                db.commit()
                print(f"[Lina IA] PAYMENT DETECTED for conv {conv_id} — tagged + AI paused")
                log_event("accion", "Pago detectado — IA pausada", detail="El cliente menciono un pago. Pause la IA para que el admin verifique manualmente.", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="warning")
                # Get client name for personalized message
                client_name = ""
                if conv.client_id:
                    from database.models import Client as ClientModel
                    cl = db.query(ClientModel).filter(ClientModel.id == conv.client_id).first()
                    if cl:
                        client_name = cl.name.split()[0]  # First name only
                if not client_name:
                    client_name = conv.wa_contact_name.split()[0] if conv.wa_contact_name else ""
                name_suffix = f" {client_name}" if client_name else ""
                # Lina acknowledges and takes ownership — SHE verifies, not "the team"
                clean_response = f"Permiteme un momento en lo que verifico la informacion del pago{name_suffix}, gracias! 🙏"

            log_event("sistema", f"✅ Paso 4: Verificación completa, enviando respuesta", detail=f"Respuesta: {clean_response[:120]}...", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="ok")

            # Step 4: Send read receipt NOW (blue ticks appear right before Lina replies)
            if inbound_wa_msg_id:
                await _send_read_receipt(inbound_wa_msg_id)

            # Step 4.5: Send AI response via WhatsApp (with 1 retry on failure)
            wa_message_id = None
            send_status = "sent"
            max_retries = 2
            for attempt in range(max_retries):
                try:
                    async with httpx.AsyncClient(timeout=15) as client:
                        resp = await client.post(
                            f"{_get_wa_base_url(db)}/messages",
                            headers=wa_headers(db),
                            json={
                                "messaging_product": "whatsapp",
                                "to": normalize_phone(to_phone),
                                "type": "text",
                                "text": {"body": clean_response},
                            },
                        )
                        data = resp.json()
                        if resp.status_code == 200 and "messages" in data:
                            wa_message_id = data["messages"][0].get("id")
                            send_status = "sent"
                            _trigger_token_resume()  # Token works — unpause if paused
                            break  # Success
                        else:
                            send_status = "failed"
                            error_msg = data.get("error", {}).get("message", str(data)[:100])
                            print(f"[Lina IA] WhatsApp send failed (attempt {attempt+1}) for conv {conv_id}: {error_msg}")
                            # Detect token expiration → auto-pause
                            if _is_token_error(error_msg):
                                _trigger_token_pause()
                                log_event("respuesta", "Token expirado — mensaje no enviado", detail=f"Lina se pauso automaticamente. Error: {error_msg}", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="error")
                                break  # Don't retry — token is dead
                            if attempt < max_retries - 1:
                                log_event("sistema", "Envio fallido, reintentando...", detail=f"Error: {error_msg}. Reintento en 5s.", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="warning")
                                await asyncio.sleep(5)
                            else:
                                log_event("respuesta", "No se pudo enviar el mensaje", detail=f"Fallo despues de {max_retries} intentos. Error: {error_msg}", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="error")
                except Exception as send_err:
                    send_status = "failed"
                    print(f"[Lina IA] WhatsApp send error (attempt {attempt+1}) for conv {conv_id}: {send_err}")
                    if attempt < max_retries - 1:
                        log_event("sistema", "Error de conexion, reintentando...", detail=str(send_err)[:100], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="warning")
                        await asyncio.sleep(5)
                    else:
                        log_event("respuesta", "Error al enviar mensaje", detail=f"Fallo despues de {max_retries} intentos: {str(send_err)[:100]}", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="error")

            # Step 5: Store AI response in DB (even if WhatsApp send failed — visible in CRM)
            msg = WhatsAppMessage(
                conversation_id=conv_id,
                wa_message_id=wa_message_id,
                direction="outbound",
                content=clean_response,
                message_type="text",
                status=send_status,
                sent_by="lina_ia",
            )
            db.add(msg)
            conv.last_message_at = datetime.utcnow()
            db.commit()

            # Auto-pause detection: if Lina's response indicates handoff to human
            _pause_phrases = [
                "permitame un momento",
                "permiteme un momento",
                "un profesional revise",
                "un asesor le atendera",
                "un asesor lo atendera",
                "atencion personalizada",
                "verificamos disponibilidad",
            ]
            _resp_lower = clean_response.lower()
            if any(phrase in _resp_lower for phrase in _pause_phrases):
                conv.is_ai_active = False
                db.commit()
                log_event("alerta", f"⏸️ IA pausada automaticamente — handoff a humano", detail=f"Respuesta de Lina contiene frase de pausa. Conversacion {conv_id} en modo manual.", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="warning")
                print(f"[Lina IA] AUTO-PAUSED conv {conv_id} — handoff phrase detected")

            # Track in global rate limiter
            _ai_reply_timestamps.append(time.time())

            print(f"[Lina IA] Replied to conv {conv_id}: {clean_response[:60]}...")
            if send_status == "sent":
                log_event("respuesta", f"Respondi a {conv.wa_contact_name or 'cliente'}", detail=clean_response[:150], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="ok")

                # Increment tenant messages_used counter
                try:
                    _msg_tid = getattr(conv, 'tenant_id', None) or _conv_tid
                    if _msg_tid:
                        _msg_db = SessionLocal()
                        try:
                            _t = _msg_db.query(Tenant).filter(Tenant.id == _msg_tid).first()
                            if _t:
                                _t.messages_used = (_t.messages_used or 0) + 1
                                _msg_db.commit()
                        finally:
                            _msg_db.close()
                except Exception:
                    pass

                # POST-RESPONSE: Auto-detect follow-up tasks from conversation
                try:
                    from ai_task_detector import create_auto_tasks
                    create_auto_tasks(conv_id, inbound_text, clean_response)
                except Exception as task_err:
                    print(f"[Lina IA] Auto-task detection error (non-critical): {task_err}")

                # POST-RESPONSE: Extract and save long-term memories (non-blocking, in background thread)
                try:
                    import threading
                    from ai_memory_extractor import save_memories_sync
                    mem_thread = threading.Thread(target=save_memories_sync, args=(conv_id,), daemon=True)
                    mem_thread.start()
                except Exception as mem_err:
                    print(f"[Lina IA] Memory extraction error (non-critical): {mem_err}")

                # POST-RESPONSE: Progressive Learning — track conversation outcome
                try:
                    # Check if response contained an action (booking, scheduling, etc.)
                    had_action = bool(action_matches) if 'action_matches' in dir() else False
                    # Check if admin intervened (sent manual message after Lina)
                    # This is checked on next cycle via _detect_admin_interventions
                    from database.models import LinaActivityEvent
                    outcome_event = LinaActivityEvent(
                        event_type="outcome",
                        title=f"Respuesta {'con accion' if had_action else 'informativa'}",
                        detail=f"Conv {conv_id}: {'Ejecuto accion' if had_action else 'Solo texto'}. Inbound: {(inbound_text or '')[:60]}",
                        status="ok",
                        contact_name=conv.wa_contact_name or "",
                        conv_id=conv_id,
                        tenant_id=_conv_tid,
                    )
                    db.add(outcome_event)
                    db.commit()
                except Exception:
                    pass
            else:
                log_event("respuesta", f"Mensaje generado pero fallo el envio", detail=clean_response[:150], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="error")

        finally:
            db.close()

    except Exception as e:
        err_msg = str(e)[:200].replace("{", "(").replace("}", ")")  # Sanitize braces to prevent format errors in logging
        print(f"[Lina IA] Auto-reply error: {err_msg}")
        log_event("error", "Error interno al procesar respuesta", detail=err_msg, conv_id=conv_id, status="error")
    finally:
        # Always release the in-flight lock
        _in_flight_convs.discard(conv_id)

        # Process queued messages for this conversation
        queued = _pending_queue.pop(conv_id, [])
        if queued:
            combined = queued[-1]  # Use the LATEST queued message (most relevant)
            log_event("sistema", f"Procesando mensaje encolado", detail=f"Habia {len(queued)} mensaje(s) en cola. Procesando el mas reciente.", conv_id=conv_id, status="info")
            try:
                await ai_auto_reply(conv_id, combined)
            except Exception as q_err:
                logger.warning(f"Error processing queued message for conv {conv_id}: {q_err}")


