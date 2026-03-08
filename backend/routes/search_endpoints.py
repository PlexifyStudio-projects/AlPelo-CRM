from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import cast, String

from database.connection import get_db
from database.models import Staff, Client, VisitHistory, ClientNote, Service, Appointment
from schemas import (
    StaffResponse,
    ClientResponse, ClientListResponse,
    VisitHistoryResponse,
    ClientNoteResponse,
    DashboardKPIs,
    ServiceResponse,
    AppointmentResponse,
)

router = APIRouter()


# ============================================================================
# STAFF ENDPOINTS
# ============================================================================

@router.get("/staff/", response_model=List[StaffResponse])
def list_staff(
    role: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("name"),
    db: Session = Depends(get_db),
):
    query = db.query(Staff)

    if active is not None:
        query = query.filter(Staff.is_active == active)

    if role:
        query = query.filter(Staff.role.ilike(f"%{role}%"))

    if skill:
        query = query.filter(cast(Staff.skills, String).ilike(f"%{skill}%"))

    if search:
        term = f"%{search}%"
        query = query.filter(
            Staff.name.ilike(term)
            | Staff.specialty.ilike(term)
            | Staff.role.ilike(term)
            | cast(Staff.skills, String).ilike(term)
        )

    if sort_by == "hire_date":
        query = query.order_by(Staff.hire_date.asc().nullslast())
    elif sort_by == "role":
        query = query.order_by(Staff.role, Staff.name)
    else:
        query = query.order_by(Staff.name)

    return [StaffResponse.model_validate(s) for s in query.all()]


@router.get("/staff/{staff_id}", response_model=StaffResponse)
def get_staff(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return StaffResponse.model_validate(staff)


# ============================================================================
# CLIENT ENDPOINTS
# ============================================================================

@router.get("/clients/", response_model=List[ClientListResponse])
def list_clients(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    tag: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("name"),
    db: Session = Depends(get_db),
):
    from routes._helpers import compute_client_list_item

    query = db.query(Client)

    if active is not None:
        query = query.filter(Client.is_active == active)

    if search:
        term = f"%{search}%"
        query = query.filter(
            Client.name.ilike(term)
            | Client.phone.ilike(term)
            | Client.email.ilike(term)
            | Client.client_id.ilike(term)
        )

    if tag:
        query = query.filter(cast(Client.tags, String).ilike(f"%{tag}%"))

    if sort_by == "created_at":
        query = query.order_by(Client.created_at.desc())
    elif sort_by == "client_id":
        query = query.order_by(Client.client_id)
    else:
        query = query.order_by(Client.name)

    clients = query.all()
    result = [compute_client_list_item(c, db) for c in clients]

    # Filter by computed status if requested
    if status:
        result = [c for c in result if c.status == status]

    return result


@router.get("/clients/{client_id}", response_model=ClientResponse)
def get_client(client_id: int, db: Session = Depends(get_db)):
    from routes._helpers import compute_client_fields

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return compute_client_fields(client, db)


# ============================================================================
# VISIT HISTORY ENDPOINTS
# ============================================================================

@router.get("/clients/{client_id}/visits/", response_model=List[VisitHistoryResponse])
def list_client_visits(
    client_id: int,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    query = (
        db.query(VisitHistory)
        .filter(VisitHistory.client_id == client_id)
        .order_by(VisitHistory.visit_date.desc())
    )

    if status:
        query = query.filter(VisitHistory.status == status)

    visits = query.all()
    result = []
    for v in visits:
        staff = db.query(Staff).filter(Staff.id == v.staff_id).first()
        result.append(VisitHistoryResponse(
            **{c.name: getattr(v, c.name) for c in v.__table__.columns},
            staff_name=staff.name if staff else None,
        ))

    return result


@router.get("/visits/{visit_id}", response_model=VisitHistoryResponse)
def get_visit(visit_id: int, db: Session = Depends(get_db)):
    visit = db.query(VisitHistory).filter(VisitHistory.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    staff = db.query(Staff).filter(Staff.id == visit.staff_id).first()
    return VisitHistoryResponse(
        **{c.name: getattr(visit, c.name) for c in visit.__table__.columns},
        staff_name=staff.name if staff else None,
    )


# ============================================================================
# CLIENT NOTE ENDPOINTS
# ============================================================================

@router.get("/clients/{client_id}/notes/", response_model=List[ClientNoteResponse])
def list_client_notes(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    notes = (
        db.query(ClientNote)
        .filter(ClientNote.client_id == client_id)
        .order_by(ClientNote.created_at.desc())
        .all()
    )

    return [ClientNoteResponse.model_validate(n) for n in notes]


# ============================================================================
# DASHBOARD KPIs
# ============================================================================

@router.get("/dashboard/kpis", response_model=DashboardKPIs)
def get_dashboard_kpis(db: Session = Depends(get_db)):
    from routes._helpers import compute_client_list_item

    clients = db.query(Client).filter(Client.is_active == True).all()
    enriched = [compute_client_list_item(c, db) for c in clients]

    total = len(enriched)
    active = sum(1 for c in enriched if c.status == "activo")
    vip = sum(1 for c in enriched if c.status == "vip")
    nuevo = sum(1 for c in enriched if c.status == "nuevo")
    at_risk = sum(1 for c in enriched if c.status == "en_riesgo")
    inactive = sum(1 for c in enriched if c.status == "inactivo")

    total_revenue = sum(c.total_spent for c in enriched)
    clients_with_visits = [c for c in enriched if c.total_visits > 0]
    avg_ticket = (
        total_revenue // len(clients_with_visits) if clients_with_visits else 0
    )

    active_count = active + vip
    retention_rate = (active_count / total * 100) if total > 0 else 0

    return DashboardKPIs(
        total_clients=total,
        active_clients=active,
        at_risk_clients=at_risk,
        inactive_clients=inactive,
        vip_clients=vip,
        new_clients=nuevo,
        retention_rate=round(retention_rate, 1),
        total_revenue=total_revenue,
        avg_ticket=avg_ticket,
    )


# ============================================================================
# SERVICE ENDPOINTS
# ============================================================================

@router.get("/services/", response_model=List[ServiceResponse])
def list_services(
    category: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Service)

    if active is not None:
        query = query.filter(Service.is_active == active)

    if category:
        query = query.filter(Service.category.ilike(f"%{category}%"))

    if search:
        term = f"%{search}%"
        query = query.filter(
            Service.name.ilike(term) | Service.category.ilike(term)
        )

    services = query.order_by(Service.category, Service.name).all()

    # Batch-load staff names
    all_staff_ids = set()
    for s in services:
        if s.staff_ids:
            all_staff_ids.update(s.staff_ids)

    staff_map = {}
    if all_staff_ids:
        staff_list = db.query(Staff).filter(Staff.id.in_(all_staff_ids)).all()
        staff_map = {s.id: s.name for s in staff_list}

    result = []
    for s in services:
        names = [staff_map[sid] for sid in (s.staff_ids or []) if sid in staff_map]
        result.append(ServiceResponse(
            **{c.name: getattr(s, c.name) for c in s.__table__.columns},
            staff_names=names,
        ))

    return result


@router.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

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

@router.get("/appointments/", response_model=List[AppointmentResponse])
def list_appointments(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    staff_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    from datetime import date as dt_date

    query = db.query(Appointment)

    if date_from:
        query = query.filter(Appointment.date >= dt_date.fromisoformat(date_from))
    if date_to:
        query = query.filter(Appointment.date <= dt_date.fromisoformat(date_to))
    if staff_id:
        query = query.filter(Appointment.staff_id == staff_id)
    if status:
        query = query.filter(Appointment.status == status)

    appointments = query.order_by(Appointment.date, Appointment.time).all()

    result = []
    staff_cache = {}
    service_cache = {}

    for a in appointments:
        if a.staff_id not in staff_cache:
            staff = db.query(Staff).filter(Staff.id == a.staff_id).first()
            staff_cache[a.staff_id] = staff.name if staff else None
        if a.service_id not in service_cache:
            svc = db.query(Service).filter(Service.id == a.service_id).first()
            service_cache[a.service_id] = svc.name if svc else None

        result.append(AppointmentResponse(
            **{c.name: getattr(a, c.name) for c in a.__table__.columns},
            staff_name=staff_cache.get(a.staff_id),
            service_name=service_cache.get(a.service_id),
        ))

    return result


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    staff = db.query(Staff).filter(Staff.id == appointment.staff_id).first()
    service = db.query(Service).filter(Service.id == appointment.service_id).first()

    return AppointmentResponse(
        **{c.name: getattr(appointment, c.name) for c in appointment.__table__.columns},
        staff_name=staff.name if staff else None,
        service_name=service.name if service else None,
    )
