from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Staff, Client, VisitHistory, Service, Appointment
from schemas import (
    StaffUpdate, StaffResponse,
    ClientUpdate, ClientResponse,
    VisitHistoryUpdate, VisitHistoryResponse,
    ServiceUpdate, ServiceResponse,
    AppointmentUpdate, AppointmentResponse,
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
    from routes._helpers import compute_client_fields

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


# ============================================================================
# SERVICE ENDPOINTS
# ============================================================================

@router.put("/services/{service_id}", response_model=ServiceResponse)
def update_service(service_id: int, data: ServiceUpdate, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(service, field, value)

    db.commit()
    db.refresh(service)

    staff_names = []
    if service.staff_ids:
        staff_list = db.query(Staff).filter(Staff.id.in_(service.staff_ids)).all()
        staff_names = [s.name for s in staff_list]

    return ServiceResponse(
        **{c.name: getattr(service, c.name) for c in service.__table__.columns},
        staff_names=staff_names,
    )


# ============================================================================
# APPOINTMENT ENDPOINTS
# ============================================================================

@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(appointment_id: int, data: AppointmentUpdate, db: Session = Depends(get_db)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    update_data = data.model_dump(exclude_unset=True)

    # Convert date string to date object if present
    if "date" in update_data and update_data["date"] is not None:
        from datetime import date as date_type
        try:
            update_data["date"] = date_type.fromisoformat(update_data["date"])
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")

    if "status" in update_data and update_data["status"] not in ("confirmed", "completed", "cancelled", "no_show"):
        raise HTTPException(status_code=400, detail="Invalid status")

    if "staff_id" in update_data:
        staff = db.query(Staff).filter(Staff.id == update_data["staff_id"]).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")

    if "service_id" in update_data:
        svc = db.query(Service).filter(Service.id == update_data["service_id"]).first()
        if not svc:
            raise HTTPException(status_code=404, detail="Service not found")

    for field, value in update_data.items():
        setattr(appointment, field, value)

    db.commit()
    db.refresh(appointment)

    staff = db.query(Staff).filter(Staff.id == appointment.staff_id).first()
    service = db.query(Service).filter(Service.id == appointment.service_id).first()

    return AppointmentResponse(
        **{c.name: getattr(appointment, c.name) for c in appointment.__table__.columns},
        staff_name=staff.name if staff else None,
        service_name=service.name if service else None,
    )
