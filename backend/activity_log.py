# ============================================================================
# Plexify Studio - Lina IA Activity Logger
# PERSISTENT: Saves to DB (survives restarts) + in-memory cache for speed.
# ============================================================================

from collections import deque
from datetime import datetime, timedelta
import threading

from routes._helpers import now_colombia as _now_col

_log = deque(maxlen=500)  # In-memory cache for real-time speed
_lock = threading.Lock()

# Counters for today's stats (reset daily)
_stats = {
    "messages_sent": 0,
    "messages_failed": 0,
    "actions_executed": 0,
    "conversations_replied": 0,
    "tasks_completed": 0,
    "skips": 0,
    "last_reset_date": None,
}


def _reset_if_new_day():
    today = _now_col().date()
    if _stats["last_reset_date"] != today:
        _stats["messages_sent"] = 0
        _stats["messages_failed"] = 0
        _stats["actions_executed"] = 0
        _stats["conversations_replied"] = 0
        _stats["tasks_completed"] = 0
        _stats["skips"] = 0
        _stats["last_reset_date"] = today


def _save_to_db(event_type, description, detail, contact_name, conv_id, status, tenant_id):
    """Save event to database (fire-and-forget, never blocks main flow)."""
    try:
        from database.connection import SessionLocal
        from database.models import LinaActivityEvent
        db = SessionLocal()
        try:
            evt = LinaActivityEvent(
                tenant_id=tenant_id,
                event_type=event_type,
                description=description[:500],
                detail=(detail or "")[:2000],
                contact_name=(contact_name or "")[:200],
                conv_id=conv_id,
                status=status,
            )
            db.add(evt)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    except Exception:
        pass  # DB not ready yet — silently skip


def log_event(event_type: str, description: str, detail: str = "",
              contact_name: str = "", conv_id: int = None, status: str = "info",
              tenant_id: int = None):
    """
    Log a Lina IA activity event — saved to DB + in-memory cache.

    event_type: "respuesta", "accion", "tarea", "error", "sistema", "skip"
    description: Admin-friendly short description
    detail: Optional longer detail
    contact_name: Client/contact name if applicable
    conv_id: Conversation ID if applicable
    status: "ok", "info", "warning", "error"
    tenant_id: Tenant ID for multi-tenant isolation
    """
    now = _now_col()

    with _lock:
        _reset_if_new_day()

        entry = {
            "id": len(_log) + 1,
            "timestamp": now.isoformat(),
            "time_display": now.strftime("%I:%M %p").lstrip("0"),
            "event_type": event_type,
            "description": description,
            "detail": detail,
            "contact_name": contact_name,
            "conv_id": conv_id,
            "status": status,
        }
        _log.appendleft(entry)

        # Update counters
        if event_type == "respuesta":
            if status == "ok":
                _stats["messages_sent"] += 1
                _stats["conversations_replied"] += 1
            elif status == "error":
                _stats["messages_failed"] += 1
        elif event_type == "accion":
            _stats["actions_executed"] += 1
        elif event_type == "tarea":
            _stats["tasks_completed"] += 1
        elif event_type == "skip":
            _stats["skips"] += 1

    # Save to DB in background (non-blocking)
    import threading
    threading.Thread(
        target=_save_to_db,
        args=(event_type, description, detail, contact_name, conv_id, status, tenant_id),
        daemon=True,
    ).start()


def get_recent_events(limit: int = 100, offset: int = 0):
    """Return recent events — from DB for persistence, fallback to in-memory."""
    # Try DB first (persistent, survives restarts)
    try:
        from database.connection import SessionLocal
        from database.models import LinaActivityEvent
        db = SessionLocal()
        try:
            events = (
                db.query(LinaActivityEvent)
                .order_by(LinaActivityEvent.created_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            if events:
                now_col = _now_col()
                return [
                    {
                        "id": e.id,
                        "timestamp": e.created_at.isoformat() if e.created_at else "",
                        "time_display": (e.created_at - timedelta(hours=5)).strftime("%I:%M %p").lstrip("0") if e.created_at else "",
                        "event_type": e.event_type,
                        "description": e.description,
                        "detail": e.detail or "",
                        "contact_name": e.contact_name or "",
                        "conv_id": e.conv_id,
                        "status": e.status or "info",
                    }
                    for e in events
                ]
        finally:
            db.close()
    except Exception:
        pass

    # Fallback to in-memory
    with _lock:
        _reset_if_new_day()
        events = list(_log)
        return events[offset:offset + limit]


def get_stats():
    """Return today's stats — from DB for accuracy, fallback to in-memory."""
    # Try DB stats
    try:
        from database.connection import SessionLocal
        from database.models import LinaActivityEvent
        from sqlalchemy import func
        db = SessionLocal()
        try:
            today_utc = datetime.utcnow().date()
            today_start = datetime.combine(today_utc, datetime.min.time())

            def _count(event_type=None, status=None):
                q = db.query(func.count(LinaActivityEvent.id)).filter(
                    LinaActivityEvent.created_at >= today_start,
                )
                if event_type:
                    q = q.filter(LinaActivityEvent.event_type == event_type)
                if status:
                    q = q.filter(LinaActivityEvent.status == status)
                return q.scalar() or 0

            return {
                "messages_sent": _count("respuesta", "ok"),
                "messages_failed": _count("respuesta", "error"),
                "actions_executed": _count("accion"),
                "conversations_replied": _count("respuesta", "ok"),
                "tasks_completed": _count("tarea"),
                "skips": _count("skip"),
            }
        finally:
            db.close()
    except Exception:
        pass

    # Fallback to in-memory
    with _lock:
        _reset_if_new_day()
        return dict(_stats)
