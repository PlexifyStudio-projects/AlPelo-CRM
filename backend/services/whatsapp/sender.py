"""
WhatsApp Sender — unified abstraction over Meta Cloud API and Baileys (web) transport.

Every send path in the codebase MUST go through this module. The tenant's
`wa_mode` column ('meta' | 'web') decides which backend handles the send.

Usage:
    from services.whatsapp.sender import get_sender

    sender = get_sender(db, tenant_id)
    result = await sender.send_text(phone, text)
    if result.ok:
        wa_msg_id = result.wa_message_id

Result is uniform across both transports so callers don't need to branch.
"""
import os
import json
import random
import asyncio
import httpx
from dataclasses import dataclass
from datetime import datetime, date
from typing import Optional

from database.models import Tenant
from routes._helpers import normalize_phone


# ============================================================================
# Result type — uniform across Meta and Web
# ============================================================================
@dataclass
class SendResult:
    ok: bool
    wa_message_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    transport: str = "meta"  # 'meta' | 'web'
    queued: bool = False  # True if Web mode queued instead of sending immediately


# ============================================================================
# Config
# ============================================================================
WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")
# Read these dynamically (functions, not module-level snapshots) because the
# embedded Node launcher generates WA_WEB_SERVICE_TOKEN at lifespan startup
# AFTER this module is imported.
def _wa_web_service_url() -> str:
    return os.getenv("WA_WEB_SERVICE_URL", "http://127.0.0.1:3100")


def _wa_web_service_token() -> str:
    return os.getenv("WA_WEB_SERVICE_TOKEN", "")


def _resolve_tenant(db, tenant_id: Optional[int]) -> Optional[Tenant]:
    if tenant_id is not None:
        return db.query(Tenant).filter(Tenant.id == tenant_id).first()
    # Fallback: first active tenant with WA configured
    return db.query(Tenant).filter(
        Tenant.is_active == True,
    ).first()


# ============================================================================
# Base sender interface
# ============================================================================
class WhatsAppSender:
    """Abstract sender. Both MetaSender and WebSender implement this."""

    transport: str = "base"

    def __init__(self, tenant: Tenant, db):
        self.tenant = tenant
        self.db = db

    async def send_text(self, phone: str, text: str) -> SendResult:
        raise NotImplementedError

    async def send_template(
        self,
        phone: str,
        template_name: str,
        language_code: str = "es",
        parameters: Optional[list] = None,
        header: Optional[dict] = None,
    ) -> SendResult:
        raise NotImplementedError

    async def send_image(self, phone: str, media_bytes: bytes, mime: str = "image/jpeg", caption: str = "") -> SendResult:
        raise NotImplementedError

    async def send_document(self, phone: str, media_bytes: bytes, filename: str, caption: str = "", mime: str = "application/pdf") -> SendResult:
        raise NotImplementedError

    async def get_status(self) -> dict:
        """Return transport health/status info."""
        raise NotImplementedError


# ============================================================================
# Meta Cloud API Sender — wraps the existing send code path
# ============================================================================
class MetaSender(WhatsAppSender):
    transport = "meta"

    @property
    def _phone_id(self) -> str:
        return (self.tenant.wa_phone_number_id or "").strip() if self.tenant else ""

    @property
    def _token(self) -> str:
        return (self.tenant.wa_access_token or "").strip() if self.tenant else ""

    @property
    def _base_url(self) -> str:
        return f"https://graph.facebook.com/{WA_API_VERSION}/{self._phone_id}"

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    def _missing_creds(self) -> Optional[SendResult]:
        if not self._token or not self._phone_id:
            return SendResult(ok=False, error="Meta credentials not configured", transport="meta")
        return None

    def _bump_messages_used(self):
        """Atomic increment so concurrent sends don't lose counter increments."""
        from sqlalchemy import update
        try:
            self.db.execute(
                update(Tenant)
                .where(Tenant.id == self.tenant.id)
                .values(messages_used=Tenant.messages_used + 1)
            )
            self.db.commit()
        except Exception:
            try:
                self.db.rollback()
            except Exception:
                pass

    async def send_text(self, phone: str, text: str) -> SendResult:
        miss = self._missing_creds()
        if miss:
            return miss
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                resp = await c.post(
                    f"{self._base_url}/messages",
                    headers=self._headers,
                    json={
                        "messaging_product": "whatsapp",
                        "to": normalize_phone(phone),
                        "type": "text",
                        "text": {"body": text},
                    },
                )
                data = resp.json() if resp.content else {}
                if resp.status_code == 200 and "messages" in data:
                    self._bump_messages_used()
                    return SendResult(
                        ok=True,
                        wa_message_id=data["messages"][0].get("id"),
                        transport="meta",
                    )
                err = data.get("error", {}) if isinstance(data, dict) else {}
                return SendResult(
                    ok=False,
                    error=err.get("message", str(data)[:200]),
                    error_code=str(err.get("code", resp.status_code)),
                    transport="meta",
                )
        except Exception as e:
            return SendResult(ok=False, error=f"{type(e).__name__}: {e}", transport="meta")

    async def send_template(self, phone, template_name, language_code="es", parameters=None, header=None) -> SendResult:
        miss = self._missing_creds()
        if miss:
            return miss

        template_obj = {"name": template_name, "language": {"code": language_code}}
        components = []
        if header:
            components.append(header)
        if parameters:
            clean = [p for p in parameters if p and str(p).strip()]
            if clean:
                components.append({
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(p)} for p in clean],
                })
        if components:
            template_obj["components"] = components

        try:
            async with httpx.AsyncClient(timeout=15) as c:
                resp = await c.post(
                    f"{self._base_url}/messages",
                    headers=self._headers,
                    json={
                        "messaging_product": "whatsapp",
                        "to": normalize_phone(phone),
                        "type": "template",
                        "template": template_obj,
                    },
                )
                data = resp.json() if resp.content else {}
                if resp.status_code == 200 and "messages" in data:
                    self._bump_messages_used()
                    return SendResult(
                        ok=True,
                        wa_message_id=data["messages"][0].get("id"),
                        transport="meta",
                    )
                err = data.get("error", {}) if isinstance(data, dict) else {}
                return SendResult(
                    ok=False,
                    error=err.get("message", str(data)[:200]),
                    error_code=str(err.get("code", resp.status_code)),
                    transport="meta",
                )
        except Exception as e:
            return SendResult(ok=False, error=f"{type(e).__name__}: {e}", transport="meta")

    async def _upload_media(self, media_bytes: bytes, filename: str, mime: str) -> tuple[Optional[str], Optional[str]]:
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                resp = await c.post(
                    f"{self._base_url}/media",
                    headers={"Authorization": f"Bearer {self._token}"},
                    files={"file": (filename, media_bytes, mime)},
                    data={"messaging_product": "whatsapp", "type": mime},
                )
                data = resp.json() if resp.content else {}
                if "id" in data:
                    return data["id"], None
                err = data.get("error", {})
                return None, err.get("message", str(data)[:200])
        except Exception as e:
            return None, f"{type(e).__name__}: {e}"

    async def send_image(self, phone, media_bytes, mime="image/jpeg", caption="") -> SendResult:
        miss = self._missing_creds()
        if miss:
            return miss
        media_id, err = await self._upload_media(media_bytes, "image.jpg", mime)
        if not media_id:
            return SendResult(ok=False, error=err or "Upload failed", transport="meta")
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                resp = await c.post(
                    f"{self._base_url}/messages",
                    headers=self._headers,
                    json={
                        "messaging_product": "whatsapp",
                        "to": normalize_phone(phone),
                        "type": "image",
                        "image": {"id": media_id, "caption": caption},
                    },
                )
                data = resp.json() if resp.content else {}
                if resp.status_code == 200 and "messages" in data:
                    self._bump_messages_used()
                    return SendResult(ok=True, wa_message_id=data["messages"][0].get("id"), transport="meta")
                err2 = data.get("error", {})
                return SendResult(ok=False, error=err2.get("message", str(data)[:200]), transport="meta")
        except Exception as e:
            return SendResult(ok=False, error=f"{type(e).__name__}: {e}", transport="meta")

    async def send_document(self, phone, media_bytes, filename, caption="", mime="application/pdf") -> SendResult:
        miss = self._missing_creds()
        if miss:
            return miss
        media_id, err = await self._upload_media(media_bytes, filename, mime)
        if not media_id:
            return SendResult(ok=False, error=err or "Upload failed", transport="meta")
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                resp = await c.post(
                    f"{self._base_url}/messages",
                    headers=self._headers,
                    json={
                        "messaging_product": "whatsapp",
                        "to": normalize_phone(phone),
                        "type": "document",
                        "document": {"id": media_id, "filename": filename, "caption": caption},
                    },
                )
                data = resp.json() if resp.content else {}
                if resp.status_code == 200 and "messages" in data:
                    self._bump_messages_used()
                    return SendResult(ok=True, wa_message_id=data["messages"][0].get("id"), transport="meta")
                err2 = data.get("error", {})
                return SendResult(ok=False, error=err2.get("message", str(data)[:200]), transport="meta")
        except Exception as e:
            return SendResult(ok=False, error=f"{type(e).__name__}: {e}", transport="meta")

    async def get_status(self) -> dict:
        return {
            "transport": "meta",
            "configured": bool(self._token and self._phone_id),
            "phone_number_id": self._phone_id,
            "phone_display": self.tenant.wa_phone_display if self.tenant else None,
        }


# ============================================================================
# Web (Baileys) Sender — calls the Node microservice
# ============================================================================
class WebSender(WhatsAppSender):
    transport = "web"

    def _session_id(self) -> str:
        return self.tenant.wa_web_session_id or f"tenant_{self.tenant.id}"

    def _base(self) -> str:
        return _wa_web_service_url().rstrip("/")

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {_wa_web_service_token()}",
            "Content-Type": "application/json",
        }

    def _warmup_cap(self) -> int:
        """Progressive cap based on days connected — protects new numbers from getting banned.

        Day 1: 20, day 4: 50, day 7: 100, day 14+: admin's configured daily_limit.
        """
        started = self.tenant.wa_web_warmup_started_at
        admin_cap = max(5, int(self.tenant.wa_web_daily_limit or 20))
        if not started:
            return min(20, admin_cap)
        days = max(0, (datetime.utcnow() - started).days)
        if days < 3:
            curve = 20
        elif days < 7:
            curve = 50
        elif days < 14:
            curve = 100
        else:
            curve = admin_cap  # fully warmed
        return min(curve, admin_cap)

    def _check_quota(self) -> Optional[SendResult]:
        """Verify daily limit (warm-up curve + admin cap). Returns error result if blocked."""
        today = date.today()
        # Reset counter if we're on a new day
        if self.tenant.wa_web_sent_today_date != today:
            self.tenant.wa_web_sent_today = 0
            self.tenant.wa_web_sent_today_date = today
            try:
                self.db.commit()
            except Exception:
                self.db.rollback()

        cap = self._warmup_cap()
        if (self.tenant.wa_web_sent_today or 0) >= cap:
            return SendResult(
                ok=False,
                error=f"Limite diario alcanzado ({cap} msgs). Reanudara manana.",
                error_code="DAILY_LIMIT",
                transport="web",
            )
        return None

    def _bump_sent(self):
        """Atomically increment sent_today and messages_used.

        Uses SQL UPDATE so concurrent sends from Lina + scheduler + campaign worker
        don't clobber each other (read-modify-write on the ORM-attached tenant
        loses increments under load).
        """
        from sqlalchemy import update
        try:
            self.db.execute(
                update(Tenant)
                .where(Tenant.id == self.tenant.id)
                .values(
                    wa_web_sent_today=Tenant.wa_web_sent_today + 1,
                    messages_used=Tenant.messages_used + 1,
                )
            )
            self.db.commit()
            self.db.refresh(self.tenant)
        except Exception:
            try:
                self.db.rollback()
            except Exception:
                pass

    async def _post(self, path: str, payload: dict) -> tuple[Optional[dict], Optional[str]]:
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                resp = await c.post(
                    f"{self._base()}{path}",
                    headers=self._headers(),
                    json=payload,
                )
                data = resp.json() if resp.content else {}
                if 200 <= resp.status_code < 300:
                    return data, None
                return None, data.get("error", f"HTTP {resp.status_code}")
        except httpx.ConnectError:
            return None, "WhatsApp Web service unreachable"
        except Exception as e:
            return None, f"{type(e).__name__}: {e}"

    async def send_text(self, phone: str, text: str) -> SendResult:
        if self.tenant.wa_web_status != "connected":
            return SendResult(ok=False, error=f"Web session not connected (status: {self.tenant.wa_web_status})",
                              error_code="NOT_CONNECTED", transport="web")
        quota = self._check_quota()
        if quota:
            return quota
        data, err = await self._post(f"/sessions/{self._session_id()}/send", {
            "to": normalize_phone(phone),
            "type": "text",
            "text": text,
        })
        if err:
            return SendResult(ok=False, error=err, transport="web")
        self._bump_sent()
        return SendResult(ok=True, wa_message_id=data.get("messageId"), transport="web")

    async def send_template(self, phone, template_name, language_code="es", parameters=None, header=None) -> SendResult:
        # Web mode has no concept of templates — render the body inline
        body = self._render_template_inline(template_name, parameters)
        return await self.send_text(phone, body)

    def _render_template_inline(self, template_name: str, parameters: Optional[list]) -> str:
        """Render a template body inline by looking up MessageTemplate and substituting params."""
        try:
            from database.models import MessageTemplate
            tpl = self.db.query(MessageTemplate).filter(
                MessageTemplate.tenant_id == self.tenant.id,
                MessageTemplate.slug == template_name,
            ).first()
            body = (tpl.body if tpl and tpl.body else f"[{template_name}]")
            if parameters:
                for i, val in enumerate(parameters, start=1):
                    body = body.replace("{{" + str(i) + "}}", str(val))
                    body = body.replace("{{ " + str(i) + " }}", str(val))
            return body
        except Exception:
            return f"[{template_name}]"

    async def send_image(self, phone, media_bytes, mime="image/jpeg", caption="") -> SendResult:
        if self.tenant.wa_web_status != "connected":
            return SendResult(ok=False, error="Web session not connected", error_code="NOT_CONNECTED", transport="web")
        quota = self._check_quota()
        if quota:
            return quota
        import base64 as _b64
        data, err = await self._post(f"/sessions/{self._session_id()}/send", {
            "to": normalize_phone(phone),
            "type": "image",
            "media_base64": _b64.b64encode(media_bytes).decode("ascii"),
            "mime": mime,
            "caption": caption,
        })
        if err:
            return SendResult(ok=False, error=err, transport="web")
        self._bump_sent()
        return SendResult(ok=True, wa_message_id=data.get("messageId"), transport="web")

    async def send_document(self, phone, media_bytes, filename, caption="", mime="application/pdf") -> SendResult:
        if self.tenant.wa_web_status != "connected":
            return SendResult(ok=False, error="Web session not connected", error_code="NOT_CONNECTED", transport="web")
        quota = self._check_quota()
        if quota:
            return quota
        import base64 as _b64
        data, err = await self._post(f"/sessions/{self._session_id()}/send", {
            "to": normalize_phone(phone),
            "type": "document",
            "media_base64": _b64.b64encode(media_bytes).decode("ascii"),
            "mime": mime,
            "filename": filename,
            "caption": caption,
        })
        if err:
            return SendResult(ok=False, error=err, transport="web")
        self._bump_sent()
        return SendResult(ok=True, wa_message_id=data.get("messageId"), transport="web")

    async def get_status(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                resp = await c.get(
                    f"{self._base()}/sessions/{self._session_id()}/status",
                    headers=self._headers(),
                )
                data = resp.json() if resp.content else {}
        except Exception as e:
            data = {"error": f"{type(e).__name__}: {e}"}
        return {
            "transport": "web",
            "session_id": self._session_id(),
            "status": self.tenant.wa_web_status,
            "phone": self.tenant.wa_web_phone,
            "daily_limit": self.tenant.wa_web_daily_limit,
            "sent_today": self.tenant.wa_web_sent_today,
            "service": data,
        }


# ============================================================================
# Sync wrappers — for code paths that aren't async (scheduler workers, etc.)
# ============================================================================
class SyncSenderWrapper:
    """Run async sender methods from sync code by spinning a fresh event loop."""
    def __init__(self, async_sender: WhatsAppSender):
        self._s = async_sender
        self.transport = async_sender.transport
        self.tenant = async_sender.tenant
        self.db = async_sender.db

    def _run(self, coro):
        try:
            loop = asyncio.new_event_loop()
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()
        except Exception as e:
            return SendResult(ok=False, error=f"{type(e).__name__}: {e}", transport=self.transport)

    def send_text(self, phone, text):
        return self._run(self._s.send_text(phone, text))

    def send_template(self, phone, template_name, language_code="es", parameters=None, header=None):
        return self._run(self._s.send_template(phone, template_name, language_code, parameters, header))

    def send_image(self, phone, media_bytes, mime="image/jpeg", caption=""):
        return self._run(self._s.send_image(phone, media_bytes, mime, caption))

    def send_document(self, phone, media_bytes, filename, caption="", mime="application/pdf"):
        return self._run(self._s.send_document(phone, media_bytes, filename, caption, mime))


# ============================================================================
# Factory — single entrypoint for all senders
# ============================================================================
def get_sender(db, tenant_id: Optional[int] = None, *, sync: bool = False) -> WhatsAppSender:
    """Return the right sender for this tenant based on wa_mode.

    Args:
        db: SQLAlchemy session
        tenant_id: tenant id; if None, falls back to first active tenant
        sync: if True, returns a SyncSenderWrapper for use from sync code

    Returns:
        WhatsAppSender (async) or SyncSenderWrapper (sync wrapper)
    """
    tenant = _resolve_tenant(db, tenant_id)
    if not tenant:
        raise ValueError("No tenant found for sender")

    mode = (tenant.wa_mode or "meta").strip().lower()
    if mode == "web":
        sender: WhatsAppSender = WebSender(tenant, db)
    else:
        sender = MetaSender(tenant, db)

    if sync:
        return SyncSenderWrapper(sender)
    return sender


def get_sender_for_phone_inbound(db, phone_number_id: str) -> Optional[Tenant]:
    """Resolve which tenant owns an inbound message based on Meta's phone_number_id (Meta mode only)."""
    return db.query(Tenant).filter(Tenant.wa_phone_number_id == phone_number_id).first()
