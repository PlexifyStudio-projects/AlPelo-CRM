"""
WhatsApp Helpers — Config, token management, media, transcription.
Extracted from whatsapp_endpoints.py during Phase 7 refactor.
"""
import os
import json
import httpx
from datetime import datetime

from database.connection import SessionLocal
from database.models import Tenant, WhatsAppConversation
from routes._helpers import normalize_phone, now_colombia as _now_col
from activity_log import log_event

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
_DAYS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
_DIAS_ES = _DAYS_ES


def _is_off_hours(db=None, tenant_id=None) -> bool:
    """True if current Colombia time is outside the tenant's business hours.
    Reads from Location table, falls back to 8AM-7PM."""
    now = _now_col()
    current_minutes = now.hour * 60 + now.minute

    open_minutes = 8 * 60    # default 8:00 AM
    close_minutes = 19 * 60  # default 7:00 PM

    try:
        _db = db or SessionLocal()
        try:
            from database.models import Location
            q = _db.query(Location).filter(Location.is_active == True, Location.is_default == True)
            if tenant_id:
                q = q.filter(Location.tenant_id == tenant_id)
            loc = q.first()
            if loc and loc.opening_time and loc.closing_time:
                oh, om = map(int, loc.opening_time.split(":"))
                ch, cm = map(int, loc.closing_time.split(":"))
                open_minutes = oh * 60 + om
                close_minutes = ch * 60 + cm
        finally:
            if not db:
                _db.close()
    except Exception:
        pass

    return current_minutes < open_minutes or current_minutes >= close_minutes

def _off_hours_greeting() -> str:
    """Return 'buenas noches' or 'buenos dias' depending on time."""
    hour = _now_col().hour
    if hour >= 18 or hour < 6:
        return "buenas noches"
    return "buenos dias"

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

# Message queue for conversations that are in-flight (max 3 per conv)
_pending_queue: dict[int, list] = {}
_PENDING_QUEUE_MAX = 3

# ============================================================================
# Config — reads from tenant DB first, falls back to env vars
# ============================================================================
WA_WEBHOOK_VERIFY_TOKEN = os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "plexify_webhook_2026")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


def _get_wa_config_cached(db=None, tenant_id=None):
    """Get WA token + phone_id from tenant DB or env vars.
    Prefers tenant with wa_access_token configured (not just first active)."""
    token = ""
    phone_id = ""

    # 1) Try tenant DB
    if db:
        try:
            if tenant_id:
                t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            else:
                t = db.query(Tenant).filter(
                    Tenant.is_active == True,
                    Tenant.wa_access_token.isnot(None),
                ).first()
            if t:
                if t.wa_access_token:
                    token = t.wa_access_token
                if t.wa_phone_number_id:
                    phone_id = t.wa_phone_number_id
        except Exception as e:
            print(f"[WA-DEBUG] Error reading tenant: {e}")

    # 2) Fallback to env vars
    if not token:
        token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    if not phone_id:
        phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")

    return token, phone_id


# Legacy globals for backward compat (updated lazily)
WA_TOKEN = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
WA_BUSINESS_ID = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
WA_BASE_URL = f"https://graph.facebook.com/{WA_API_VERSION}/{WA_PHONE_ID}"


def wa_headers(db=None):
    """Read token from tenant DB first, fallback to env."""
    token, _ = _get_wa_config_cached(db)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def _get_wa_base_url(db=None):
    """Get the base URL for WA API calls."""
    _, phone_id = _get_wa_config_cached(db)
    return f"https://graph.facebook.com/{WA_API_VERSION}/{phone_id}"


async def _transcribe_audio(media_id: str, db=None) -> str:
    """Download audio from Meta and transcribe with Groq Whisper."""
    if not GROQ_API_KEY:
        return "[Audio recibido - transcripcion no disponible]"

    # Get token from tenant DB first, fallback to env var
    token, _ = _get_wa_config_cached(db)
    if not token:
        return "[Audio recibido - token no configurado]"

    try:
        # Step 1: Get download URL from Meta
        async with httpx.AsyncClient(timeout=15) as client:
            meta_resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{media_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if meta_resp.status_code != 200:
                print(f"[AUDIO] Meta download failed ({meta_resp.status_code}): {meta_resp.text[:100]}")
                return "[Audio recibido - no se pudo descargar]"
            download_url = meta_resp.json().get("url")
            mime_type = meta_resp.json().get("mime_type", "audio/ogg")

        if not download_url:
            return "[Audio recibido - URL no disponible]"

        # Step 2: Download the audio file
        async with httpx.AsyncClient(timeout=30) as client:
            audio_resp = await client.get(
                download_url,
                headers={"Authorization": f"Bearer {token}"},
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


async def _download_media_base64(media_id: str, db=None) -> tuple[bytes | None, str | None]:
    """Download media from Meta API and return (raw_bytes, mime_type)."""
    try:
        # Get token from tenant DB (same pattern as _transcribe_audio)
        token, _ = _get_wa_config_cached(db)
        if not token:
            print(f"[Vision] No WA token available for media download")
            return None, None

        # Step 1: Get download URL from Meta
        async with httpx.AsyncClient(timeout=15) as client:
            meta_resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{media_id}",
                headers={"Authorization": f"Bearer {token}"},
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
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code != 200:
                return None, None

        return resp.content, mime_type

    except Exception as e:
        print(f"[Vision] Media download error: {e}")
        return None, None



async def _cache_media_locally(media_id: str, tenant_id: int = None):
    """Download media from Meta and cache to disk so it survives ID expiry."""
    import os, glob as _glob
    cache_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "media_cache")
    os.makedirs(cache_dir, exist_ok=True)

    # Skip if already cached
    if _glob.glob(os.path.join(cache_dir, f"{media_id}.*")):
        return

    db_temp = SessionLocal()
    try:
        token, _ = _get_wa_config_cached(db_temp, tenant_id=tenant_id)
    finally:
        db_temp.close()
    if not token:
        return

    mime_to_ext = {
        "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
        "video/mp4": ".mp4", "audio/ogg": ".ogg", "audio/mpeg": ".mp3",
        "application/pdf": ".pdf", "image/gif": ".gif",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            meta_resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{media_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if meta_resp.status_code != 200:
                return
            url = meta_resp.json().get("url")
            mime = meta_resp.json().get("mime_type", "application/octet-stream")
            if not url:
                return

        async with httpx.AsyncClient(timeout=30) as client:
            file_resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if file_resp.status_code != 200:
                return

        ext = mime_to_ext.get(mime, ".bin")
        with open(os.path.join(cache_dir, f"{media_id}{ext}"), "wb") as f:
            f.write(file_resp.content)
        print(f"[MEDIA CACHE] Cached {media_id}{ext} ({len(file_resp.content)} bytes)")
    except Exception as e:
        print(f"[MEDIA CACHE] Error caching {media_id}: {e}")


async def _fetch_profile_photo(conv_id: int, wa_phone: str):
    """Try to fetch WhatsApp profile photo URL from Meta Cloud API.

    Attempts multiple Meta API approaches. Note: Cloud API has limited
    access to contact profile photos — works best for business accounts.
    """
    photo_url = None
    clean_phone = normalize_phone(wa_phone)

    # Read token from tenant DB (not stale env var)
    db_temp = SessionLocal()
    try:
        token, phone_id = _get_wa_config_cached(db_temp)
    finally:
        db_temp.close()

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            # Approach 1: Direct profile picture endpoint (works for some contacts)
            resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{clean_phone}/profile_picture",
                headers={"Authorization": f"Bearer {token}"},
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
                    f"https://graph.facebook.com/{WA_API_VERSION}/{phone_id}/contacts",
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
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




async def _send_read_receipt(wa_msg_id: str):
    """Send a read receipt to Meta so the sender sees blue ticks."""
    try:
        async with httpx.AsyncClient(timeout=5) as http_client:
            await http_client.post(
                f"{_get_wa_base_url(db)}/messages",
                headers=wa_headers(db),
                json={
                    "messaging_product": "whatsapp",
                    "status": "read",
                    "message_id": wa_msg_id,
                },
            )
    except Exception:
        pass  # Don't fail on read receipt errors


