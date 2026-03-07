from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Staff, Client, VisitHistory
from schemas import (
    StaffUpdate, StaffResponse,
    ClientUpdate, ClientResponse,
    VisitHistoryUpdate, VisitHistoryResponse,
)

router = APIRouter()


# ============================================================================
# STAFF ENDPOINTS
# ============================================================================

@router.put("/staff/{staff_id}", response_model=StaffResponse)
def update_staff(staff_id: int, data: StaffUpdate, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(staff, field, value)

    db.commit()
    db.refresh(staff)
    return StaffResponse.model_validate(staff)


@router.put("/staff/{staff_id}/skills", response_model=StaffResponse)
def update_skills(staff_id: int, skills: List[str], db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    staff.skills = skills
    db.commit()
    db.refresh(staff)
    return StaffResponse.model_validate(staff)


# ============================================================================
# CLIENT ENDPOINTS
# ============================================================================

@router.put("/clients/{client_id}", response_model=ClientResponse)
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db)):
    from routes._client_helpers import compute_client_fields

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = data.model_dump(exclude_unset=True)

    if "status_override" in update_data:
        valid_statuses = {"activo", "vip", "en_riesgo", "inactivo", "nuevo", None}
        if update_data["status_override"] not in valid_statuses:
            raise HTTPException(status_code=400, detail="Invalid status override")

    if "preferred_barber_id" in update_data and update_data["preferred_barber_id"]:
        barber = db.query(Staff).filter(Staff.id == update_data["preferred_barber_id"]).first()
        if not barber:
            raise HTTPException(status_code=404, detail="Preferred barber not found")

    for field, value in update_data.items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)

    return compute_client_fields(client, db)


# ============================================================================
# VISIT HISTORY ENDPOINTS
# ============================================================================

@router.put("/visits/{visit_id}", response_model=VisitHistoryResponse)
def update_visit(visit_id: int, data: VisitHistoryUpdate, db: Session = Depends(get_db)):
    visit = db.query(VisitHistory).filter(VisitHistory.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    update_data = data.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"] not in ("completed", "no_show", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")

    if "staff_id" in update_data:
        staff = db.query(Staff).filter(Staff.id == update_data["staff_id"]).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")

    for field, value in update_data.items():
        setattr(visit, field, value)

    db.commit()
    db.refresh(visit)

    staff = db.query(Staff).filter(Staff.id == visit.staff_id).first()
    return VisitHistoryResponse(
        **{c.name: getattr(visit, c.name) for c in visit.__table__.columns},
        staff_name=staff.name if staff else None,
    )
