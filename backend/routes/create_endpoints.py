from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Admin, Staff, Client, VisitHistory, ClientNote, Service, Appointment
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid
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
def create_staff(data: StaffCreate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    from auth.security import hash_password

    tid = safe_tid(user, db)
    staff_data = data.model_dump()

    # Handle credentials
    username = staff_data.pop("username", None)
    password = staff_data.pop("password", None)

    if username and password:
        username = username.strip()
        if len(password) < 6:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
        # Check uniqueness across Admin AND Staff
        from database.models import Admin as AdminModel
        if db.query(AdminModel).filter(AdminModel.username == username).first():
            raise HTTPException(status_code=409, detail=f"El usuario '{username}' ya esta en uso")
        if db.query(Staff).filter(Staff.username == username).first():
            raise HTTPException(status_code=409, detail=f"El usuario '{username}' ya esta en uso")
        staff_data["username"] = username
        staff_data["password"] = hash_password(password)

    staff = Staff(tenant_id=tid, **staff_data)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return StaffResponse.model_validate(staff)


# ============================================================================
# CLIENT ENDPOINTS
# ============================================================================

@router.post("/clients/", response_model=ClientResponse)
def create_client(data: ClientCreate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    from routes._helpers import compute_client_fields

    # Auto-generate client_id if not provided
    client_data = data.model_dump()
    if not client_data.get("client_id"):
        last_client = db.query(Client).order_by(Client.id.desc()).first()
        next_num = (last_client.id + 1) if last_client else 1
        client_data["client_id"] = f"C{next_num:05d}"

    existing = db.query(Client).filter(Client.client_id == client_data["client_id"]).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Client ID '{client_data['client_id']}' ya existe")

    tid = safe_tid(user, db)
    client = Client(tenant_id=tid, **client_data)
    db.add(client)
    db.commit()
    db.refresh(client)

    # Notify: new client
    try:
        from notifications import notify
        notify(db, tid, "new_client",
               f"Nuevo cliente: {client.name}",
               f"Tel: {client.phone or 'sin tel'} | Creado por admin",
               icon="👤", link="/clientes")
    except Exception:
        pass

    return compute_client_fields(client, db)


# ============================================================================
# VISIT HISTORY ENDPOINTS
# ============================================================================

@router.post("/visits/", response_model=VisitHistoryResponse)
def create_visit(data: VisitHistoryCreate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    client = db.query(Client).filter(Client.id == data.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    staff = db.query(Staff).filter(Staff.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    if data.status not in ("completed", "no_show", "cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be: completed, no_show, cancelled")

    tid = safe_tid(user, db)
    visit = VisitHistory(tenant_id=tid, **data.model_dump())
    db.add(visit)
    db.commit()
    db.refresh(visit)

    # Award loyalty points for completed visits
    if data.status == "completed" and tid:
        try:
            from routes.loyalty_endpoints import award_visit_points
            award_visit_points(db, client_id=data.client_id, amount=float(data.amount or 0), tenant_id=tid, visit_id=visit.id)
        except Exception as lp_err:
            print(f"[LOYALTY] Error awarding points: {lp_err}")

    return VisitHistoryResponse(
        **{c.name: getattr(visit, c.name) for c in visit.__table__.columns},
        staff_name=staff.name,
    )


# ============================================================================
# CLIENT NOTE ENDPOINTS
# ============================================================================

@router.post("/client-notes/", response_model=ClientNoteResponse)
def create_client_note(data: ClientNoteCreate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    client = db.query(Client).filter(Client.id == data.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    tid = safe_tid(user, db)
    note = ClientNote(tenant_id=tid, **data.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)

    return ClientNoteResponse.model_validate(note)


# ============================================================================
# SERVICE ENDPOINTS
# ============================================================================

@router.post("/services/", response_model=ServiceResponse)
def create_service(data: ServiceCreate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    service = Service(tenant_id=tid, **data.model_dump())
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
def create_appointment(data: AppointmentCreate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    staff = db.query(Staff).filter(Staff.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    service = db.query(Service).filter(Service.id == data.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    appt_data = data.model_dump()
    duration_mins = appt_data.get("duration_minutes") or service.duration_minutes or 30
    appt_data["duration_minutes"] = duration_mins
    if appt_data.get("price") is None:
        appt_data["price"] = service.price

    tid = safe_tid(user, db)

    # --- CONFLICT VALIDATION ---
    req_hour, req_min = int(data.time.split(":")[0]), int(data.time.split(":")[1])
    req_start = req_hour * 60 + req_min
    req_end = req_start + duration_mins

    # 1. CLIENT CONFLICT: same client can't have overlapping appointments
    if data.client_name:
        client = db.query(Client).filter(
            Client.name.ilike(f"%{data.client_name.strip()}%"),
            Client.is_active == True,
        )
        if tid:
            client = client.filter(Client.tenant_id == tid)
        client = client.first()
        if client:
            client_apts = db.query(Appointment).filter(
                Appointment.client_id == client.id,
                Appointment.date == data.date,
                Appointment.status.in_(["confirmed", "completed"]),
            ).all()
            for ea in client_apts:
                try:
                    eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
                    ea_start = eh * 60 + em
                    ea_end = ea_start + (ea.duration_minutes or 30)
                    if req_start < ea_end and req_end > ea_start:
                        ea_end_h, ea_end_m = ea_end // 60, ea_end % 60
                        raise HTTPException(
                            status_code=409,
                            detail=f"{data.client_name} ya tiene una cita a las {ea.time} hasta las {ea_end_h:02d}:{ea_end_m:02d}. No se puede agendar otra cita que se cruce."
                        )
                except HTTPException:
                    raise
                except Exception:
                    pass

    # 2. STAFF CONFLICT: same staff can't have overlapping appointments
    staff_apts = db.query(Appointment).filter(
        Appointment.staff_id == data.staff_id,
        Appointment.date == data.date,
        Appointment.status.in_(["confirmed", "completed"]),
    ).all()
    for ea in staff_apts:
        try:
            eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
            ea_start = eh * 60 + em
            ea_end = ea_start + (ea.duration_minutes or 30)
            if req_start < ea_end and req_end > ea_start:
                ea_end_h, ea_end_m = ea_end // 60, ea_end % 60
                raise HTTPException(
                    status_code=409,
                    detail=f"{staff.name} ya tiene una cita a las {ea.time} hasta las {ea_end_h:02d}:{ea_end_m:02d}. No se puede agendar otra cita que se cruce."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    appointment = Appointment(tenant_id=tid, **appt_data)
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    # Notify: new appointment
    try:
        from notifications import notify
        notify(db, tid, "new_appointment",
               f"Nueva cita: {data.client_name} con {staff.name}",
               f"{service.name} — {data.date} a las {data.time}",
               icon="📅", link="/agenda")
    except Exception:
        pass

    # Filter to schema fields only
    apt_data = {}
    for c in appointment.__table__.columns:
        if c.name in AppointmentResponse.model_fields:
            apt_data[c.name] = getattr(appointment, c.name)
    apt_data["staff_name"] = staff.name
    apt_data["service_name"] = service.name
    return AppointmentResponse(**apt_data)
