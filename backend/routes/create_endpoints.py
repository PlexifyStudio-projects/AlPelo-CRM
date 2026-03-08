from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Staff, Client, VisitHistory, ClientNote, Service, Appointment
from schemas import (
    StaffCreate, StaffResponse,
    ClientCreate, ClientResponse,
    VisitHistoryCreate, VisitHistoryResponse,
    ClientNoteCreate, ClientNoteResponse,
    ServiceCreate, ServiceResponse,
    AppointmentCreate, AppointmentResponse,
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
    from routes._helpers import compute_client_fields

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


# ============================================================================
# SERVICE ENDPOINTS
# ============================================================================

@router.post("/services/", response_model=ServiceResponse)
def create_service(data: ServiceCreate, db: Session = Depends(get_db)):
    service = Service(**data.model_dump())
    db.add(service)
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

@router.post("/appointments/", response_model=AppointmentResponse)
def create_appointment(data: AppointmentCreate, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    service = db.query(Service).filter(Service.id == data.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    appt_data = data.model_dump()
    if appt_data.get("duration_minutes") is None:
        appt_data["duration_minutes"] = service.duration_minutes or 30
    if appt_data.get("price") is None:
        appt_data["price"] = service.price

    appointment = Appointment(**appt_data)
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return AppointmentResponse(
        **{c.name: getattr(appointment, c.name) for c in appointment.__table__.columns},
        staff_name=staff.name,
        service_name=service.name,
    )
