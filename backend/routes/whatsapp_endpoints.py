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
from database.connection import get_db, SessionLocal
from database.models import WhatsAppConversation, WhatsAppMessage, Client
from routes._helpers import normalize_phone, now_colombia as _now_col
from schemas import ToggleAllAIRequest as _ToggleAllAIRequest
from activity_log import log_event
from routes._usage_tracker import track_message_sent, track_message_received, track_ai_usage

def _is_off_hours() -> bool:
    """True if current Colombia time is outside business hours (8:30 PM - 7:30 AM)."""
    now = _now_col()
    hour, minute = now.hour, now.minute
    # Off hours: 20:30 (8:30 PM) to 07:30 (7:30 AM)
    if hour > 20 or (hour == 20 and minute >= 30):
        return True
    if hour < 7 or (hour == 7 and minute < 30):
        return True
    return False

def _off_hours_greeting() -> str:
    """Return 'buenas noches' or 'buenos dias' depending on time."""
    hour = _now_col().hour
    if hour >= 18 or hour < 6:
        return "buenas noches"
    return "buenos dias"

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])

# ============================================================================
# Global AI reply rate limiter — max 10 replies per 60 seconds
# ============================================================================
_ai_reply_timestamps: list[float] = []
# WhatsApp Cloud API allows ~80 msgs/sec but we stay conservative.
# 30 AI replies per minute is safe and well under Meta's limits.
_AI_REPLY_MAX = 30
_AI_REPLY_WINDOW = 60  # seconds

# ============================================================================
# Token auto-pause — Lina pauses herself when WA token expires/fails
# ============================================================================
_wa_token_paused = False  # True = token is dead, Lina is paused
_wa_token_fail_count = 0  # Consecutive send failures due to token

def _is_token_error(error_msg: str) -> bool:
    """Check if an error message indicates a token/auth problem."""
    indicators = ["session has expired", "access token", "oauthexception",
                   "invalid oauth", "token has expired", "expired session",
                   "error validating", "(#190)", "unauthorized"]
    lower = (error_msg or "").lower()
    return any(ind in lower for ind in indicators)

def _trigger_token_pause():
    """Pause Lina globally when token is dead."""
    global _wa_token_paused, _wa_token_fail_count
    if _wa_token_paused:
        return  # Already paused
    _wa_token_paused = True
    _wa_token_fail_count = 0
    print("[Lina IA] TOKEN EXPIRED — Auto-pausing all AI responses until token is restored.")
    log_event("sistema", "Token de WhatsApp expirado — Lina en pausa",
              detail="El token de Meta expiro. Lina se pauso automaticamente. Cuando se renueve el token, se reactivara sola.",
              status="error")

def _trigger_token_resume():
    """Resume Lina when token is back."""
    global _wa_token_paused, _wa_token_fail_count
    if not _wa_token_paused:
        return
    _wa_token_paused = False
    _wa_token_fail_count = 0
    print("[Lina IA] TOKEN RESTORED — Resuming AI responses.")
    log_event("sistema", "Token restaurado — Lina reactivada",
              detail="El token de WhatsApp volvio a funcionar. Lina se reactivo automaticamente.",
              status="ok")

# ============================================================================
# In-flight lock per conversation — prevents duplicate concurrent auto-replies
# ============================================================================
_in_flight_convs: set[int] = set()

# ============================================================================
# Config from .env
# ============================================================================
WA_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_BUSINESS_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
WA_WEBHOOK_VERIFY_TOKEN = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "plexify_webhook_2026")
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_PHONE_ID}"


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def wa_headers():
    """Read token fresh from env on every call — survives Railway env var updates without redeploy."""
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "") or WA_TOKEN
    return {
        "Authorization": f"Bearer {token}",
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


async def _download_media_base64(media_id: str) -> tuple[bytes | None, str | None]:
    """Download media from Meta API and return (raw_bytes, mime_type)."""
    try:
        # Step 1: Get download URL from Meta
        async with httpx.AsyncClient(timeout=15) as client:
            meta_resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{media_id}",
                headers={"Authorization": f"Bearer {WA_TOKEN}"},
            )
            if meta_resp.status_code != 200:
                return None, None
            download_url = meta_resp.json().get("url")
            mime_type = meta_resp.json().get("mime_type", "image/jpeg")

        if not download_url:
            return None, None

        # Step 2: Download the file
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                download_url,
                headers={"Authorization": f"Bearer {WA_TOKEN}"},
            )
            if resp.status_code != 200:
                return None, None

        return resp.content, mime_type

    except Exception as e:
        print(f"[Vision] Media download error: {e}")
        return None, None



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
async def toggle_ai(conv_id: int, body: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
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
            print(f"[Lina IA] Already processing conv {conv_id}, skipping duplicate task.")
            log_event("skip", "Ya estoy procesando esta conversacion", conv_id=conv_id, status="warning")
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
                        f"{WA_BASE_URL}/messages", headers=wa_headers(),
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
            transcript = await _transcribe_audio(media_id)
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
            raw_bytes, detected_mime = await _download_media_base64(media_id)
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
            # Fetch 40 messages for better context (Lina needs full picture to avoid repetitions)
            recent_msgs = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == conv_id)
                .order_by(WhatsAppMessage.created_at.desc())
                .limit(40)
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

            # Combine all pending inbound messages into the prompt
            # This catches: image + separate text, or multiple texts before AI responds
            if len(pending_inbound) > 1:
                combined_text = "\n".join(t for t in pending_inbound if t and not t.startswith("📎"))
                if combined_text.strip():
                    inbound_text = combined_text.strip()
                    print(f"[Lina IA] Combined {len(pending_inbound)} pending messages: {inbound_text[:100]}")

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

            log_event("sistema", f"Leyendo conversacion de {conv.wa_contact_name or 'cliente'}", detail=f"Analizando {len(history)} mensajes de historial + contexto del negocio", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")

            system_prompt = _build_system_prompt(db, is_whatsapp=True, conv_id=conv_id)

            # The inbound messages are already in history (from DB).
            # Build the final user message: combined text + image if applicable.
            # Remove the last N inbound entries from history to avoid duplication.
            while history and history[-1]["role"] == "user":
                history.pop()

            log_event("sistema", f"Generando respuesta para {conv.wa_contact_name or 'cliente'}", detail=f"Mensaje del cliente: {(inbound_text or '')[:100]}", conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")

            ai_response = await _call_ai(system_prompt, history, inbound_text, image_b64=image_data_b64, image_mime=image_media_type)

            if not ai_response or not ai_response.strip():
                print(f"[Lina IA] No response generated for conv {conv_id}, staying silent.")
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
                        history, inbound_text, image_b64=image_data_b64, image_mime=image_media_type
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
                    # Retry with explicit instruction
                    retry_msg = (
                        f"[SISTEMA CRITICO: Tu respuesta anterior dice: \"{ai_response[:200]}\" "
                        f"pero NO incluiste NINGUN bloque ```action```. "
                        f"Promesas detectadas: {', '.join(found_promises[:5])}. "
                        f"DEBES incluir UN bloque ```action``` por CADA promesa. "
                        f"Si dijiste 'te cambio la cita' necesitas update_appointment. "
                        f"Si dijiste 'te aviso antes' necesitas add_note PENDIENTE. "
                        f"Responde IGUAL pero con TODOS los bloques ```action``` al final.]\n\n{inbound_text}"
                    )
                    retry_response = await _call_ai(system_prompt, history, retry_msg)
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

                    elif action_type in (
                        "create_client", "update_client", "delete_client",
                        "add_note", "complete_task", "list_clients_by_filter",
                        "create_appointment", "update_appointment", "delete_appointment", "list_appointments",
                        "list_services", "add_visit",
                    ):
                        # Force real phone from conversation for client creation
                        if action_type == "create_client":
                            action_data["phone"] = conv.wa_contact_phone
                            # Propagate tenant from conversation to new client
                            if hasattr(conv, 'tenant_id') and conv.tenant_id:
                                action_data["tenant_id"] = conv.tenant_id

                        # For create_appointment, auto-fill client phone from conversation
                        if action_type == "create_appointment" and not action_data.get("client_phone"):
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
                        }
                        action_label = _action_labels.get(action_type, f"Ejecutando: {action_type}")
                        log_event("accion", action_label, detail=str(action_data)[:200], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="info")

                        # Use FRESH DB session for each action to avoid InFailedSqlTransaction cascade
                        action_db = SessionLocal()
                        try:
                            result = _execute_action(action_data, action_db)
                            print(f"[Lina IA] Action {action_type}: {result}")
                            action_ok = "ERROR" not in result
                            log_event("accion", f"{action_label} — {'Listo' if action_ok else 'Error'}", detail=result[:150], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="ok" if action_ok else "error")

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
                            send_status = "sent"
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

            # Track in global rate limiter
            _ai_reply_timestamps.append(time.time())

            print(f"[Lina IA] Replied to conv {conv_id}: {clean_response[:60]}...")
            if send_status == "sent":
                log_event("respuesta", f"Respondi a {conv.wa_contact_name or 'cliente'}", detail=clean_response[:150], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="ok")

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
            else:
                log_event("respuesta", f"Mensaje generado pero fallo el envio", detail=clean_response[:150], conv_id=conv_id, contact_name=conv.wa_contact_name or "", status="error")

        finally:
            db.close()

    except Exception as e:
        print(f"[Lina IA] Auto-reply error: {e}")
        log_event("error", "Error interno al procesar respuesta", detail=str(e)[:200], conv_id=conv_id, status="error")
    finally:
        # Always release the in-flight lock
        _in_flight_convs.discard(conv_id)


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
@router.post("/toggle-all-ai")
async def toggle_all_ai(body: _ToggleAllAIRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Enable or disable Lina IA on ALL conversations at once.
    When enabling, immediately catch-up on all conversations with unread inbound messages."""
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
