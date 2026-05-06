"""
WhatsApp Web (Baileys) anti-ban guard rails.

WhatsApp's spam detection looks for patterns that humans don't do:
  - Hundreds of messages in minutes
  - Identical text to many recipients
  - Sending at 3am
  - Sending to numbers that never replied
  - Sending too fast to the same recipient over and over
  - Sending right after a string of failures (already-flagged)

This module enforces a safety layer that runs BEFORE every Web-mode send.
Returns a SendResult with error_code='RULE_BLOCKED' if a rule trips, so the
campaign worker can pause gracefully instead of getting the number banned.

Rules implemented:
  1. Business hours window (Colombia time, default 8am–9pm)
  2. Per-recipient cooldown (default 15 min between msgs to same phone)
  3. Circuit breaker on N consecutive send failures (pauses 30 min)
  4. Message variation — appends invisible jitter so identical bodies don't
     hash-match across many sends
"""
from __future__ import annotations

import os
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from database.models import Tenant, WhatsAppConversation, WhatsAppMessage


# ---------------------------------------------------------------------------
# Defaults — overridable via env so we don't bloat the Tenant table for now.
# ---------------------------------------------------------------------------
BUSINESS_HOURS_START = int(os.getenv("WA_WEB_HOURS_START", "8"))   # 8am
BUSINESS_HOURS_END   = int(os.getenv("WA_WEB_HOURS_END",   "21"))  # 9pm
RECIPIENT_COOLDOWN_MIN = int(os.getenv("WA_WEB_RECIPIENT_COOLDOWN_MIN", "15"))
CIRCUIT_BREAKER_FAIL_THRESHOLD = int(os.getenv("WA_WEB_CB_FAILS", "5"))
CIRCUIT_BREAKER_WINDOW_SEC     = int(os.getenv("WA_WEB_CB_WINDOW_SEC", "300"))   # 5 min
CIRCUIT_BREAKER_PAUSE_SEC      = int(os.getenv("WA_WEB_CB_PAUSE_SEC", "1800"))   # 30 min


# ---------------------------------------------------------------------------
# In-memory failure tracker per tenant (resets on Railway redeploy — fine)
# ---------------------------------------------------------------------------
_FAIL_HISTORY: dict[int, list[float]] = {}      # tenant_id -> list of fail timestamps
_CIRCUIT_OPEN_UNTIL: dict[int, float] = {}      # tenant_id -> epoch when CB unlatches


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _now_colombia() -> datetime:
    """Colombia is UTC-5 year-round."""
    return datetime.utcnow() - timedelta(hours=5)


def _last10(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits


# ---------------------------------------------------------------------------
# Rule checks
# ---------------------------------------------------------------------------
def check_business_hours() -> Optional[str]:
    """Return error message if outside business hours, else None."""
    now = _now_colombia()
    if now.hour < BUSINESS_HOURS_START or now.hour >= BUSINESS_HOURS_END:
        return (
            f"Fuera de horario comercial ({BUSINESS_HOURS_START:02d}:00–{BUSINESS_HOURS_END:02d}:00 Colombia). "
            "Esto protege tu número — WhatsApp marca como spam los envíos masivos en madrugada."
        )
    return None


def check_recipient_cooldown(db: Session, tenant_id: int, phone: str) -> Optional[str]:
    """Return error message if we sent to this phone too recently, else None.

    Cooldown protects against repeated mass-sends to the same number. We SKIP it
    when this is an active conversation — defined as the recipient having sent
    us an inbound message within the last 30 min. That's a real two-way chat,
    not spam, and Lina/staff must be able to reply naturally.
    """
    if RECIPIENT_COOLDOWN_MIN <= 0:
        return None
    cutoff = datetime.utcnow() - timedelta(minutes=RECIPIENT_COOLDOWN_MIN)
    last10 = _last10(phone)
    if not last10:
        return None
    # Find conversations matching this phone across ALL transports
    convs = (
        db.query(WhatsAppConversation)
        .filter(WhatsAppConversation.tenant_id == tenant_id)
        .all()
    )
    matching = [c for c in convs if _last10(c.wa_contact_phone) == last10]
    if not matching:
        return None
    conv_ids = [c.id for c in matching]

    # CONVERSATIONAL OVERRIDE: if there's an inbound from this contact in the
    # last 30 min, this is a live two-way chat — bypass cooldown so Lina/staff
    # can reply. The ban risk is for *unsolicited* repeat sends, not replies.
    convo_window = datetime.utcnow() - timedelta(minutes=30)
    has_recent_inbound = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.conversation_id.in_(conv_ids))
        .filter(WhatsAppMessage.direction == "inbound")
        .filter(WhatsAppMessage.created_at >= convo_window)
        .first()
    )
    if has_recent_inbound:
        return None

    recent = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.conversation_id.in_(conv_ids))
        .filter(WhatsAppMessage.direction == "outbound")
        .filter(WhatsAppMessage.created_at >= cutoff)
        .first()
    )
    if recent:
        return f"Cooldown de {RECIPIENT_COOLDOWN_MIN} min activo para este contacto (proteccion anti-spam)."
    return None


def check_circuit_breaker(tenant_id: int) -> Optional[str]:
    """If too many consecutive failures recently, pause sends for 30min."""
    now = time.time()
    until = _CIRCUIT_OPEN_UNTIL.get(tenant_id, 0)
    if until > now:
        remaining_min = int((until - now) / 60) + 1
        return f"Circuit breaker activo — pausado {remaining_min} min por exceso de errores. Verifica la conexion."
    return None


def record_send_outcome(tenant_id: int, success: bool):
    """Update the in-memory failure tracker. If we hit threshold, open the circuit."""
    now = time.time()
    if success:
        # A successful send proves the connection is healthy — clear failure
        # history AND reset any open circuit. Otherwise a 30-min lockout from
        # earlier flakiness keeps blocking even after recovery.
        _FAIL_HISTORY.pop(tenant_id, None)
        if tenant_id in _CIRCUIT_OPEN_UNTIL:
            _CIRCUIT_OPEN_UNTIL.pop(tenant_id, None)
            print(f"[anti-ban] CIRCUIT RESET for tenant {tenant_id} after successful send")
        return
    history = _FAIL_HISTORY.setdefault(tenant_id, [])
    history.append(now)
    # Drop entries outside the window
    cutoff = now - CIRCUIT_BREAKER_WINDOW_SEC
    history[:] = [t for t in history if t >= cutoff]
    if len(history) >= CIRCUIT_BREAKER_FAIL_THRESHOLD:
        _CIRCUIT_OPEN_UNTIL[tenant_id] = now + CIRCUIT_BREAKER_PAUSE_SEC
        _FAIL_HISTORY.pop(tenant_id, None)
        print(f"[anti-ban] CIRCUIT OPEN for tenant {tenant_id} — pausing {CIRCUIT_BREAKER_PAUSE_SEC // 60} min")


def reset_circuit(tenant_id: int):
    """Manually clear the circuit breaker — useful when admin reconnects WA Web."""
    _FAIL_HISTORY.pop(tenant_id, None)
    _CIRCUIT_OPEN_UNTIL.pop(tenant_id, None)


# ---------------------------------------------------------------------------
# Message variation — invisible jitter so two clients don't get byte-identical text
# ---------------------------------------------------------------------------
_INVISIBLE_VARIANTS = ["", " ", " "]  # space, non-breaking space


def vary_message(text: str) -> str:
    """Append a tiny invisible variation so spam filters don't hash-match.

    Picks a random invisible character to append. The recipient sees the same
    message; the underlying bytes differ slightly per send.
    """
    if not text:
        return text
    variant = random.choice(_INVISIBLE_VARIANTS)
    return text + variant


# ---------------------------------------------------------------------------
# Main entrypoint — call this BEFORE every Web-mode send.
# ---------------------------------------------------------------------------
def evaluate_send(db: Session, tenant_id: int, phone: str, is_campaign: bool = True) -> Optional[str]:
    """Run all anti-ban checks. Returns error message string if blocked, else None.

    is_campaign=True (default): mass-send protections active (hours, cooldown).
    is_campaign=False: conversational reply (Lina/staff replying to inbound) —
        only the circuit breaker applies. Replies must work 24/7 because
        clients write whenever, and refusing to answer is worse than the
        spam-rule. The conversational nature itself is the strongest signal
        WhatsApp uses to distinguish real users from bots.
    """
    # 1. Circuit breaker — always applies (protects against runaway failures)
    msg = check_circuit_breaker(tenant_id)
    if msg:
        return msg
    if not is_campaign:
        return None
    # 2. Business hours — campaigns only
    msg = check_business_hours()
    if msg:
        return msg
    # 3. Per-recipient cooldown — campaigns only
    msg = check_recipient_cooldown(db, tenant_id, phone)
    if msg:
        return msg
    return None
