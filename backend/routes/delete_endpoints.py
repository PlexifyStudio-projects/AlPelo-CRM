from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Staff, Client, VisitHistory, ClientNote

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
def delete_client(client_id: int, db: Session = Depends(get_db)):
    """Soft delete - sets is_active=False. History is preserved."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

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
