from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Notification
from routes._helpers import safe_tid
from middleware.auth_middleware import get_current_user
from database.models import Admin

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(limit: int = 50, unread_only: bool = False,
                       db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Notification)
    if tid:
        q = q.filter(Notification.tenant_id == tid)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    notifs = q.order_by(Notification.created_at.desc()).limit(limit).all()
    unread_count = db.query(Notification).filter(
        Notification.is_read == False,
        *([Notification.tenant_id == tid] if tid else []),
    ).count()
    return {
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "detail": n.detail or "",
                "icon": n.icon or "",
                "is_read": n.is_read,
                "link": n.link,
                "created_at": n.created_at.isoformat() if n.created_at else "",
            }
            for n in notifs
        ],
        "unread_count": unread_count,
    }


@router.post("/mark-read")
def mark_all_read(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Notification).filter(Notification.is_read == False)
    if tid:
        q = q.filter(Notification.tenant_id == tid)
    q.update({"is_read": True})
    db.commit()
    return {"success": True}


@router.post("/{notification_id}/read")
def mark_one_read(notification_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"success": True}


@router.delete("/clear")
def clear_all(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Notification)
    if tid:
        q = q.filter(Notification.tenant_id == tid)
    q.delete()
    db.commit()
    return {"success": True}
