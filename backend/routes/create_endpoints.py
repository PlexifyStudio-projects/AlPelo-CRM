from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Staff, Client, VisitHistory, ClientNote
from schemas import (
    StaffCreate, StaffResponse,
    ClientCreate, ClientResponse,
    VisitHistoryCreate, VisitHistoryResponse,
    ClientNoteCreate, ClientNoteResponse,
)

router = APIRouter()


# ============================================================================
# STAFF ENDPOINTS
# ============================================================================

@router.post("/staff/", response_model=StaffResponse)
def create_staff(data: StaffCreate, db: Session = Depends(get_db)):
    staff = Staff(**data.model_dump())
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return StaffResponse.model_validate(staff)


# ============================================================================
# CLIENT ENDPOINTS
# ============================================================================

@router.post("/clients/", response_model=ClientResponse)
def create_client(data: ClientCreate, db: Session = Depends(get_db)):
    from routes._client_helpers import compute_client_fields

    existing = db.query(Client).filter(Client.client_id == data.client_id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Client ID '{data.client_id}' already exists")

    if data.preferred_barber_id:
        barber = db.query(Staff).filter(Staff.id == data.preferred_barber_id).first()
        if not barber:
            raise HTTPException(status_code=404, detail="Preferred barber not found")

    client = Client(**data.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)

    return compute_client_fields(client, db)


# ============================================================================
# VISIT HISTORY ENDPOINTS
# ============================================================================

@router.post("/visits/", response_model=VisitHistoryResponse)
def create_visit(data: VisitHistoryCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == data.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    staff = db.query(Staff).filter(Staff.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    if data.status not in ("completed", "no_show", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be: completed, no_show, cancelled")

    visit = VisitHistory(**data.model_dump())
    db.add(visit)
    db.commit()
    db.refresh(visit)

    return VisitHistoryResponse(
        **{c.name: getattr(visit, c.name) for c in visit.__table__.columns},
        staff_name=staff.name,
    )


# ============================================================================
# CLIENT NOTE ENDPOINTS
# ============================================================================

@router.post("/client-notes/", response_model=ClientNoteResponse)
def create_client_note(data: ClientNoteCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == data.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    note = ClientNote(**data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)

    return ClientNoteResponse.model_validate(note)
