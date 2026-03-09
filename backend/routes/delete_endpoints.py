from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Staff, Client, VisitHistory, ClientNote, Service, Appointment, WhatsAppConversation, WhatsAppMessage

router = APIRouter()


# ============================================================================
# STAFF ENDPOINTS
# ============================================================================

@router.delete("/staff/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    db.delete(staff)
    db.commit()
    return {"success": True, "message": f"Staff '{staff.name}' deleted"}


# ============================================================================
# CLIENT ENDPOINTS
# ============================================================================

@router.delete("/clients/{client_id}")
def delete_client(client_id: int, hard: bool = False, db: Session = Depends(get_db)):
    """Delete client. soft=deactivate (default), hard=permanent delete with all history."""
    client = db.query(Client).filter(Client.id == client_id).first()
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


# ============================================================================
# VISIT HISTORY ENDPOINTS
# ============================================================================

@router.delete("/visits/{visit_id}")
def delete_visit(visit_id: int, db: Session = Depends(get_db)):
    visit = db.query(VisitHistory).filter(VisitHistory.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    db.delete(visit)
    db.commit()
    return {"success": True, "message": "Visit deleted"}


# ============================================================================
# CLIENT NOTE ENDPOINTS
# ============================================================================

@router.delete("/client-notes/{note_id}")
def delete_client_note(note_id: int, db: Session = Depends(get_db)):
    note = db.query(ClientNote).filter(ClientNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    db.delete(note)
    db.commit()
    return {"success": True, "message": "Note deleted"}


# ============================================================================
# SERVICE ENDPOINTS
# ============================================================================

@router.delete("/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    db.delete(service)
    db.commit()
    return {"success": True, "message": f"Service '{service.name}' deleted"}


# ============================================================================
# APPOINTMENT ENDPOINTS
# ============================================================================

@router.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    db.delete(appointment)
    db.commit()
    return {"success": True, "message": "Appointment deleted"}
