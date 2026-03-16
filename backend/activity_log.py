# ============================================================================
# AlPelo - Lina IA Activity Logger
# In-memory activity log for real-time monitoring of what Lina is doing.
# Stores last 500 events with admin-friendly descriptions (no dev jargon).
# ============================================================================

from collections import deque
from datetime import datetime, timedelta
import threading

from routes._helpers import now_colombia as _now_col

_log = deque(maxlen=500)
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


def log_event(event_type: str, description: str, detail: str = "",
              contact_name: str = "", conv_id: int = None, status: str = "info"):
    """
    Log a Lina IA activity event.

    event_type: Category — "respuesta", "accion", "tarea", "error", "sistema", "skip"
    description: Admin-friendly short description
    detail: Optional longer detail
    contact_name: Client/contact name if applicable
    conv_id: Conversation ID if applicable
    status: "ok", "info", "warning", "error"
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


def get_recent_events(limit: int = 100, offset: int = 0):
    """Return recent events (newest first)."""
    with _lock:
        _reset_if_new_day()
        events = list(_log)
        return events[offset:offset + limit]


def get_stats():
    """Return today's stats."""
    with _lock:
        _reset_if_new_day()
        return dict(_stats)
