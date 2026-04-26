from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import update

from database.connection import get_db
from database.models import (
    Staff, Client, VisitHistory, ClientNote, Service, Appointment,
    WhatsAppConversation, WhatsAppMessage, Admin, WorkflowExecution,
    AutomationExecution, Checkout, Invoice,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter()


# ============================================================================
# SHARED CASCADE HELPER — used by both single and bulk client delete
# ============================================================================
def _cascade_delete_clients(db: Session, client_ids: list[int]) -> None:
    """Cleanly delete a set of clients and all their dependent rows.

    Order matters: we first nullify or delete child rows that have FKs
    pointing at appointment/client, then the appointments themselves,
    then the clients. Financial records (invoices, checkouts) are kept
    but unlinked to preserve the audit trail.
    """
    if not client_ids:
        return

    # 1) Get all appointment IDs that belong to these clients
    appt_rows = db.query(Appointment.id).filter(Appointment.client_id.in_(client_ids)).all()
    appt_ids = [r[0] for r in appt_rows]

    # 2) Nullify FKs that point at those appointments (audit trail / receipts)
    if appt_ids:
        try:
            db.execute(update(AutomationExecution).where(AutomationExecution.appointment_id.in_(appt_ids)).values(appointment_id=None))
        except Exception:
            pass
        try:
            db.execute(update(WorkflowExecution).where(WorkflowExecution.appointment_id.in_(appt_ids)).values(appointment_id=None))
        except Exception:
            pass
        try:
            db.execute(update(Checkout).where(Checkout.appointment_id.in_(appt_ids)).values(appointment_id=None))
        except Exception:
            pass

    # 3) Nullify client_id on records we want to keep (invoices, checkouts, automation logs)
    for model in (Invoice, Checkout, AutomationExecution, WorkflowExecution):
        try:
            db.execute(update(model).where(model.client_id.in_(client_ids)).values(client_id=None))
        except Exception:
            pass

    # 4) Delete child rows we don't need to preserve
    db.query(VisitHistory).filter(VisitHistory.client_id.in_(client_ids)).delete(synchronize_session=False)
    db.query(ClientNote).filter(ClientNote.client_id.in_(client_ids)).delete(synchronize_session=False)

    # 5) WhatsApp: messages → conversations
    convo_rows = db.query(WhatsAppConversation.id).filter(WhatsAppConversation.client_id.in_(client_ids)).all()
    convo_ids = [r[0] for r in convo_rows]
    if convo_ids:
        db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id.in_(convo_ids)).delete(synchronize_session=False)
        db.query(WhatsAppConversation).filter(WhatsAppConversation.id.in_(convo_ids)).delete(synchronize_session=False)

    # 6) Delete optional models that reference clients (some may not exist in older tenants)
    for model_name in ("ClientMemory", "LoyaltyAccount", "LoyaltyTransaction", "ReviewRequest", "Order"):
        try:
            from database import models as _models
            ModelCls = getattr(_models, model_name, None)
            if ModelCls is not None and hasattr(ModelCls, "client_id"):
                db.query(ModelCls).filter(ModelCls.client_id.in_(client_ids)).delete(synchronize_session=False)
        except Exception:
            pass

    # 7) Now safe to delete the appointments themselves
    if appt_ids:
        db.query(Appointment).filter(Appointment.id.in_(appt_ids)).delete(synchronize_session=False)

    # 8) Finally the clients
    db.query(Client).filter(Client.id.in_(client_ids)).delete(synchronize_session=False)


# ============================================================================
# STAFF ENDPOINTS
# ============================================================================

@router.delete("/staff/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        q = q.filter(Staff.tenant_id == tid)
    staff = q.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Check for associated records — soft delete if has history, hard delete if clean
    from database.models import VisitHistory, Appointment
    has_visits = db.query(VisitHistory).filter(VisitHistory.staff_id == staff_id).first()
    has_appts = db.query(Appointment).filter(Appointment.staff_id == staff_id).first()

    if has_visits or has_appts:
        # Soft delete — deactivate instead of removing (preserves history integrity)
        staff.is_active = False
        db.commit()
        return {"success": True, "message": f"Staff '{staff.name}' desactivado (tiene historial asociado)"}

    db.delete(staff)
    db.commit()
    return {"success": True, "message": f"Staff '{staff.name}' eliminado"}


# ============================================================================
# CLIENT ENDPOINTS
# ============================================================================

@router.delete("/clients/{client_id}")
def delete_client(client_id: int, hard: bool = False, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Delete client. soft=deactivate (default), hard=permanent delete with all history."""
    tid = safe_tid(user, db)
    q = db.query(Client).filter(Client.id == client_id)
    if tid:
        q = q.filter(Client.tenant_id == tid)
    client = q.first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    if hard:
        client_name = client.name
        _cascade_delete_clients(db, [client_id])
        db.commit()
        return {"success": True, "message": f"Client '{client_name}' permanently deleted"}
    else:
        client.is_active = False
        db.commit()
        return {"success": True, "message": f"Client '{client.name}' deactivated"}


from pydantic import BaseModel
from typing import List

class BulkDeleteRequest(BaseModel):
    ids: List[int]
    hard: bool = True


@router.post("/clients/bulk-delete")
def bulk_delete_clients(payload: BulkDeleteRequest, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Delete many clients at once. Tenant-scoped — silently skips ids that don't belong."""
    tid = safe_tid(user, db)
    if not payload.ids:
        return {"success": True, "deleted": 0, "skipped": 0}

    q = db.query(Client).filter(Client.id.in_(payload.ids))
    if tid:
        q = q.filter(Client.tenant_id == tid)
    clients = q.all()
    valid_ids = [c.id for c in clients]
    skipped = len(payload.ids) - len(valid_ids)

    if not valid_ids:
        return {"success": True, "deleted": 0, "skipped": skipped}

    if payload.hard:
        _cascade_delete_clients(db, valid_ids)
    else:
        for c in clients:
            c.is_active = False

    db.commit()
    return {"success": True, "deleted": len(valid_ids), "skipped": skipped}


# ============================================================================
# VISIT HISTORY ENDPOINTS
# ============================================================================

@router.delete("/visits/{visit_id}")
def delete_visit(visit_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(VisitHistory).filter(VisitHistory.id == visit_id)
    if tid:
        q = q.filter(VisitHistory.tenant_id == tid)
    visit = q.first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    db.delete(visit)
    db.commit()
    return {"success": True, "message": "Visit deleted"}


# ============================================================================
# CLIENT NOTE ENDPOINTS
# ============================================================================

@router.delete("/client-notes/{note_id}")
def delete_client_note(note_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    note = db.query(ClientNote).filter(ClientNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    # ClientNote has no tenant_id — verify ownership through the parent client
    if tid:
        client = db.query(Client).filter(Client.id == note.client_id, Client.tenant_id == tid).first()
        if not client:
            raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()
    return {"success": True, "message": "Note deleted"}


# ============================================================================
# SERVICE ENDPOINTS
# ============================================================================

@router.delete("/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Service).filter(Service.id == service_id)
    if tid:
        q = q.filter(Service.tenant_id == tid)
    service = q.first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    db.delete(service)
    db.commit()
    return {"success": True, "message": f"Service '{service.name}' deleted"}


# ============================================================================
# APPOINTMENT ENDPOINTS
# ============================================================================

@router.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Appointment).filter(Appointment.id == appointment_id)
    if tid:
        q = q.filter(Appointment.tenant_id == tid)
    appointment = q.first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Clear FK references before deleting to avoid ForeignKeyViolation
    db.query(WorkflowExecution).filter(WorkflowExecution.appointment_id == appointment_id).update({WorkflowExecution.appointment_id: None})
    db.query(AutomationExecution).filter(AutomationExecution.appointment_id == appointment_id).update({AutomationExecution.appointment_id: None})
    db.query(Checkout).filter(Checkout.appointment_id == appointment_id).update({Checkout.appointment_id: None})
    db.delete(appointment)
    db.commit()
    return {"success": True, "message": "Appointment deleted"}
