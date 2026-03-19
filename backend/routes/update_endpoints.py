from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Staff, Client, VisitHistory, Service, Appointment, Admin
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid
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
def update_staff(staff_id: int, data: StaffUpdate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    from auth.security import hash_password

    tid = safe_tid(user, db)
    q = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        q = q.filter(Staff.tenant_id == tid)
    staff = q.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle credential fields separately
    new_username = update_data.pop("username", None)
    new_password = update_data.pop("password", None)

    if new_username is not None:
        new_username = new_username.strip()
        if new_username and new_username != staff.username:
            # Check uniqueness across Admin AND Staff
            if db.query(Admin).filter(Admin.username == new_username).first():
                raise HTTPException(status_code=409, detail=f"El usuario '{new_username}' ya esta en uso")
            existing = db.query(Staff).filter(Staff.username == new_username, Staff.id != staff_id).first()
            if existing:
                raise HTTPException(status_code=409, detail=f"El usuario '{new_username}' ya esta en uso")
        staff.username = new_username if new_username else None

    if new_password is not None:
        if new_password:
            if len(new_password) < 6:
                raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
            staff.password = hash_password(new_password)
        else:
            staff.password = None

    for field, value in update_data.items():
        setattr(staff, field, value)

    db.commit()
    db.refresh(staff)
    return StaffResponse.model_validate(staff)


@router.put("/staff/{staff_id}/credentials")
def update_staff_credentials(staff_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Admin-only: update staff login credentials."""
    from auth.security import hash_password
    from schemas import StaffCredentialsUpdate

    creds = StaffCredentialsUpdate(**data)

    tid = safe_tid(user, db)
    q = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        q = q.filter(Staff.tenant_id == tid)
    staff = q.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    username = creds.username.strip()
    if len(creds.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    # Check uniqueness
    if username != staff.username:
        if db.query(Admin).filter(Admin.username == username).first():
            raise HTTPException(status_code=409, detail=f"El usuario '{username}' ya esta en uso")
        existing = db.query(Staff).filter(Staff.username == username, Staff.id != staff_id).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"El usuario '{username}' ya esta en uso")

    staff.username = username
    staff.password = hash_password(creds.password)
    db.commit()

    return {"success": True, "message": f"Credenciales actualizadas para '{staff.name}'"}


@router.put("/staff/{staff_id}/skills", response_model=StaffResponse)
def update_skills(staff_id: int, skills: List[str], db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        q = q.filter(Staff.tenant_id == tid)
    staff = q.first()
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
def update_client(client_id: int, data: ClientUpdate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    from routes._helpers import compute_client_fields

    tid = safe_tid(user, db)
    q = db.query(Client).filter(Client.id == client_id)
    if tid:
        q = q.filter(Client.tenant_id == tid)
    client = q.first()
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
def update_visit(visit_id: int, data: VisitHistoryUpdate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(VisitHistory).filter(VisitHistory.id == visit_id)
    if tid:
        q = q.filter(VisitHistory.tenant_id == tid)
    visit = q.first()
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
def update_service(service_id: int, data: ServiceUpdate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Service).filter(Service.id == service_id)
    if tid:
        q = q.filter(Service.tenant_id == tid)
    service = q.first()
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
def update_appointment(appointment_id: int, data: AppointmentUpdate, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(Appointment).filter(Appointment.id == appointment_id)
    if tid:
        q = q.filter(Appointment.tenant_id == tid)
    appointment = q.first()
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

    if "status" in update_data and update_data["status"] not in ("confirmed", "completed", "cancelled", "no_show", "paid"):
        raise HTTPException(status_code=400, detail="Invalid status")

    if "staff_id" in update_data:
        staff = db.query(Staff).filter(Staff.id == update_data["staff_id"]).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")

    if "service_id" in update_data:
        svc = db.query(Service).filter(Service.id == update_data["service_id"]).first()
        if not svc:
            raise HTTPException(status_code=404, detail="Service not found")

    # Check if status is changing TO completed (and wasn't already completed)
    old_status = appointment.status
    new_status = update_data.get("status")

    for field, value in update_data.items():
        setattr(appointment, field, value)

    db.commit()
    db.refresh(appointment)

    # Notify on status changes
    if new_status and new_status != old_status:
        try:
            from notifications import notify
            _tid = appointment.tenant_id
            _status_labels = {"completed": "completada", "paid": "pagada", "cancelled": "cancelada", "no_show": "no asistio"}
            _icons = {"completed": "✅", "paid": "💰", "cancelled": "❌", "no_show": "⚠️"}
            _label = _status_labels.get(new_status, new_status)
            notify(_tid or 1, f"appointment_{new_status}",
                   f"Cita {_label}: {appointment.client_name}",
                   f"{appointment.date} {appointment.time} | {staff.name if staff else ''} | {service.name if service else ''}",
                   _icons.get(new_status, "📋"), "/agenda")
        except Exception:
            pass

    staff = db.query(Staff).filter(Staff.id == appointment.staff_id).first()
    service = db.query(Service).filter(Service.id == appointment.service_id).first()

    # ── Auto-create VisitHistory when appointment is completed or paid ──
    _done_statuses = ("completed", "paid")
    if new_status in _done_statuses and old_status not in _done_statuses and appointment.client_id:
        existing_visit = db.query(VisitHistory).filter(
            VisitHistory.client_id == appointment.client_id,
            VisitHistory.visit_date == appointment.date,
            VisitHistory.staff_id == appointment.staff_id,
            VisitHistory.service_name == (service.name if service else appointment.client_name),
        ).first()
        if not existing_visit:
            visit = VisitHistory(
                tenant_id=appointment.tenant_id,
                client_id=appointment.client_id,
                staff_id=appointment.staff_id,
                service_name=service.name if service else "Servicio",
                amount=appointment.price or 0,
                visit_date=appointment.date,
                status="completed",
                notes=f"Auto-registrada desde cita #{appointment.id}",
            )
            db.add(visit)
            db.commit()

    # ── Auto-create VisitHistory for no_show too (tracks attendance) ──
    if new_status == "no_show" and old_status != "no_show" and appointment.client_id:
        existing_visit = db.query(VisitHistory).filter(
            VisitHistory.client_id == appointment.client_id,
            VisitHistory.visit_date == appointment.date,
            VisitHistory.staff_id == appointment.staff_id,
            VisitHistory.status == "no_show",
        ).first()
        if not existing_visit:
            visit = VisitHistory(
                tenant_id=appointment.tenant_id,
                client_id=appointment.client_id,
                staff_id=appointment.staff_id,
                service_name=service.name if service else "Servicio",
                amount=0,
                visit_date=appointment.date,
                status="no_show",
                notes=f"No-show desde cita #{appointment.id}",
            )
            db.add(visit)
            db.commit()

    return AppointmentResponse(
        **{c.name: getattr(appointment, c.name) for c in appointment.__table__.columns},
        staff_name=staff.name if staff else None,
        service_name=service.name if service else None,
    )
