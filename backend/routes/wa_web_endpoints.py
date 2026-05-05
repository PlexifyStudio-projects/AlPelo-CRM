"""
WhatsApp Web (Baileys) endpoints.

Two surfaces:
  1. Admin API (requires auth)        — start/stop/status of the tenant's web session
  2. Webhook from Node service        — receives QR/connect/message events

The webhook translates Baileys events into the same WhatsAppMessage/Conversation
shape used by the Meta webhook in whatsapp_endpoints.py, so Lina, sentiment,
notifications, AI auto-reply etc. all work identically regardless of transport.
"""
import os
import re
import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session

from database.connection import get_db, SessionLocal
from database.models import (
    Tenant, WhatsAppConversation, WhatsAppMessage, Client,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid, normalize_phone
from routes._usage_tracker import track_message_received
from activity_log import log_event


# IMPORTANT: read these dynamically (not at import time). The embedded Node
# launcher generates WA_WEB_SERVICE_TOKEN at lifespan startup, AFTER this
# module is imported. Snapshotting at import time leaves us stuck on the
# empty string forever and Node returns 401.
def _wa_web_service_url() -> str:
    return os.getenv("WA_WEB_SERVICE_URL", "http://127.0.0.1:3100").rstrip("/")


def _wa_web_service_token() -> str:
    return os.getenv("WA_WEB_SERVICE_TOKEN", "")


def _public_backend_url() -> str:
    return os.getenv(
        "PUBLIC_BACKEND_URL",
        f"http://127.0.0.1:{os.getenv('PORT', '8000')}",
    )


router = APIRouter(prefix="/wa-web", tags=["WhatsApp Web"])


def _node_headers() -> dict:
    h = {"Content-Type": "application/json"}
    token = _wa_web_service_token()
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _session_id(tenant: Tenant) -> str:
    return tenant.wa_web_session_id or f"tenant_{tenant.id}"


def _webhook_url() -> str:
    base = _public_backend_url().rstrip("/")
    if not base:
        return ""
    return f"{base}/api/wa-web/webhook"


# ============================================================================
# Admin API — manage the tenant's WA Web session
# ============================================================================
@router.post("/sessions/start")
async def start_session(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Start (or refresh) the WhatsApp Web session for the current tenant."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant context")
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if not tenant.wa_web_disclaimer_accepted_at:
        raise HTTPException(status_code=400, detail="Debe aceptar el disclaimer antes de activar el modo Web")

    service_url = _wa_web_service_url()
    if not service_url:
        raise HTTPException(status_code=503, detail="WA_WEB_SERVICE_URL no configurado en el backend")

    sid = _session_id(tenant)
    tenant.wa_web_session_id = sid
    tenant.wa_web_status = "connecting"
    tenant.wa_web_last_qr_at = datetime.utcnow()
    db.commit()

    def _reset_status(reason: str):
        """Roll back wa_web_status when the Node service can't be reached, so the UI
        doesn't get stuck on 'Generando QR...' forever."""
        try:
            tenant.wa_web_status = "disconnected"
            db.commit()
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
        log_event("sistema", f"WA Web: fallo al iniciar sesion ({reason})", status="error")

    try:
        async with httpx.AsyncClient(timeout=20) as c:
            resp = await c.post(
                f"{service_url}/sessions/{sid}/start",
                headers=_node_headers(),
                json={"tenantId": tid, "webhookUrl": _webhook_url()},
            )
            data = resp.json() if resp.content else {}
            if resp.status_code >= 400:
                _reset_status(f"node {resp.status_code}")
                raise HTTPException(status_code=502, detail=data.get("error", "Web service error"))
        log_event("sistema", f"WA Web: sesion iniciada para tenant {tid}", status="info")
        return {"ok": True, "session_id": sid, **data}
    except httpx.ConnectError:
        _reset_status("connect error")
        raise HTTPException(
            status_code=503,
            detail="Servicio WA Web no disponible. El microservicio Node no responde en " + service_url,
        )
    except httpx.TimeoutException:
        _reset_status("timeout")
        raise HTTPException(status_code=504, detail="Timeout al contactar el servicio WA Web")
    except HTTPException:
        raise
    except Exception as e:
        _reset_status(f"unexpected: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"Error iniciando sesion WA Web: {e}")


@router.get("/sessions/status")
async def session_status(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return current WA Web session status, including QR if pending."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant context")
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    sid = _session_id(tenant)
    remote = {}
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            resp = await c.get(f"{_wa_web_service_url()}/sessions/{sid}/status", headers=_node_headers())
            if resp.content:
                remote = resp.json()
    except Exception:
        remote = {"error": "Servicio WA Web no disponible"}

    return {
        "ok": True,
        "session_id": sid,
        "wa_mode": tenant.wa_mode,
        "db_status": tenant.wa_web_status,
        "phone": tenant.wa_web_phone,
        "connected_at": tenant.wa_web_connected_at.isoformat() if tenant.wa_web_connected_at else None,
        "warmup_started_at": tenant.wa_web_warmup_started_at.isoformat() if tenant.wa_web_warmup_started_at else None,
        "daily_limit": tenant.wa_web_daily_limit,
        "sent_today": tenant.wa_web_sent_today or 0,
        "pacing_seconds": [tenant.wa_web_pacing_min_seconds, tenant.wa_web_pacing_max_seconds],
        "disclaimer_accepted_at": tenant.wa_web_disclaimer_accepted_at.isoformat() if tenant.wa_web_disclaimer_accepted_at else None,
        "remote": remote,
    }


@router.post("/sessions/disconnect")
async def disconnect_session(
    body: dict = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Stop the session. ?logout=true wipes Baileys credentials so a new QR is required."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant context")
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    logout = bool((body or {}).get("logout"))
    sid = _session_id(tenant)

    try:
        async with httpx.AsyncClient(timeout=15) as c:
            await c.delete(
                f"{_wa_web_service_url()}/sessions/{sid}",
                headers=_node_headers(),
                params={"logout": "1"} if logout else {},
            )
    except Exception as e:
        print(f"[wa-web] disconnect node call failed: {e}")

    tenant.wa_web_status = "disconnected"
    if logout:
        tenant.wa_web_phone = None
        tenant.wa_web_connected_at = None
    db.commit()
    log_event("sistema", f"WA Web: sesion {'cerrada' if logout else 'pausada'} (tenant {tid})", status="info")
    return {"ok": True}


@router.put("/settings")
async def update_web_settings(body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Update WA Web tenant settings: mode toggle, pacing, daily limit, disclaimer accept."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant context")
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Mode toggle
    if "wa_mode" in body:
        new_mode = (body["wa_mode"] or "meta").strip().lower()
        if new_mode not in ("meta", "web"):
            raise HTTPException(status_code=400, detail="wa_mode invalido (meta|web)")
        tenant.wa_mode = new_mode

    # Disclaimer
    if body.get("accept_disclaimer"):
        tenant.wa_web_disclaimer_accepted_at = datetime.utcnow()

    # Pacing
    pmin = body.get("pacing_min_seconds")
    pmax = body.get("pacing_max_seconds")
    if pmin is not None:
        v = max(10, int(pmin))
        tenant.wa_web_pacing_min_seconds = v
    if pmax is not None:
        v = max(tenant.wa_web_pacing_min_seconds or 30, int(pmax))
        tenant.wa_web_pacing_max_seconds = v

    # Daily limit (clamped to safe range)
    if "daily_limit" in body:
        v = int(body["daily_limit"] or 20)
        tenant.wa_web_daily_limit = max(5, min(v, 500))

    db.commit()
    return {"ok": True, "wa_mode": tenant.wa_mode, "daily_limit": tenant.wa_web_daily_limit}


# ============================================================================
# Webhook from Node service — translates Baileys events to internal format
# ============================================================================
def _verify_webhook_token(request: Request) -> bool:
    token = _wa_web_service_token()
    if not token:
        return True  # dev mode
    header = request.headers.get("x-wa-web-token") or ""
    return header == token


@router.post("/webhook")
async def receive_web_event(request: Request, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Webhook called by the Node service for QR/connect/disconnect/message events.

    Auth: shared `X-WA-Web-Token` header.
    """
    if not _verify_webhook_token(request):
        raise HTTPException(status_code=401, detail="Invalid webhook token")

    payload = await request.json()
    event_type = payload.get("type")
    tenant_id = payload.get("tenantId")
    session_id = payload.get("sessionId") or ""

    if not tenant_id:
        return {"ok": False, "error": "missing tenantId"}

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        return {"ok": False, "error": "tenant not found"}

    # Anti-spoofing: sessionId must match the canonical pattern OR what we registered for this tenant.
    expected_session = f"tenant_{tenant_id}"
    registered_session = (tenant.wa_web_session_id or "").strip()
    if session_id and session_id != expected_session and session_id != registered_session:
        print(f"[wa-web webhook] session mismatch: got '{session_id}' for tenant {tenant_id} (expected '{expected_session}' or '{registered_session}')")
        log_event("sistema", "WA Web webhook rechazado: sesion no coincide con tenant",
                  detail=f"sessionId={session_id}, tenantId={tenant_id}", status="error")
        raise HTTPException(status_code=403, detail="session/tenant mismatch")

    # ----------------------------------------------------------------
    # Status events
    # ----------------------------------------------------------------
    if event_type == "qr":
        tenant.wa_web_status = "qr"
        tenant.wa_web_last_qr_at = datetime.utcnow()
        db.commit()
        return {"ok": True}

    if event_type == "connected":
        phone = payload.get("phone")
        tenant.wa_web_status = "connected"
        tenant.wa_web_phone = phone
        tenant.wa_web_connected_at = datetime.utcnow()
        if not tenant.wa_web_warmup_started_at:
            tenant.wa_web_warmup_started_at = datetime.utcnow()
        db.commit()
        log_event("sistema", f"WA Web conectado: {phone}", status="ok")
        return {"ok": True}

    if event_type in ("disconnected", "banned"):
        tenant.wa_web_status = event_type
        db.commit()
        log_event(
            "sistema",
            f"WA Web {event_type}: {payload.get('error') or ''}",
            status="error" if event_type == "banned" else "warning",
        )
        return {"ok": True}

    # ----------------------------------------------------------------
    # Contact update — name + profile picture pulled per-jid by the Node
    # service after the initial history sync. Updates the conversation row
    # so the inbox shows real names and avatars instead of raw phone digits.
    # ----------------------------------------------------------------
    if event_type == "contact_update":
        phone_raw = (payload.get("phone") or "").strip()
        new_name = (payload.get("name") or "").strip()
        new_photo = (payload.get("profile_pic_url") or "").strip()
        if not phone_raw:
            return {"ok": False, "error": "missing phone"}

        clean_phone = re.sub(r"\D", "", phone_raw)
        last10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone

        # Find ALL web convs for this tenant whose phone matches (last 10 digits)
        all_convs = (
            db.query(WhatsAppConversation)
            .filter(WhatsAppConversation.tenant_id == tenant_id)
            .filter(WhatsAppConversation.transport == "web")
            .all()
        )
        targets = [c for c in all_convs if re.sub(r"\D", "", c.wa_contact_phone or "")[-10:] == last10]

        for conv in targets:
            # Only overwrite name if it's empty or a raw phone number (no real name yet)
            existing_name = (conv.wa_contact_name or "").strip()
            existing_is_numeric = existing_name.replace("+", "").replace(" ", "").isdigit()
            if new_name and (not existing_name or existing_is_numeric):
                conv.wa_contact_name = new_name
            # Photo: replace if missing
            if new_photo and not (conv.wa_profile_photo_url or "").strip():
                conv.wa_profile_photo_url = new_photo
        try:
            db.commit()
        except Exception:
            db.rollback()
        return {"ok": True, "matched": len(targets)}

    # ----------------------------------------------------------------
    # History sync — populate inbox with the existing chats from the phone
    # ----------------------------------------------------------------
    if event_type == "history_sync":
        chats = payload.get("chats") or []
        ingested = 0
        for chat in chats:
            try:
                phone_raw = (chat.get("phone") or "").strip()
                if not phone_raw:
                    continue
                clean_phone = re.sub(r"\D", "", phone_raw)
                clean_last10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone

                # Find or create conv (transport='web')
                conv = (
                    db.query(WhatsAppConversation)
                    .filter(WhatsAppConversation.tenant_id == tenant_id)
                    .filter(WhatsAppConversation.transport == "web")
                    .filter(WhatsAppConversation.wa_contact_phone.in_([phone_raw, clean_phone, f"+{clean_phone}"]))
                    .first()
                )
                if not conv:
                    # Try to link to an existing client by last 10 digits
                    client = next(
                        (
                            c for c in db.query(Client)
                                .filter(Client.tenant_id == tenant_id, Client.is_active == True)
                                .all()
                            if (re.sub(r"\D", "", c.phone or "")[-10:] == clean_last10)
                        ),
                        None,
                    )
                    conv = WhatsAppConversation(
                        tenant_id=tenant_id,
                        wa_contact_phone=phone_raw,
                        wa_contact_name=chat.get("name"),
                        client_id=client.id if client else None,
                        is_ai_active=False,  # imported chats: don't auto-reply with Lina
                        unread_count=int(chat.get("unread") or 0),
                        transport="web",
                    )
                    db.add(conv)
                    db.flush()

                # Ingest messages — dedupe by wa_message_id
                msgs = chat.get("messages") or []
                latest_ts = 0
                for m in msgs:
                    wa_msg_id = m.get("wa_message_id")
                    if not wa_msg_id:
                        continue
                    exists = db.query(WhatsAppMessage).filter(WhatsAppMessage.wa_message_id == wa_msg_id).first()
                    if exists:
                        continue
                    ts = int(m.get("timestamp") or 0)
                    if ts > latest_ts:
                        latest_ts = ts
                    direction = "outbound" if m.get("from_me") else "inbound"
                    msg_type = m.get("message_type") or "text"
                    db.add(WhatsAppMessage(
                        conversation_id=conv.id,
                        wa_message_id=wa_msg_id,
                        direction=direction,
                        content=m.get("content") or "",
                        message_type=msg_type,
                        status="delivered" if direction == "inbound" else "sent",
                        sent_by="historic" if direction == "outbound" else None,
                        created_at=datetime.utcfromtimestamp(ts) if ts else datetime.utcnow(),
                    ))
                if latest_ts:
                    conv.last_message_at = datetime.utcfromtimestamp(latest_ts)
                ingested += 1
            except Exception as e:
                print(f"[wa-web history_sync] chat error: {e}")
                try:
                    db.rollback()
                except Exception:
                    pass

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[wa-web history_sync] commit failed: {e}")

        if ingested:
            log_event(
                "sistema",
                f"WA Web: importados {ingested} chats del historial",
                detail=f"isLatest={payload.get('isLatest')}",
                status="info",
            )
        return {"ok": True, "ingested": ingested}

    # ----------------------------------------------------------------
    # Inbound message — funnel into the same Conversation/Message tables
    # ----------------------------------------------------------------
    if event_type == "message":
        msg = payload.get("message") or {}
        from_phone = (msg.get("from") or "").strip()
        wa_msg_id = msg.get("wa_message_id") or f"web_{datetime.utcnow().timestamp()}"
        msg_type = msg.get("message_type") or "text"
        content = msg.get("content") or ""
        contact_name = msg.get("contact_name")

        # Skip bot-irrelevant types
        if msg_type in ("reaction", "sticker"):
            return {"ok": True, "skipped": msg_type}

        # Find or create conversation (scoped to tenant + transport='web' so Meta convs don't collide)
        clean_phone = re.sub(r"\D", "", from_phone)
        clean_last10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone

        conv = (
            db.query(WhatsAppConversation)
            .filter(WhatsAppConversation.tenant_id == tenant_id)
            .filter(WhatsAppConversation.transport == "web")
            .filter(WhatsAppConversation.wa_contact_phone.in_([from_phone, clean_phone, f"+{clean_phone}"]))
            .first()
        )

        if not conv:
            client_q = (
                db.query(Client)
                .filter(Client.tenant_id == tenant_id, Client.is_active == True)
                .all()
            )
            client = next(
                (
                    c for c in client_q
                    if (re.sub(r"\D", "", c.phone or "")[-10:] == clean_last10)
                ),
                None,
            )
            conv = WhatsAppConversation(
                tenant_id=tenant_id,
                wa_contact_phone=from_phone,
                wa_contact_name=contact_name,
                client_id=client.id if client else None,
                is_ai_active=True,
                unread_count=0,
                transport="web",
            )
            db.add(conv)
            db.flush()

        # Dedupe
        existing = db.query(WhatsAppMessage).filter(WhatsAppMessage.wa_message_id == wa_msg_id).first()
        if existing:
            return {"ok": True, "duplicate": True}

        message = WhatsAppMessage(
            conversation_id=conv.id,
            wa_message_id=wa_msg_id,
            direction="inbound",
            content=content,
            message_type=msg_type,
            status="delivered",
            media_url=None,
            media_mime_type=(msg.get("media") or {}).get("mime"),
        )
        db.add(message)

        # Sentiment (rule-based, zero AI tokens)
        try:
            if msg_type == "text" and content:
                from sentiment_analyzer import analyze_sentiment as _analyze_sent
                _sent = _analyze_sent(content)
                message.sentiment = _sent["sentiment"]
                message.sentiment_score = _sent["score"]
                conv.last_sentiment = _sent["sentiment"]
        except Exception:
            pass

        try:
            track_message_received(tenant_id=tenant_id)
        except Exception:
            pass

        conv.last_message_at = datetime.utcnow()
        conv.unread_count = (conv.unread_count or 0) + 1
        # Update contact name if missing or just a phone number — pushName from
        # the new message is usually a real display name.
        existing_name = (conv.wa_contact_name or "").strip()
        existing_is_numeric = existing_name.replace("+", "").replace(" ", "").isdigit()
        if contact_name and (not existing_name or existing_is_numeric):
            conv.wa_contact_name = contact_name

        # Inbox notification
        try:
            from notifications import notify
            push_name = conv.wa_contact_name or from_phone or "Cliente"
            notify(
                tenant_id, "whatsapp_message",
                f"{push_name} te escribio por WhatsApp",
                (content or "")[:120] or "Nuevo mensaje",
                icon="WA", link="/inbox",
            )
        except Exception as e:
            print(f"[wa-web webhook] notify error: {e}")

        db.commit()

        # Trigger Lina auto-reply (same pipeline as Meta webhook)
        if conv.is_ai_active and msg_type in ("text", "audio", "image", "video"):
            try:
                from services.whatsapp.ai_handler import ai_auto_reply
                background_tasks.add_task(
                    ai_auto_reply,
                    conv_id=conv.id,
                    inbound_text=content,
                    to_phone=from_phone,
                )
            except Exception as e:
                print(f"[wa-web webhook] AI dispatch error: {e}")
                log_event("error", "Fallo al disparar Lina (WA Web)", detail=str(e), conv_id=conv.id, status="error")

        return {"ok": True}

    return {"ok": True, "unknown_event": event_type}
