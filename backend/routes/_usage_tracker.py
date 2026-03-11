"""
Usage tracking for Plexify Studio multi-tenant metering.
Increments Tenant.messages_used and UsageMetrics counters.
"""
from datetime import datetime
from sqlalchemy import text
from database.connection import SessionLocal


def _current_period() -> str:
    """Returns current period string like '2026-03'."""
    now = datetime.utcnow()
    return f"{now.year}-{now.month:02d}"


def _ensure_metrics(conn, tenant_id: int, period: str):
    """Create usage_metrics row if it doesn't exist for this tenant+period."""
    existing = conn.execute(text(
        "SELECT id FROM public.usage_metrics WHERE tenant_id = :tid AND period = :p"
    ), {"tid": tenant_id, "p": period}).fetchone()
    if not existing:
        conn.execute(text(
            "INSERT INTO public.usage_metrics (tenant_id, period, wa_messages_sent, wa_messages_received, ai_tokens_used, campaigns_sent) "
            "VALUES (:tid, :p, 0, 0, 0, 0)"
        ), {"tid": tenant_id, "p": period})


def track_message_sent(tenant_id: int = 1):
    """Track an outbound WhatsApp message (sent by admin or Lina)."""
    period = _current_period()
    try:
        db = SessionLocal()
        with db.begin():
            _ensure_metrics(db, tenant_id, period)
            db.execute(text(
                "UPDATE public.usage_metrics SET wa_messages_sent = wa_messages_sent + 1 "
                "WHERE tenant_id = :tid AND period = :p"
            ), {"tid": tenant_id, "p": period})
    except Exception as e:
        print(f"[USAGE] track_message_sent error: {e}")
    finally:
        db.close()


def track_message_received(tenant_id: int = 1):
    """Track an inbound WhatsApp message from a client."""
    period = _current_period()
    try:
        db = SessionLocal()
        with db.begin():
            _ensure_metrics(db, tenant_id, period)
            db.execute(text(
                "UPDATE public.usage_metrics SET wa_messages_received = wa_messages_received + 1 "
                "WHERE tenant_id = :tid AND period = :p"
            ), {"tid": tenant_id, "p": period})
    except Exception as e:
        print(f"[USAGE] track_message_received error: {e}")
    finally:
        db.close()


def track_ai_usage(tokens: int, tenant_id: int = 1):
    """Track AI token usage + increment Tenant.messages_used (the metered counter)."""
    if not tokens or tokens <= 0:
        return
    period = _current_period()
    try:
        db = SessionLocal()
        with db.begin():
            # Update usage_metrics
            _ensure_metrics(db, tenant_id, period)
            db.execute(text(
                "UPDATE public.usage_metrics SET ai_tokens_used = ai_tokens_used + :tokens "
                "WHERE tenant_id = :tid AND period = :p"
            ), {"tokens": tokens, "tid": tenant_id, "p": period})
            # Increment tenant messages_used (this is the metered counter shown to agencies)
            db.execute(text(
                "UPDATE public.tenant SET messages_used = messages_used + 1 "
                "WHERE id = :tid"
            ), {"tid": tenant_id})
    except Exception as e:
        print(f"[USAGE] track_ai_usage error: {e}")
    finally:
        db.close()


def track_campaign_sent(count: int = 1, tenant_id: int = 1):
    """Track campaign messages sent."""
    period = _current_period()
    try:
        db = SessionLocal()
        with db.begin():
            _ensure_metrics(db, tenant_id, period)
            db.execute(text(
                "UPDATE public.usage_metrics SET campaigns_sent = campaigns_sent + :n "
                "WHERE tenant_id = :tid AND period = :p"
            ), {"n": count, "tid": tenant_id, "p": period})
    except Exception as e:
        print(f"[USAGE] track_campaign_sent error: {e}")
    finally:
        db.close()
