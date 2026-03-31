# ============================================================================
# Plexify Studio - WhatsApp Business API Endpoints
# Real Meta API integration + local DB storage + Lina IA auto-reply
# ============================================================================

import os
import re
import asyncio
import random
import httpx
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Query, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sa_func
from database.connection import get_db, SessionLocal
from database.models import WhatsAppConversation, WhatsAppMessage, Client, Tenant
from middleware.auth_middleware import get_current_user
from routes._helpers import normalize_phone, now_colombia as _now_col, safe_tid
from schemas import ToggleAllAIRequest as _ToggleAllAIRequest
from activity_log import log_event
from routes._usage_tracker import track_message_sent, track_message_received, track_ai_usage

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

# Helpers moved to services/whatsapp/helpers.py (Phase 7 refactor)
from services.whatsapp.helpers import (
    _is_off_hours, _off_hours_greeting, _wa_token_paused,
    _is_token_error, _trigger_token_pause, _trigger_token_resume,
    _get_wa_config_cached, wa_headers, _get_wa_base_url,
    _transcribe_audio, _download_media_base64, _fetch_profile_photo,
    _in_flight_convs, WA_API_VERSION, WA_BUSINESS_ID, WA_WEBHOOK_VERIFY_TOKEN,
)

# ============================================================================
# CONVERSATIONS — List & Get
# ============================================================================
@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List all conversations with last message preview."""
    tid = safe_tid(user, db)
    try:
        q = db.query(WhatsAppConversation).options(joinedload(WhatsAppConversation.client))
        if tid is not None:
            q = q.filter(WhatsAppConversation.tenant_id == tid)
        convs = (
            q.order_by(WhatsAppConversation.last_message_at.desc().nullslast())
            .all()
        )
    except Exception as e:
        import traceback
        print(f"[WA] list_conversations query error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"DB query error: {str(e)}")

    results = []
    for c in convs:
        try:
            # Get last message for preview
            last_msg = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == c.id)
                .order_by(WhatsAppMessage.created_at.desc())
                .first()
            )

            client_data = None
            if c.client:
                cl = c.client
                total_visits = len(cl.visits) if cl.visits else 0
                total_spent = sum(v.amount for v in cl.visits) if cl.visits else 0
                last_visit = cl.visits[0].visit_date if cl.visits else None
                days_since = (datetime.utcnow().date() - last_visit).days if last_visit else None

                from routes._helpers import compute_client_fields
                computed = compute_client_fields(cl, db)

                client_data = {
                    "id": cl.id,
                    "client_id": cl.client_id,
                    "name": cl.name,
                    "phone": cl.phone,
                    "email": cl.email,
                    "status": computed.status if hasattr(computed, 'status') else "activo",
                    "total_visits": total_visits,
                    "total_spent": total_spent,
                    "last_visit": str(last_visit) if last_visit else None,
                    "days_since_last_visit": days_since,
                    "favorite_service": cl.favorite_service,
                    "tags": cl.tags,
                }

            # Prefer CRM client name over WhatsApp profile name
            display_name = c.wa_contact_name
            if client_data and client_data.get("name"):
                display_name = client_data["name"]

            results.append({
                "id": c.id,
                "wa_contact_phone": c.wa_contact_phone,
                "wa_contact_name": display_name,
                "wa_profile_photo_url": getattr(c, 'wa_profile_photo_url', None),
                "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
                "last_message_preview": last_msg.content[:80] if last_msg else None,
                "last_message_direction": last_msg.direction if last_msg else None,
                "is_ai_active": c.is_ai_active,
                "unread_count": c.unread_count,
                "last_sentiment": getattr(c, "last_sentiment", None),
                "tags": c.tags or [],
                "client": client_data,
            })
        except Exception as e:
            import traceback
            print(f"[WA] Error building conv {c.id}: {e}\n{traceback.format_exc()}")
            results.append({
                "id": c.id,
                "wa_contact_phone": getattr(c, 'wa_contact_phone', '?'),
                "wa_contact_name": getattr(c, 'wa_contact_name', '?'),
                "wa_profile_photo_url": None,
                "last_message_at": None,
                "last_message_preview": None,
                "last_message_direction": None,
                "is_ai_active": True,
                "unread_count": 0,
                "tags": [],
                "client": None,
                "_error": str(e),
            })

    return results


@router.get("/conversations/{conv_id}")
def get_conversation(conv_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = (
        db.query(WhatsAppConversation)
        .options(joinedload(WhatsAppConversation.client))
        .filter(WhatsAppConversation.id == conv_id)
    )
    if tid is not None:
        q = q.filter(WhatsAppConversation.tenant_id == tid)
    conv = q.first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    return conv


# ============================================================================
# TOGGLE AI — Enable/disable Lina IA auto-reply for a conversation
# ============================================================================
@router.put("/conversations/{conv_id}/ai")
async def toggle_ai(conv_id: int, body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Toggle Lina IA auto-reply on/off for a specific conversation. Catches up on unread when enabling."""
    from sqlalchemy import desc

    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    conv.is_ai_active = body.get("is_ai_active", not conv.is_ai_active)
    db.commit()

    catchup = False

    # When re-enabling AI, catch up on unread messages
    if conv.is_ai_active:
        last_inbound = (
            db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.conversation_id == conv.id, WhatsAppMessage.direction == "inbound")
            .order_by(desc(WhatsAppMessage.created_at))
            .first()
        )
        if last_inbound:
            last_ai_reply = (
                db.query(WhatsAppMessage)
                .filter(
                    WhatsAppMessage.conversation_id == conv.id,
                    WhatsAppMessage.sent_by == "lina_ia",
                    WhatsAppMessage.status != "failed",
                )
                .order_by(desc(WhatsAppMessage.created_at))
                .first()
            )
            needs_catchup = not last_ai_reply or last_ai_reply.created_at < last_inbound.created_at

            if needs_catchup:
                since = last_ai_reply.created_at if last_ai_reply else conv.created_at
                recent_inbound = (
                    db.query(WhatsAppMessage)
                    .filter(
                        WhatsAppMessage.conversation_id == conv.id,
                        WhatsAppMessage.direction == "inbound",
                        WhatsAppMessage.created_at >= since,
                    )
                    .order_by(WhatsAppMessage.created_at.asc())
                    .all()
                )
                inbound_text = " | ".join(m.content for m in recent_inbound if m.content and not m.content.startswith("📎")) or last_inbound.content or ""

                background_tasks.add_task(
                    ai_auto_reply,
                    conv.id, conv.wa_contact_phone, inbound_text,
                    None, False, None, False, None,
                    True,  # is_catchup
                )
                catchup = True
                print(f"[Lina IA] Individual toggle ON for conv {conv_id} — catching up on unread messages.")
                log_event("sistema", f"IA activada — revisando mensajes pendientes", detail=f"Encontre mensajes sin responder. Preparando respuesta.", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="ok")

    return {"id": conv.id, "is_ai_active": conv.is_ai_active, "catchup": catchup}


# ============================================================================
# UPDATE TAGS — Set tags for a conversation
# ============================================================================
@router.put("/conversations/{conv_id}/tags")
def update_tags(conv_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Update tags for a conversation."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    conv.tags = body.get("tags", [])
    db.commit()
    return {"id": conv.id, "tags": conv.tags}


# ============================================================================
# MARK AS READ — Reset unread count for a conversation
# ============================================================================
@router.put("/conversations/{conv_id}/read")
def mark_conversation_read(conv_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Mark a conversation as read by setting unread_count to 0."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    conv.unread_count = 0
    db.commit()

    return {"id": conv.id, "unread_count": 0}


# ============================================================================
# TOTAL UNREAD — Sum of all unread counts across conversations
# ============================================================================
@router.get("/unread-count")
def get_total_unread(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get total unread message count across all conversations."""
    from sqlalchemy import func
    tid = safe_tid(user, db)
    q = db.query(func.coalesce(func.sum(WhatsAppConversation.unread_count), 0))
    if tid is not None:
        q = q.filter(WhatsAppConversation.tenant_id == tid)
    total = q.scalar()
    return {"total_unread": total}


# ============================================================================
# MESSAGES — List & Send
# ============================================================================
@router.get("/conversations/{conv_id}/messages")
def list_messages(conv_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List all messages in a conversation."""
    tid = safe_tid(user, db)
    q = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id)
    if tid is not None:
        q = q.filter(WhatsAppConversation.tenant_id == tid)
    conv = q.first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    messages = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.conversation_id == conv_id)
        .order_by(WhatsAppMessage.created_at.asc())
        .all()
    )

    def _resolve_media_url(raw_url):
        """Transform raw media_id into proxy URL, pass through full URLs as-is."""
        if not raw_url:
            return None
        # If it looks like a Meta media ID (no slashes, no http), use proxy
        if not raw_url.startswith("http"):
            return f"/api/whatsapp/media/{raw_url}"
        return raw_url

    return [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "wa_message_id": m.wa_message_id,
            "direction": m.direction,
            "content": m.content,
            "message_type": m.message_type,
            "status": m.status,
            "sent_by": m.sent_by,
            "media_url": _resolve_media_url(m.media_url),
            "media_mime_type": m.media_mime_type,
            "sentiment": getattr(m, "sentiment", None),
            "sentiment_score": getattr(m, "sentiment_score", None),
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Send a WhatsApp message via Meta API and store locally."""
    tid = safe_tid(user, db)
    q = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id)
    if tid is not None:
        q = q.filter(WhatsAppConversation.tenant_id == tid)
    conv = q.first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    text = body.get("content", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Mensaje vacio")

    # Send via Meta WhatsApp API
    wa_message_id = None
    status = "sent"

    try:
        send_url = f"{_get_wa_base_url(db)}/messages"
        send_headers = wa_headers(db)
        send_to = normalize_phone(conv.wa_contact_phone)
        print(f"[WA-SEND] URL={send_url}")
        print(f"[WA-SEND] To={send_to}")
        print(f"[WA-SEND] Auth header len={len(send_headers.get('Authorization', ''))}")

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                send_url,
                headers=send_headers,
                json={
                    "messaging_product": "whatsapp",
                    "to": normalize_phone(conv.wa_contact_phone),
                    "type": "text",
                    "text": {"body": text},
                },
            )
            data = resp.json()

            print(f"[WA-SEND] Response status={resp.status_code}")
            print(f"[WA-SEND] Response body={str(data)[:300]}")

            if resp.status_code == 200 and "messages" in data:
                wa_message_id = data["messages"][0].get("id")
                status = "sent"
                print(f"[WA-SEND] SUCCESS — msg_id={wa_message_id}")
            else:
                status = "failed"
                error_msg = data.get("error", {}).get("message", str(data))
                error_code = data.get("error", {}).get("code", "?")
                error_subcode = data.get("error", {}).get("error_subcode", "?")
                print(f"[WA-SEND] FAILED — code={error_code}, subcode={error_subcode}: {error_msg}")
    except Exception as e:
        status = "failed"
        print(f"[WA-SEND] EXCEPTION: {type(e).__name__}: {e}")

    # Store in DB regardless of API result
    msg = WhatsAppMessage(
        conversation_id=conv_id,
        wa_message_id=wa_message_id,
        direction="outbound",
        content=text,
        message_type="text",
        status=status,
        sent_by="admin",
    )
    db.add(msg)

    # Update conversation
    conv.last_message_at = datetime.utcnow()
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    # Track usage
    if status == "sent":
        track_message_sent()

    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "wa_message_id": msg.wa_message_id,
        "direction": msg.direction,
        "content": msg.content,
        "message_type": msg.message_type,
        "status": msg.status,
        "sent_by": msg.sent_by,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


# ============================================================================
# LIST TEMPLATES — Fetch approved templates from Meta Business Account
# ============================================================================
@router.get("/templates")
async def list_templates(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List all message templates from Meta Business Account."""
    if not WA_BUSINESS_ID:
        raise HTTPException(status_code=500, detail="WHATSAPP_BUSINESS_ACCOUNT_ID no configurado")

    try:
        url = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_BUSINESS_ID}/message_templates"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=wa_headers(db), params={"limit": 50})
            data = resp.json()

            if "data" not in data:
                raise HTTPException(status_code=400, detail=data.get("error", {}).get("message", "Error fetching templates"))

            templates = []
            for t in data["data"]:
                # Extract body text from components
                body_text = ""
                for comp in t.get("components", []):
                    if comp.get("type") == "BODY":
                        body_text = comp.get("text", "")
                        break

                templates.append({
                    "name": t["name"],
                    "status": t["status"],
                    "language": t.get("language", ""),
                    "category": t.get("category", ""),
                    "body": body_text,
                })

            return templates
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error de conexion: {str(e)}")


# ============================================================================
# SEND TEMPLATE — Send a template message to start a conversation
# ============================================================================
@router.post("/send-template")
async def send_template(body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Send a template message to a phone number. Creates conversation + stores message."""
    phone_raw = body.get("phone", "").strip()
    phone_clean = normalize_phone(phone_raw)
    template_name = body.get("template_name", "hello_world")
    language_code = body.get("language_code", "en_US")
    contact_name = body.get("name", "").strip()

    if not phone_clean:
        raise HTTPException(status_code=400, detail="Numero de telefono requerido")

    # Step 1: Send template via Meta API
    wa_message_id = None
    status = "sent"
    body_text = body.get("body_text", f"[Plantilla: {template_name}]")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{_get_wa_base_url(db)}/messages",
                headers=wa_headers(db),
                json={
                    "messaging_product": "whatsapp",
                    "to": phone_clean,
                    "type": "template",
                    "template": {
                        "name": template_name,
                        "language": {"code": language_code},
                    },
                },
            )
            data = resp.json()

            if resp.status_code == 200 and "messages" in data:
                wa_message_id = data["messages"][0].get("id")
                status = "sent"
            else:
                status = "failed"
                error_msg = data.get("error", {}).get("message", str(data))
                print(f"[WA Template] Send failed ({resp.status_code}): {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error de conexion: {str(e)}")

    # Step 2: Get or create conversation
    existing = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.wa_contact_phone == phone_raw
    ).first()

    if not existing:
        # Also try without +
        existing = db.query(WhatsAppConversation).filter(
            WhatsAppConversation.wa_contact_phone == f"+{phone_clean}"
        ).first()

    if existing:
        conv = existing
        if contact_name and not conv.wa_contact_name:
            conv.wa_contact_name = contact_name
    else:
        cl = db.query(Client).filter(Client.phone.contains(phone_clean[-10:])).first() if len(phone_clean) >= 10 else None
        conv = WhatsAppConversation(
            tenant_id=getattr(cl, 'tenant_id', None) if cl else None,
            wa_contact_phone=phone_raw or f"+{phone_clean}",
            wa_contact_name=contact_name or (cl.name if cl else None),
            client_id=cl.id if cl else None,
            is_ai_active=True,
            unread_count=0,
        )
        db.add(conv)
        db.flush()

    # Step 3: Store the outbound template message in DB
    msg = WhatsAppMessage(
        conversation_id=conv.id,
        wa_message_id=wa_message_id,
        direction="outbound",
        content=body_text,
        message_type="template",
        status=status,
        sent_by="admin",
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    return {
        "success": True,
        "conversation_id": conv.id,
        "message_id": msg.id,
        "wa_message_id": wa_message_id,
        "status": status,
    }


# ============================================================================
# CREATE CONVERSATION — Start a new chat
# ============================================================================
@router.post("/conversations")
def create_conversation(body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Create a new conversation (or return existing one for the same phone)."""
    phone = body.get("phone", "").strip()
    name = body.get("name", "").strip()

    if not phone:
        raise HTTPException(status_code=400, detail="Numero de telefono requerido")

    # Check if conversation already exists
    existing = db.query(WhatsAppConversation).filter(
        WhatsAppConversation.wa_contact_phone == phone
    ).first()

    if existing:
        return {"id": existing.id, "existing": True}

    # Try to match with a client by phone
    client = db.query(Client).filter(Client.phone == phone).first()

    conv = WhatsAppConversation(
        tenant_id=getattr(client, 'tenant_id', None) if client else None,
        wa_contact_phone=phone,
        wa_contact_name=name or (client.name if client else None),
        client_id=client.id if client else None,
        is_ai_active=True,
        unread_count=0,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return {"id": conv.id, "existing": False}


# ============================================================================
# WEBHOOK — Meta sends messages here
# ============================================================================
@router.get("/webhook")
def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    """Webhook verification endpoint for Meta."""
    if hub_mode == "subscribe" and hub_verify_token == WA_WEBHOOK_VERIFY_TOKEN:
        return PlainTextResponse(content=hub_challenge, status_code=200)
    raise HTTPException(status_code=403, detail="Verificacion fallida")


@router.post("/webhook")
async def receive_webhook(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Receive incoming messages from WhatsApp via Meta webhook."""
    payload = await request.json()

    conversations_to_reply = []

    try:
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})

                # Webhook received = token is alive — resume if paused
                _trigger_token_resume()

                # Resolve tenant from the phone_number_id in metadata
                from database.models import Tenant
                phone_number_id = value.get("metadata", {}).get("phone_number_id")
                tenant = db.query(Tenant).filter(Tenant.wa_phone_number_id == phone_number_id).first() if phone_number_id else None
                tenant_id = tenant.id if tenant else None

                # Process incoming messages
                for msg_data in value.get("messages", []):
                    from_phone = msg_data.get("from", "")
                    msg_type = msg_data.get("type", "text")
                    wa_msg_id = msg_data.get("id", "")

                    # Extract content based on message type
                    media_url = None
                    if msg_type == "text":
                        content = msg_data.get("text", {}).get("body", "")
                    elif msg_type in ("image", "video", "audio", "document", "sticker"):
                        media_data = msg_data.get(msg_type, {})
                        media_id = media_data.get("id")
                        content = media_data.get("caption", "")
                        # Store media_id directly — frontend will use proxy endpoint
                        if media_id:
                            media_url = media_id
                        if not content:
                            type_labels = {"image": "Foto", "video": "Video", "audio": "Audio", "document": "Documento", "sticker": "Sticker"}
                            content = f"📎 {type_labels.get(msg_type, msg_type)}"
                    elif msg_type == "location":
                        loc = msg_data.get("location", {})
                        content = f"📍 Ubicacion: {loc.get('latitude')}, {loc.get('longitude')}"
                    elif msg_type == "contacts":
                        content = "👤 Contacto compartido"
                    elif msg_type == "reaction":
                        content = msg_data.get("reaction", {}).get("emoji", "")
                    else:
                        content = f"[{msg_type}]"

                    # Get or create conversation
                    contact_name = None
                    for contact in value.get("contacts", []):
                        if contact.get("wa_id") == from_phone:
                            profile = contact.get("profile", {})
                            contact_name = profile.get("name")

                    conv_q = db.query(WhatsAppConversation).filter(
                        WhatsAppConversation.wa_contact_phone == from_phone
                    )
                    if tenant_id:
                        conv_q = conv_q.filter(WhatsAppConversation.tenant_id == tenant_id)
                    conv = conv_q.first()

                    # Auto-link or re-link conversation to correct CRM client
                    if conv:
                        clean_phone = re.sub(r'\D', '', from_phone)
                        clean_last10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone

                        # Check if current linked client's phone matches the real WhatsApp phone
                        needs_relink = not conv.client_id
                        if conv.client_id:
                            linked_client = db.query(Client).filter(Client.id == conv.client_id).first()
                            if linked_client:
                                linked_clean = re.sub(r'\D', '', linked_client.phone or '')
                                if linked_clean[-10:] != clean_last10:
                                    # Linked client has WRONG phone — re-link to correct one
                                    needs_relink = True
                                    print(f"[WA] Client {linked_client.name} phone {linked_client.phone} doesn't match WA phone {from_phone} — re-linking")

                        if needs_relink:
                            link_q = db.query(Client).filter(Client.is_active == True)
                            if tenant_id:
                                link_q = link_q.filter(Client.tenant_id == tenant_id)
                            for c in link_q.all():
                                c_clean = re.sub(r'\D', '', c.phone or '')
                                if c_clean[-10:] == clean_last10:
                                    conv.client_id = c.id
                                    db.flush()
                                    print(f"[WA] Auto-linked conv {conv.id} to client {c.client_id} ({c.name})")
                                    break

                    if not conv:
                        # Try to match with existing ACTIVE client — normalize phone for comparison
                        # Strip all non-digits for matching (handles formatted phones like "+57 (314) 708-3182")
                        clean_phone = re.sub(r'\D', '', from_phone)
                        clean_last10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone
                        client_q = db.query(Client).filter(Client.is_active == True)
                        if tenant_id:
                            client_q = client_q.filter(Client.tenant_id == tenant_id)
                        all_clients = client_q.all()
                        client = None
                        for c in all_clients:
                            c_clean = re.sub(r'\D', '', c.phone or '')
                            if c_clean[-10:] == clean_last10:
                                client = c
                                break
                        conv = WhatsAppConversation(
                            wa_contact_phone=from_phone,
                            wa_contact_name=contact_name,
                            client_id=client.id if client else None,
                            tenant_id=tenant_id,
                            is_ai_active=True,
                        )
                        db.add(conv)
                        db.flush()
                        # Fetch profile photo in background
                        background_tasks.add_task(_fetch_profile_photo, conv.id, from_phone)

                    # Check for duplicate message
                    existing_msg = db.query(WhatsAppMessage).filter(
                        WhatsAppMessage.wa_message_id == wa_msg_id
                    ).first()
                    if existing_msg:
                        continue

                    # Resolve media mime type
                    media_mime = None
                    if msg_type in ("image", "video", "audio", "document", "sticker"):
                        media_mime = msg_data.get(msg_type, {}).get("mime_type")

                    # Store message
                    message = WhatsAppMessage(
                        conversation_id=conv.id,
                        wa_message_id=wa_msg_id,
                        direction="inbound",
                        content=content,
                        message_type=msg_type,
                        status="delivered",
                        media_url=media_url,
                        media_mime_type=media_mime,
                    )
                    db.add(message)

                    # --- Sentiment Analysis (rule-based, zero AI tokens) ---
                    _msg_sentiment = None
                    try:
                        if msg_type == "text" and content:
                            from sentiment_analyzer import analyze_sentiment as _analyze_sent
                            _sent_result = _analyze_sent(content)
                            _msg_sentiment = _sent_result["sentiment"]
                            message.sentiment = _msg_sentiment
                            message.sentiment_score = _sent_result["score"]
                            conv.last_sentiment = _msg_sentiment

                            # Alert admin on negative/urgent messages
                            if _msg_sentiment in ("negative", "urgent"):
                                _sent_label = "Urgente" if _msg_sentiment == "urgent" else "Negativo"
                                _alert_icon = "🚨" if _msg_sentiment == "urgent" else "⚠️"
                                _client_name = conv.wa_contact_name or from_phone or "Cliente"
                                try:
                                    from notifications import notify
                                    notify(conv.tenant_id, "sentiment_alert",
                                           f"{_alert_icon} {_client_name} — Mensaje {_sent_label}",
                                           (content or "")[:150],
                                           icon=_alert_icon, link="/inbox")
                                except Exception:
                                    pass
                                log_event("sistema", f"Sentimiento {_sent_label} detectado",
                                          detail=f"{_client_name}: {(content or '')[:80]}",
                                          conv_id=conv.id,
                                          contact_name=_client_name,
                                          status="warning")
                    except Exception as e:
                        print(f"[SENTIMENT] Error: {e}")

                    # Track inbound message in usage metrics
                    try:
                        track_message_received(tenant_id=conv.tenant_id)
                    except Exception:
                        pass

                    # Update conversation
                    conv.last_message_at = datetime.utcnow()
                    conv.unread_count = (conv.unread_count or 0) + 1
                    if contact_name and not conv.wa_contact_name:
                        conv.wa_contact_name = contact_name

                    # Retry profile photo fetch if missing
                    try:
                        if not getattr(conv, 'wa_profile_photo_url', None):
                            background_tasks.add_task(_fetch_profile_photo, conv.id, from_phone)
                    except Exception:
                        pass  # Column may not exist yet

                    # Send read receipt to Meta (blue ticks)
                    background_tasks.add_task(_send_read_receipt, wa_msg_id)

                    # DB notification + push for inbound message
                    try:
                        from notifications import notify
                        _push_name = conv.wa_contact_name or from_phone or "Cliente"
                        _type_labels = {"text": None, "audio": "Audio", "image": "Imagen", "video": "Video", "sticker": "Sticker", "document": "Documento"}
                        _type_label = _type_labels.get(msg_type)
                        if _type_label:
                            _push_body = f"Envio un {_type_label.lower()}" + (f": {content[:80]}" if content and not content.startswith("📎") else "")
                        else:
                            _push_body = (content or "")[:120]
                        notify(conv.tenant_id, "whatsapp_message",
                               f"💬 {_push_name} te escribio por WhatsApp",
                               _push_body or "Nuevo mensaje",
                               icon="💬", link="/inbox")
                    except Exception as e:
                        print(f"[WA NOTIFY] Error: {e}")

                    # Queue AI auto-reply if active (only 1 per conversation per webhook batch)
                    # Lina replies to: text, audio (transcribed), image (vision), video (can't see)
                    # Lina IGNORES: stickers, reactions, documents
                    _media_labels = {"text": "texto", "audio": "audio", "image": "imagen", "video": "video"}
                    if msg_type not in ("reaction", "sticker"):
                        log_event("sistema", f"Mensaje recibido de {conv.wa_contact_name or from_phone}", detail=f"Tipo: {_media_labels.get(msg_type, msg_type)} | {(content or '')[:80]}", conv_id=conv.id, contact_name=conv.wa_contact_name or "", status="info")

                    if conv.is_ai_active and msg_type in ("text", "audio", "image", "video"):
                        ai_text = content.strip() if content else ""
                        needs_transcription = msg_type == "audio" and media_url
                        needs_vision = msg_type == "image" and media_url  # Images only — Claude Vision

                        # Videos: Lina can't see them — ask client to explain
                        if msg_type == "video":
                            ai_text = "[SISTEMA: El cliente envio un video. NO puedes ver videos. Dile amablemente que no pudiste cargar el video y preguntale que necesita o que te cuente de que se trata.]"

                        if ai_text or needs_transcription or needs_vision:
                            # Check if this conversation already has a queued reply
                            existing_entry = next((r for r in conversations_to_reply if r["conv_id"] == conv.id), None)
                            if existing_entry:
                                # Merge: append text from additional messages in same batch
                                if ai_text and not ai_text.startswith("📎"):
                                    existing_entry["inbound_text"] = (existing_entry["inbound_text"] + "\n" + ai_text).strip()
                                # If this message has vision and the existing one doesn't, upgrade
                                if needs_vision and not existing_entry.get("needs_vision"):
                                    existing_entry["needs_vision"] = True
                                    existing_entry["media_id"] = media_url
                                    existing_entry["media_mime"] = media_mime
                            else:
                                conversations_to_reply.append({
                                    "conv_id": conv.id,
                                    "from_phone": from_phone,
                                    "inbound_text": ai_text,
                                    "wa_msg_id": wa_msg_id,
                                    "needs_transcription": needs_transcription,
                                    "media_id": media_url if (needs_transcription or needs_vision) else None,
                                    "needs_vision": needs_vision,
                                    "media_mime": media_mime if needs_vision else None,
                                })

                # Process status updates (sent -> delivered -> read)
                for status_data in value.get("statuses", []):
                    wa_msg_id = status_data.get("id", "")
                    new_status = status_data.get("status", "")

                    if new_status in ("sent", "delivered", "read"):
                        msg = db.query(WhatsAppMessage).filter(
                            WhatsAppMessage.wa_message_id == wa_msg_id
                        ).first()
                        if msg:
                            msg.status = new_status

        db.commit()
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[WA Webhook] Error: {e}\n{tb}")
        db.rollback()

    # Schedule AI auto-replies in background (with delay)
    for reply_info in conversations_to_reply:
        background_tasks.add_task(
            ai_auto_reply,
            reply_info["conv_id"],
            reply_info["from_phone"],
            reply_info["inbound_text"],
            reply_info.get("wa_msg_id"),
            reply_info.get("needs_transcription", False),
            reply_info.get("media_id"),
            reply_info.get("needs_vision", False),
            reply_info.get("media_mime"),
        )

    return {"status": "ok"}


# ============================================================================
# AI AUTO-REPLY — Lina IA responds with 10s delay + read receipts
# ============================================================================
from services.whatsapp.helpers import _send_read_receipt

# AI auto-reply moved to services/whatsapp/ai_handler.py (Phase 7 refactor)
from services.whatsapp.ai_handler import ai_auto_reply

# ============================================================================
# STATS
# ============================================================================
@router.get("/stats")
def get_stats(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """WhatsApp stats for dashboard."""
    tid = safe_tid(user, db)

    conv_q = db.query(WhatsAppConversation)
    if tid is not None:
        conv_q = conv_q.filter(WhatsAppConversation.tenant_id == tid)

    msg_q = db.query(WhatsAppMessage)
    if tid is not None:
        msg_q = msg_q.join(WhatsAppConversation, WhatsAppMessage.conversation_id == WhatsAppConversation.id).filter(WhatsAppConversation.tenant_id == tid)

    total_convs = conv_q.count()
    total_messages = msg_q.count()
    total_inbound = msg_q.filter(WhatsAppMessage.direction == "inbound").count()
    total_outbound = msg_q.filter(WhatsAppMessage.direction == "outbound").count()
    unread = conv_q.filter(WhatsAppConversation.unread_count > 0).count()

    return {
        "total_conversations": total_convs,
        "total_messages": total_messages,
        "total_inbound": total_inbound,
        "total_outbound": total_outbound,
        "unread_conversations": unread,
    }


# ============================================================================
# CLEANUP — Delete failed messages
# ============================================================================
@router.delete("/messages/failed")
def delete_failed_messages(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete all messages with status 'failed'."""
    count = db.query(WhatsAppMessage).filter(WhatsAppMessage.status == "failed").delete()
    db.commit()
    return {"deleted": count}


@router.delete("/messages/{msg_id}")
def delete_message(msg_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete a specific message by ID."""
    tid = safe_tid(user, db)
    q = db.query(WhatsAppMessage).filter(WhatsAppMessage.id == msg_id)
    if tid is not None:
        q = q.join(WhatsAppConversation, WhatsAppMessage.conversation_id == WhatsAppConversation.id).filter(WhatsAppConversation.tenant_id == tid)
    msg = q.first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    db.delete(msg)
    db.commit()
    return {"deleted": msg_id}


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete a conversation and all its messages."""
    tid = safe_tid(user, db)
    q = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id)
    if tid is not None:
        q = q.filter(WhatsAppConversation.tenant_id == tid)
    conv = q.first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv_id).delete()
    db.delete(conv)
    db.commit()
    return {"deleted": conv_id}


@router.delete("/conversations")
def delete_all_conversations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete ALL conversations and messages for this tenant."""
    tid = safe_tid(user, db)
    if tid is not None:
        conv_ids = [c.id for c in db.query(WhatsAppConversation.id).filter(WhatsAppConversation.tenant_id == tid).all()]
        if conv_ids:
            msg_count = db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id.in_(conv_ids)).delete(synchronize_session=False)
            conv_count = db.query(WhatsAppConversation).filter(WhatsAppConversation.id.in_(conv_ids)).delete(synchronize_session=False)
        else:
            msg_count = 0
            conv_count = 0
    else:
        msg_count = db.query(WhatsAppMessage).delete()
        conv_count = db.query(WhatsAppConversation).delete()
    db.commit()
    return {"deleted_conversations": conv_count, "deleted_messages": msg_count}


# ============================================================================
# MEDIA PROXY — Proxy media from Meta API (requires auth token)
# ============================================================================
@router.get("/media/{media_id}")
async def proxy_media(media_id: str, db: Session = Depends(get_db)):
    """Proxy media from Meta API (requires auth token that the frontend doesn't have)."""
    from fastapi.responses import Response

    # Get token from tenant DB (preferred) or env var fallback
    token, _ = _get_wa_config_cached(db)
    if not token:
        raise HTTPException(status_code=500, detail="WhatsApp token not configured")

    # Step 1: Get the download URL from Meta
    async with httpx.AsyncClient(timeout=15) as client:
        meta_resp = await client.get(
            f"https://graph.facebook.com/{WA_API_VERSION}/{media_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if meta_resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Media not found")
        download_url = meta_resp.json().get("url")
        mime_type = meta_resp.json().get("mime_type", "application/octet-stream")

    if not download_url:
        raise HTTPException(status_code=404, detail="No download URL returned")

    # Step 2: Download the actual file
    async with httpx.AsyncClient(timeout=30) as client:
        file_resp = await client.get(
            download_url,
            headers={"Authorization": f"Bearer {token}"},
        )
        if file_resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Media download failed")

    return Response(content=file_resp.content, media_type=mime_type)


# ============================================================================
# PROFILE PHOTO — Fetch & update WhatsApp profile photo
# ============================================================================
@router.post("/conversations/{conv_id}/refresh-photo")
async def refresh_profile_photo(conv_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Attempt to fetch/refresh the WhatsApp profile photo for a conversation."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    phone = normalize_phone(conv.wa_contact_phone)

    # Try multiple Meta API approaches to get profile picture
    token, _ = _get_wa_config_cached(db)
    photo_url = None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Approach 1: Business API contacts endpoint
            resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{phone}/profile_picture",
                headers={"Authorization": f"Bearer {token}"},
                params={"type": "large"},
            )
            if resp.status_code == 200:
                data = resp.json()
                photo_url = data.get("data", {}).get("url") or data.get("url") or data.get("profile_picture_url")
    except Exception as e:
        print(f"[WA] Profile photo fetch error: {e}")

    if photo_url:
        conv.wa_profile_photo_url = photo_url
        db.commit()
        return {"photo_url": photo_url}

    return {"photo_url": None, "message": "No se pudo obtener la foto. Meta Cloud API tiene acceso limitado a fotos de perfil de contactos."}


@router.put("/conversations/{conv_id}/photo")
def set_profile_photo(conv_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Manually set a profile photo URL for a conversation."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    conv.wa_profile_photo_url = body.get("photo_url", "").strip() or None
    db.commit()
    return {"id": conv.id, "wa_profile_photo_url": conv.wa_profile_photo_url}


# ============================================================================
# MESSAGE SEARCH — Search messages across all conversations
# ============================================================================
@router.post("/toggle-all-ai")
async def toggle_all_ai(body: _ToggleAllAIRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Enable or disable Lina IA on ALL conversations at once.
    When enabling, immediately catch-up on all conversations with unread inbound messages."""
    # Block reactivation if message limit reached
    tid = safe_tid(user, db)
    if body.enable:
        tenant = db.query(Tenant).filter(Tenant.id == tid).first() if tid else None
        if tenant and tenant.messages_limit and tenant.messages_limit > 0:
            lina_count = tenant.messages_used or 0
            if lina_count >= tenant.messages_limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"Limite de mensajes alcanzado ({lina_count}/{tenant.messages_limit}). Contacta a soporte para recargar."
                )

    updated = (
        db.query(WhatsAppConversation)
        .update({WhatsAppConversation.is_ai_active: body.enable})
    )
    db.commit()

    catchup_count = 0

    # When re-enabling AI, scan the last 15 conversations for any unanswered messages
    if body.enable:
        from sqlalchemy import desc

        # Scan last 15 conversations (by last activity), not just unread
        recent_convs = (
            db.query(WhatsAppConversation)
            .order_by(desc(WhatsAppConversation.last_message_at))
            .limit(15)
            .all()
        )

        for conv in recent_convs:
            # Get the last inbound message (client's last message)
            last_inbound = (
                db.query(WhatsAppMessage)
                .filter(
                    WhatsAppMessage.conversation_id == conv.id,
                    WhatsAppMessage.direction == "inbound",
                )
                .order_by(desc(WhatsAppMessage.created_at))
                .first()
            )
            if not last_inbound:
                continue

            # Only skip if a REAL Lina AI reply (not off-hours, not admin, not failed)
            # was SUCCESSFULLY sent AFTER the client's last message
            last_ai_reply = (
                db.query(WhatsAppMessage)
                .filter(
                    WhatsAppMessage.conversation_id == conv.id,
                    WhatsAppMessage.sent_by == "lina_ia",
                    WhatsAppMessage.status != "failed",
                )
                .order_by(desc(WhatsAppMessage.created_at))
                .first()
            )
            if last_ai_reply and last_ai_reply.created_at > last_inbound.created_at:
                continue  # Lina already replied to this message

            # Skip if already in-flight
            if conv.id in _in_flight_convs:
                continue

            # Collect all pending inbound text after last AI reply for full context
            recent_inbound = (
                db.query(WhatsAppMessage)
                .filter(
                    WhatsAppMessage.conversation_id == conv.id,
                    WhatsAppMessage.direction == "inbound",
                    WhatsAppMessage.created_at >= (last_ai_reply.created_at if last_ai_reply else conv.created_at),
                )
                .order_by(WhatsAppMessage.created_at.asc())
                .all()
            )
            inbound_text = " | ".join(m.content for m in recent_inbound if m.content and not m.content.startswith("📎")) or last_inbound.content or ""

            # Schedule AI reply for this conversation (catchup mode = skip off-hours, shorter delay)
            background_tasks.add_task(
                ai_auto_reply,
                conv.id,
                conv.wa_contact_phone,
                inbound_text,
                None,   # inbound_wa_msg_id
                False,  # needs_transcription
                None,   # media_id
                False,  # needs_vision
                None,   # media_mime
                True,   # is_catchup
            )
            catchup_count += 1

        print(f"[Lina IA] Toggle ON — catching up on {catchup_count} unread conversations.")
        if catchup_count:
            log_event("sistema", f"IA activada globalmente — {catchup_count} chats pendientes", detail=f"Revisando {catchup_count} conversaciones con mensajes sin responder.", status="ok")

    return {"updated": updated, "is_active": body.enable, "catchup": catchup_count}


@router.get("/messages/search")
def search_messages(q: str = Query(..., min_length=2), db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Search messages across all conversations."""
    tid = safe_tid(user, db)
    msg_q = db.query(WhatsAppMessage).filter(WhatsAppMessage.content.ilike(f"%{q}%"))
    if tid is not None:
        msg_q = msg_q.join(WhatsAppConversation, WhatsAppMessage.conversation_id == WhatsAppConversation.id).filter(WhatsAppConversation.tenant_id == tid)
    messages = (
        msg_q
        .order_by(WhatsAppMessage.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": m.id,
            "conversation_id": m.conversation_id,
            "content": m.content,
            "direction": m.direction,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]
