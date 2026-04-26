from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Staff, Client, VisitHistory, ClientNote, Service, Appointment, WhatsAppConversation, WhatsAppMessage, Admin, WorkflowExecution, AutomationExecution, Checkout
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter()


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
        # Delete related records first (all foreign keys)
        db.query(VisitHistory).filter(VisitHistory.client_id == client_id).delete()
        db.query(ClientNote).filter(ClientNote.client_id == client_id).delete()
        db.query(Appointment).filter(Appointment.client_id == client_id).delete()
        # WhatsApp conversations and their messages
        convos = db.query(WhatsAppConversation).filter(WhatsAppConversation.client_id == client_id).all()
        for c in convos:
            db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == c.id).delete()
            db.delete(c)
        db.delete(client)
        db.commit()
        return {"success": True, "message": f"Client '{client.name}' permanently deleted"}
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
        # Bulk-cascade related rows
        db.query(VisitHistory).filter(VisitHistory.client_id.in_(valid_ids)).delete(synchronize_session=False)
        db.query(ClientNote).filter(ClientNote.client_id.in_(valid_ids)).delete(synchronize_session=False)
        db.query(Appointment).filter(Appointment.client_id.in_(valid_ids)).delete(synchronize_session=False)
        # WA conversations + messages
        convos = db.query(WhatsAppConversation).filter(WhatsAppConversation.client_id.in_(valid_ids)).all()
        convo_ids = [c.id for c in convos]
        if convo_ids:
            db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id.in_(convo_ids)).delete(synchronize_session=False)
            db.query(WhatsAppConversation).filter(WhatsAppConversation.id.in_(convo_ids)).delete(synchronize_session=False)
        # Finally clients
        db.query(Client).filter(Client.id.in_(valid_ids)).delete(synchronize_session=False)
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
