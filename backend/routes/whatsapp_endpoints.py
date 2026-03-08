# ============================================================================
# AlPelo - WhatsApp Business API Endpoints
# Real Meta API integration + local DB storage + Lina IA auto-reply
# ============================================================================

import os
import asyncio
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Query, BackgroundTasks
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session, joinedload
from database.connection import get_db, SessionLocal
from database.models import WhatsAppConversation, WhatsAppMessage, Client
from routes._helpers import normalize_phone

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

# ============================================================================
# Global AI reply rate limiter — max 10 replies per 60 seconds
# ============================================================================
_ai_reply_timestamps: list[float] = []
_AI_REPLY_MAX = 10
_AI_REPLY_WINDOW = 60  # seconds

# ============================================================================
# Config from .env
# ============================================================================
WA_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_BUSINESS_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
WA_WEBHOOK_VERIFY_TOKEN = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "alpelo_webhook_2026")
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_PHONE_ID}"


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def wa_headers():
    return {
        "Authorization": f"Bearer {WA_TOKEN}",
        "Content-Type": "application/json",
    }


async def _transcribe_audio(media_id: str) -> str:
    """Download audio from Meta and transcribe with Groq Whisper."""
    if not GROQ_API_KEY:
        return "[Audio recibido - transcripcion no disponible]"

    try:
        # Step 1: Get download URL from Meta
        async with httpx.AsyncClient(timeout=15) as client:
            meta_resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{media_id}",
                headers={"Authorization": f"Bearer {WA_TOKEN}"},
            )
            if meta_resp.status_code != 200:
                return "[Audio recibido - no se pudo descargar]"
            download_url = meta_resp.json().get("url")
            mime_type = meta_resp.json().get("mime_type", "audio/ogg")

        if not download_url:
            return "[Audio recibido - URL no disponible]"

        # Step 2: Download the audio file
        async with httpx.AsyncClient(timeout=30) as client:
            audio_resp = await client.get(
                download_url,
                headers={"Authorization": f"Bearer {WA_TOKEN}"},
            )
            if audio_resp.status_code != 200:
                return "[Audio recibido - descarga fallida]"

        audio_bytes = audio_resp.content

        # Step 3: Send to Groq Whisper for transcription
        ext = "ogg" if "ogg" in mime_type else "mp4" if "mp4" in mime_type else "wav"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                data={"model": "whisper-large-v3", "language": "es"},
                files={"file": (f"audio.{ext}", audio_bytes, mime_type)},
            )
            if resp.status_code == 200:
                transcript = resp.json().get("text", "").strip()
                if transcript:
                    return transcript
                return "[Audio vacio o inaudible]"
            else:
                print(f"[Whisper] Transcription failed: {resp.status_code} {resp.text[:200]}")
                return "[Audio recibido - transcripcion fallida]"

    except Exception as e:
        print(f"[Whisper] Error: {e}")
        return "[Audio recibido - error de transcripcion]"


async def _fetch_profile_photo(conv_id: int, wa_phone: str):
    """Try to fetch WhatsApp profile photo URL from Meta Cloud API.

    Attempts multiple Meta API approaches. Note: Cloud API has limited
    access to contact profile photos — works best for business accounts.
    """
    photo_url = None
    clean_phone = normalize_phone(wa_phone)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Approach 1: Direct profile picture endpoint (works for some contacts)
            resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{clean_phone}/profile_picture",
                headers={"Authorization": f"Bearer {WA_TOKEN}"},
                params={"type": "large", "redirect": "false"},
            )
            if resp.status_code == 200:
                data = resp.json()
                photo_url = (
                    data.get("data", {}).get("url")
                    or data.get("url")
                    or data.get("profile_picture_url")
                )

            # Approach 2: Contacts endpoint with phone number
            if not photo_url:
                resp2 = await client.post(
                    f"https://graph.facebook.com/{WA_API_VERSION}/{WA_PHONE_ID}/contacts",
                    headers={"Authorization": f"Bearer {WA_TOKEN}", "Content-Type": "application/json"},
                    json={"blocking": "wait", "contacts": [f"+{clean_phone}"], "force_check": True},
                )
                if resp2.status_code == 200:
                    contacts = resp2.json().get("contacts", [])
                    for contact in contacts:
                        pic = contact.get("profile", {}).get("photo")
                        if pic:
                            photo_url = pic
                            break

        if photo_url:
            db = SessionLocal()
            try:
                conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
                if conv:
                    conv.wa_profile_photo_url = photo_url
                    db.commit()
                    print(f"[WA] Profile photo saved for conv {conv_id}: {photo_url[:60]}...")
            finally:
                db.close()
        else:
            print(f"[WA] No profile photo available for {clean_phone} (Cloud API limitation)")

    except Exception as e:
        print(f"[WA] Profile photo fetch failed for {wa_phone}: {e}")


# ============================================================================
# CONVERSATIONS — List & Get
# ============================================================================
@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db)):
    """List all conversations with last message preview."""
    try:
        convs = (
            db.query(WhatsAppConversation)
            .options(joinedload(WhatsAppConversation.client))
            .order_by(WhatsAppConversation.last_message_at.desc().nullslast())
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

            results.append({
                "id": c.id,
                "wa_contact_phone": c.wa_contact_phone,
                "wa_contact_name": c.wa_contact_name,
                "wa_profile_photo_url": getattr(c, 'wa_profile_photo_url', None),
                "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
                "last_message_preview": last_msg.content[:80] if last_msg else None,
                "last_message_direction": last_msg.direction if last_msg else None,
                "is_ai_active": c.is_ai_active,
                "unread_count": c.unread_count,
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
def get_conversation(conv_id: int, db: Session = Depends(get_db)):
    conv = (
        db.query(WhatsAppConversation)
        .options(joinedload(WhatsAppConversation.client))
        .filter(WhatsAppConversation.id == conv_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    return conv


# ============================================================================
# TOGGLE AI — Enable/disable Lina IA auto-reply for a conversation
# ============================================================================
@router.put("/conversations/{conv_id}/ai")
def toggle_ai(conv_id: int, body: dict, db: Session = Depends(get_db)):
    """Toggle Lina IA auto-reply on/off for a specific conversation."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    conv.is_ai_active = body.get("is_ai_active", not conv.is_ai_active)
    db.commit()
    return {"id": conv.id, "is_ai_active": conv.is_ai_active}


# ============================================================================
# UPDATE TAGS — Set tags for a conversation
# ============================================================================
@router.put("/conversations/{conv_id}/tags")
def update_tags(conv_id: int, body: dict, db: Session = Depends(get_db)):
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
def mark_conversation_read(conv_id: int, db: Session = Depends(get_db)):
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
def get_total_unread(db: Session = Depends(get_db)):
    """Get total unread message count across all conversations."""
    from sqlalchemy import func
    total = db.query(func.coalesce(func.sum(WhatsAppConversation.unread_count), 0)).scalar()
    return {"total_unread": total}


# ============================================================================
# MESSAGES — List & Send
# ============================================================================
@router.get("/conversations/{conv_id}/messages")
def list_messages(conv_id: int, db: Session = Depends(get_db)):
    """List all messages in a conversation."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
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
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: int, body: dict, db: Session = Depends(get_db)):
    """Send a WhatsApp message via Meta API and store locally."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    text = body.get("content", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Mensaje vacio")

    # Send via Meta WhatsApp API
    wa_message_id = None
    status = "sent"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{WA_BASE_URL}/messages",
                headers=wa_headers(),
                json={
                    "messaging_product": "whatsapp",
                    "to": normalize_phone(conv.wa_contact_phone),
                    "type": "text",
                    "text": {"body": text},
                },
            )
            data = resp.json()

            if resp.status_code == 200 and "messages" in data:
                wa_message_id = data["messages"][0].get("id")
                status = "sent"
            else:
                status = "failed"
                error_msg = data.get("error", {}).get("message", str(data))
                print(f"[WA] Send failed ({resp.status_code}): {error_msg}")
    except Exception as e:
        status = "failed"
        print(f"[WA] Send error: {e}")

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
async def list_templates():
    """List all message templates from Meta Business Account."""
    if not WA_BUSINESS_ID:
        raise HTTPException(status_code=500, detail="WHATSAPP_BUSINESS_ACCOUNT_ID no configurado")

    try:
        url = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_BUSINESS_ID}/message_templates"
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=wa_headers(), params={"limit": 50})
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
async def send_template(body: dict, db: Session = Depends(get_db)):
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
                f"{WA_BASE_URL}/messages",
                headers=wa_headers(),
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
def create_conversation(body: dict, db: Session = Depends(get_db)):
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

                    conv = db.query(WhatsAppConversation).filter(
                        WhatsAppConversation.wa_contact_phone == from_phone
                    ).first()

                    if not conv:
                        # Try to match with existing ACTIVE client only
                        client = db.query(Client).filter(
                            Client.phone.contains(from_phone[-10:]),
                            Client.is_active == True
                        ).first()
                        conv = WhatsAppConversation(
                            wa_contact_phone=from_phone,
                            wa_contact_name=contact_name,
                            client_id=client.id if client else None,
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

                    # Queue AI auto-reply if active (only 1 per conversation per webhook batch)
                    # Lina replies to: text, audio (transcribed), image/video WITH caption
                    # Lina IGNORES: stickers, reactions, images/videos without caption
                    if conv.is_ai_active and msg_type in ("text", "audio", "image", "video"):
                        ai_text = content.strip() if content else ""
                        # For audio, transcribe first (will be done in background)
                        needs_transcription = msg_type == "audio" and media_url
                        # For image/video: only reply if there's a real caption (not our placeholder)
                        if msg_type in ("image", "video"):
                            caption = msg_data.get(msg_type, {}).get("caption", "")
                            if not caption:
                                # No caption = casual media, skip AI reply
                                ai_text = ""

                        if ai_text or needs_transcription:
                            already_queued = any(r["conv_id"] == conv.id for r in conversations_to_reply)
                            if not already_queued:
                                conversations_to_reply.append({
                                    "conv_id": conv.id,
                                    "from_phone": from_phone,
                                    "inbound_text": ai_text,
                                    "wa_msg_id": wa_msg_id,
                                    "needs_transcription": needs_transcription,
                                    "media_id": media_url if needs_transcription else None,
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
        )

    return {"status": "ok"}


# ============================================================================
# AI AUTO-REPLY — Lina IA responds with 10s delay + read receipts
# ============================================================================
async def _send_read_receipt(wa_msg_id: str):
    """Send a read receipt to Meta so the sender sees blue ticks."""
    try:
        async with httpx.AsyncClient(timeout=5) as http_client:
            await http_client.post(
                f"{WA_BASE_URL}/messages",
                headers=wa_headers(),
                json={
                    "messaging_product": "whatsapp",
                    "status": "read",
                    "message_id": wa_msg_id,
                },
            )
    except Exception:
        pass  # Don't fail on read receipt errors


async def ai_auto_reply(conv_id: int, to_phone: str, inbound_text: str, inbound_wa_msg_id: str = None, needs_transcription: bool = False, media_id: str = None):
    """Background task: mark as read, wait 10s, generate AI response, send."""
    import time

    try:
        # Step 0: Send read receipt immediately (blue ticks)
        if inbound_wa_msg_id:
            await _send_read_receipt(inbound_wa_msg_id)

        # Step 0.5: Transcribe audio if needed
        if needs_transcription and media_id:
            print(f"[Lina IA] Transcribing audio for conv {conv_id}...")
            transcript = await _transcribe_audio(media_id)
            inbound_text = f"[Audio del cliente]: {transcript}"
            print(f"[Lina IA] Transcript: {transcript[:100]}...")

            # Update the stored message content with the transcription
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

        # Step 1: Wait exactly 10 seconds (natural delay)
        print(f"[Lina IA] Waiting 10s before replying to conv {conv_id}...")
        await asyncio.sleep(10)

        # Step 1.5: Check global rate limit — max 10 AI replies per 60 seconds
        now = time.time()
        # Prune old timestamps
        _ai_reply_timestamps[:] = [t for t in _ai_reply_timestamps if now - t < _AI_REPLY_WINDOW]
        if len(_ai_reply_timestamps) >= _AI_REPLY_MAX:
            print(f"[Lina IA] Global rate limit reached ({_AI_REPLY_MAX}/min). Skipping conv {conv_id}.")
            return

        # Step 2: Check per-conversation cooldown — skip if Lina already replied in last 60 seconds
        db = SessionLocal()
        try:
            conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
            if not conv or not conv.is_ai_active:
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
                if seconds_since < 20:
                    print(f"[Lina IA] Cooldown active for conv {conv_id} ({seconds_since:.0f}s ago). Skipping.")
                    return

            # Step 2.5: Goodbye detection — if Lina already said goodbye, don't reply to farewell messages
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
            if last_ai_msg and last_ai_msg.content:
                last_ai_lower = last_ai_msg.content.lower()
                inbound_lower = inbound_text.lower().strip() if inbound_text else ""
                lina_said_bye = any(gw in last_ai_lower for gw in GOODBYE_WORDS)
                client_says_bye = any(cw == inbound_lower or inbound_lower.startswith(cw + " ") or inbound_lower.endswith(" " + cw) or cw in inbound_lower.split() for cw in CLIENT_BYE_WORDS)
                if lina_said_bye and client_says_bye:
                    print(f"[Lina IA] Goodbye detected — Lina already said bye, client replied with farewell. Staying silent for conv {conv_id}.")
                    return

            # Step 3: Get conversation history and generate AI response
            recent_msgs = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == conv_id)
                .order_by(WhatsAppMessage.created_at.desc())
                .limit(20)
                .all()
            )
            recent_msgs.reverse()

            history = []
            for m in recent_msgs:
                role = "user" if m.direction == "inbound" else "assistant"
                history.append({"role": role, "content": m.content})

            from routes.ai_endpoints import _build_system_prompt, _call_ai

            system_prompt = _build_system_prompt(db, is_whatsapp=True, conv_id=conv_id)

            # The inbound message is already in history (from DB), so pass empty
            # to avoid duplication. _call_ai appends user_message to history.
            if history and history[-1]["role"] == "user" and history[-1]["content"] == inbound_text:
                ai_response = await _call_ai(system_prompt, history[:-1], inbound_text)
            else:
                ai_response = await _call_ai(system_prompt, history, inbound_text)

            if not ai_response or not ai_response.strip():
                print(f"[Lina IA] No response generated for conv {conv_id}, staying silent.")
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

            for action_json in action_matches:
                try:
                    action_data = json.loads(action_json.strip())
                    action_type = action_data.get("action")

                    if action_type == "tag_conversation":
                        # Handle conversation tagging
                        tags = action_data.get("tags", [])
                        if tags:
                            existing_tags = conv.tags or []
                            conv.tags = list(set(existing_tags + tags))
                            db.commit()
                            print(f"[Lina IA] Tagged conv {conv_id}: {tags}")
                    elif action_type in ("create_client", "add_note", "update_client"):
                        # Force real phone from conversation (never trust AI-generated phone)
                        if action_type == "create_client":
                            action_data["phone"] = conv.wa_contact_phone

                        # Use existing action executor
                        from routes.ai_endpoints import _execute_action
                        result = _execute_action(action_data, db)
                        print(f"[Lina IA] Action {action_type}: {result}")

                        # If client was created, link to conversation
                        if action_type == "create_client" and "ERROR" not in result:
                            from database.models import Client as ClientModel
                            new_client = db.query(ClientModel).filter(
                                ClientModel.phone == conv.wa_contact_phone
                            ).first()
                            if new_client and not conv.client_id:
                                conv.client_id = new_client.id
                                db.commit()
                                print(f"[Lina IA] Linked conv {conv_id} to client {new_client.client_id}")
                except Exception as action_err:
                    print(f"[Lina IA] Action error: {action_err}")

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
                clean_response = "Hola! Soy Lina de AlPelo Peluqueria. En que te puedo ayudar?"

            # Step 4: Send AI response via WhatsApp
            wa_message_id = None
            send_status = "sent"
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.post(
                        f"{WA_BASE_URL}/messages",
                        headers=wa_headers(),
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
                    else:
                        send_status = "failed"
                        print(f"[Lina IA] WhatsApp send failed for conv {conv_id}: {data}")
            except Exception as send_err:
                send_status = "failed"
                print(f"[Lina IA] WhatsApp send error for conv {conv_id}: {send_err}")

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

            # Track in global rate limiter
            _ai_reply_timestamps.append(time.time())

            print(f"[Lina IA] Replied to conv {conv_id}: {clean_response[:60]}...")

        finally:
            db.close()

    except Exception as e:
        print(f"[Lina IA] Auto-reply error: {e}")



# ============================================================================
# STATS
# ============================================================================
@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """WhatsApp stats for dashboard."""
    total_convs = db.query(WhatsAppConversation).count()
    total_messages = db.query(WhatsAppMessage).count()
    total_inbound = db.query(WhatsAppMessage).filter(WhatsAppMessage.direction == "inbound").count()
    total_outbound = db.query(WhatsAppMessage).filter(WhatsAppMessage.direction == "outbound").count()
    unread = db.query(WhatsAppConversation).filter(WhatsAppConversation.unread_count > 0).count()

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
def delete_failed_messages(db: Session = Depends(get_db)):
    """Delete all messages with status 'failed'."""
    count = db.query(WhatsAppMessage).filter(WhatsAppMessage.status == "failed").delete()
    db.commit()
    return {"deleted": count}


@router.delete("/messages/{msg_id}")
def delete_message(msg_id: int, db: Session = Depends(get_db)):
    """Delete a specific message by ID."""
    msg = db.query(WhatsAppMessage).filter(WhatsAppMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    db.delete(msg)
    db.commit()
    return {"deleted": msg_id}


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: int, db: Session = Depends(get_db)):
    """Delete a conversation and all its messages."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv_id).delete()
    db.delete(conv)
    db.commit()
    return {"deleted": conv_id}


@router.delete("/conversations")
def delete_all_conversations(db: Session = Depends(get_db)):
    """Delete ALL conversations and messages. Used for clean testing."""
    msg_count = db.query(WhatsAppMessage).delete()
    conv_count = db.query(WhatsAppConversation).delete()
    db.commit()
    return {"deleted_conversations": conv_count, "deleted_messages": msg_count}


# ============================================================================
# MEDIA PROXY — Proxy media from Meta API (requires auth token)
# ============================================================================
@router.get("/media/{media_id}")
async def proxy_media(media_id: str):
    """Proxy media from Meta API (requires auth token that the frontend doesn't have)."""
    from fastapi.responses import Response

    # Step 1: Get the download URL from Meta
    async with httpx.AsyncClient(timeout=15) as client:
        meta_resp = await client.get(
            f"https://graph.facebook.com/{WA_API_VERSION}/{media_id}",
            headers={"Authorization": f"Bearer {WA_TOKEN}"},
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
            headers={"Authorization": f"Bearer {WA_TOKEN}"},
        )
        if file_resp.status_code != 200:
            raise HTTPException(status_code=404, detail="Media download failed")

    return Response(content=file_resp.content, media_type=mime_type)


# ============================================================================
# PROFILE PHOTO — Fetch & update WhatsApp profile photo
# ============================================================================
@router.post("/conversations/{conv_id}/refresh-photo")
async def refresh_profile_photo(conv_id: int, db: Session = Depends(get_db)):
    """Attempt to fetch/refresh the WhatsApp profile photo for a conversation."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")

    phone = normalize_phone(conv.wa_contact_phone)

    # Try multiple Meta API approaches to get profile picture
    photo_url = None
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Approach 1: Business API contacts endpoint
            resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{phone}/profile_picture",
                headers={"Authorization": f"Bearer {WA_TOKEN}"},
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
def set_profile_photo(conv_id: int, body: dict, db: Session = Depends(get_db)):
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
@router.get("/messages/search")
def search_messages(q: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    """Search messages across all conversations."""
    messages = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.content.ilike(f"%{q}%"))
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
