"""
Business Notifications — Persistent alerts for admins.

Usage:
    from notifications import notify
    notify(db, tenant_id, "new_client", "Nuevo cliente: Carlos Martinez", "Tel: 3001234567", icon="👤", link="/clientes")
"""
import threading
from database.connection import SessionLocal


def notify(db_or_tenant_id, tenant_id_or_type=None, type_str=None, title=None, detail="", icon=None, link=None):
    """Create a notification. Accepts two call patterns:

    Pattern 1 (with db session):
        notify(db, tenant_id, "new_client", "Title", "Detail", icon="👤", link="/clientes")

    Pattern 2 (fire-and-forget, creates own session):
        notify(tenant_id=1, type="new_client", title="Title", detail="Detail")
    """
    # Normalize arguments
    if isinstance(db_or_tenant_id, int):
        # Pattern 2: first arg is tenant_id
        _tenant_id = db_or_tenant_id
        _type = tenant_id_or_type
        _title = type_str
        _detail = title or ""
        _icon = detail if isinstance(detail, str) and len(detail) <= 4 else icon
        _link = icon if isinstance(icon, str) and icon.startswith("/") else link
        if isinstance(detail, str) and len(detail) > 4:
            _detail = detail
        _fire_and_forget(_tenant_id, _type, _title, _detail, _icon, _link)
        return
    else:
        # Pattern 1: first arg is db session
        _db = db_or_tenant_id
        _tenant_id = tenant_id_or_type
        _type = type_str
        _title = title
        _detail = detail
        _icon = icon
        _link = link
        _create_notification(_db, _tenant_id, _type, _title, _detail, _icon, _link)


def _create_notification(db, tenant_id, ntype, title, detail="", icon=None, link=None):
    """Create notification in given DB session."""
    try:
        from database.models import Notification
        n = Notification(
            tenant_id=tenant_id,
            type=ntype,
            title=title[:300] if title else "Notificacion",
            detail=(detail or "")[:2000],
            icon=icon,
            link=link,
        )
        db.add(n)
        db.commit()
    except Exception as e:
        try:
            db.rollback()
        except Exception:
            pass
        print(f"[NOTIFY] Error creating notification: {e}")


def _fire_and_forget(tenant_id, ntype, title, detail="", icon=None, link=None):
    """Create notification in background thread (non-blocking)."""
    def _do():
        db = SessionLocal()
        try:
            _create_notification(db, tenant_id, ntype, title, detail, icon, link)
        finally:
            db.close()

    threading.Thread(target=_do, daemon=True).start()
