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

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

# ============================================================================
# Config from .env
# ============================================================================
WA_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_BUSINESS_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
WA_WEBHOOK_VERIFY_TOKEN = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "alpelo_webhook_2026")
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_PHONE_ID}"


def wa_headers():
    return {
        "Authorization": f"Bearer {WA_TOKEN}",
        "Content-Type": "application/json",
    }


# ============================================================================
# CONVERSATIONS — List & Get
# ============================================================================
@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db)):
    """List all conversations with last message preview."""
    convs = (
        db.query(WhatsAppConversation)
        .options(joinedload(WhatsAppConversation.client))
        .order_by(WhatsAppConversation.last_message_at.desc().nullslast())
        .all()
    )

    results = []
    for c in convs:
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

            from routes._client_helpers import compute_client_fields
            computed = compute_client_fields(cl, db)

            client_data = {
                "id": cl.id,
                "client_id": cl.client_id,
                "name": cl.name,
                "phone": cl.phone,
                "email": cl.email,
                "status": computed.get("status", "activo"),
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
            "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
            "last_message_preview": last_msg.content[:80] if last_msg else None,
            "last_message_direction": last_msg.direction if last_msg else None,
            "is_ai_active": c.is_ai_active,
            "unread_count": c.unread_count,
            "client": client_data,
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
            "media_url": m.media_url,
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
                    "to": conv.wa_contact_phone.replace("+", "").replace(" ", ""),
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
                print(f"[WA] Send failed: {data}")
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
# SEND TEMPLATE — Send a template message to a phone number
# ============================================================================
@router.post("/send-template")
async def send_template(body: dict, db: Session = Depends(get_db)):
    """Send a template message (e.g. hello_world) to a phone number."""
    phone = body.get("phone", "").replace("+", "").replace(" ", "")
    template_name = body.get("template_name", "hello_world")
    language_code = body.get("language_code", "en_US")

    if not phone:
        raise HTTPException(status_code=400, detail="Numero de telefono requerido")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{WA_BASE_URL}/messages",
                headers=wa_headers(),
                json={
                    "messaging_product": "whatsapp",
                    "to": phone,
                    "type": "template",
                    "template": {
                        "name": template_name,
                        "language": {"code": language_code},
                    },
                },
            )
            data = resp.json()

            if resp.status_code == 200 and "messages" in data:
                return {"success": True, "wa_message_id": data["messages"][0].get("id")}
            else:
                raise HTTPException(status_code=400, detail=data.get("error", {}).get("message", "Error enviando template"))
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error de conexion: {str(e)}")


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
                        # Fetch media URL from WhatsApp API
                        if media_id:
                            try:
                                async with httpx.AsyncClient(timeout=10) as http_client:
                                    media_resp = await http_client.get(
                                        f"https://graph.facebook.com/{WA_API_VERSION}/{media_id}",
                                        headers={"Authorization": f"Bearer {WA_TOKEN}"},
                                    )
                                    if media_resp.status_code == 200:
                                        media_url = media_resp.json().get("url")
                            except Exception:
                                pass
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
                        # Try to match with existing client
                        client = db.query(Client).filter(Client.phone.contains(from_phone[-10:])).first()
                        conv = WhatsAppConversation(
                            wa_contact_phone=from_phone,
                            wa_contact_name=contact_name,
                            client_id=client.id if client else None,
                            is_ai_active=True,
                        )
                        db.add(conv)
                        db.flush()

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

                    # Queue AI auto-reply if active
                    if conv.is_ai_active and msg_type == "text" and content.strip():
                        conversations_to_reply.append({
                            "conv_id": conv.id,
                            "from_phone": from_phone,
                            "inbound_text": content,
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
        print(f"[WA Webhook] Error: {e}")
        db.rollback()

    # Schedule AI auto-replies in background (with delay)
    for reply_info in conversations_to_reply:
        background_tasks.add_task(
            ai_auto_reply,
            reply_info["conv_id"],
            reply_info["from_phone"],
            reply_info["inbound_text"],
        )

    return {"status": "ok"}


# ============================================================================
# AI AUTO-REPLY — Lina IA responds with ~15s delay + typing indicator
# ============================================================================
async def ai_auto_reply(conv_id: int, to_phone: str, inbound_text: str):
    """Background task: show typing, wait ~15s, generate AI response, send."""
    try:
        # Step 1: Send "typing" indicator via WhatsApp API
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{WA_BASE_URL}/messages",
                headers=wa_headers(),
                json={
                    "messaging_product": "whatsapp",
                    "to": to_phone.replace("+", "").replace(" ", ""),
                    "type": "reaction",
                    "status": "typing",
                },
            )

        # Step 2: Wait 12-18 seconds (natural delay)
        import random
        delay = random.uniform(12, 18)
        print(f"[Lina IA] Waiting {delay:.0f}s before replying to conv {conv_id}...")
        await asyncio.sleep(delay)

        # Step 3: Get conversation history and generate AI response
        db = SessionLocal()
        try:
            conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
            if not conv or not conv.is_ai_active:
                return

            # Get last 20 messages for context
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

            # Call AI service (same as chat endpoint)
            from routes.ai_endpoints import _build_system_prompt, _call_ai

            system_prompt = _build_system_prompt(db, is_whatsapp=True)
            ai_response = await _call_ai(system_prompt, history, inbound_text)

            if not ai_response or not ai_response.strip():
                print(f"[Lina IA] No response generated for conv {conv_id}, staying on hold.")
                return

            # Step 4: Send AI response via WhatsApp
            wa_message_id = None
            status = "sent"

            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{WA_BASE_URL}/messages",
                    headers=wa_headers(),
                    json={
                        "messaging_product": "whatsapp",
                        "to": to_phone.replace("+", "").replace(" ", ""),
                        "type": "text",
                        "text": {"body": ai_response},
                    },
                )
                data = resp.json()
                if resp.status_code == 200 and "messages" in data:
                    wa_message_id = data["messages"][0].get("id")
                else:
                    status = "failed"
                    print(f"[Lina IA] Send failed: {data}")

            # Step 5: Store AI response in DB
            msg = WhatsAppMessage(
                conversation_id=conv_id,
                wa_message_id=wa_message_id,
                direction="outbound",
                content=ai_response,
                message_type="text",
                status=status,
                sent_by="lina_ia",
            )
            db.add(msg)
            conv.last_message_at = datetime.utcnow()
            db.commit()

            print(f"[Lina IA] Replied to conv {conv_id}: {ai_response[:60]}...")

        finally:
            db.close()

    except Exception as e:
        print(f"[Lina IA] Auto-reply error: {e}")


# ============================================================================
# MARK AS READ
# ============================================================================
@router.put("/conversations/{conv_id}/read")
def mark_as_read(conv_id: int, db: Session = Depends(get_db)):
    """Mark a conversation as read (reset unread count to 0)."""
    conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    conv.unread_count = 0
    db.commit()
    return {"success": True, "conversation_id": conv_id}


@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db)):
    """Get total unread messages across all conversations."""
    from sqlalchemy import func
    total = db.query(func.coalesce(func.sum(WhatsAppConversation.unread_count), 0)).scalar()
    return {"total_unread": total}


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
