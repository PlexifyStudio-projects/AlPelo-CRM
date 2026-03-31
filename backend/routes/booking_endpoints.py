# ============================================================================
# Public Booking — Endpoints for public booking pages (NO auth required)
# URL pattern: /api/public/book/{slug}/...
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field
from typing import Optional
from collections import defaultdict

from database.connection import get_db
from database.models import (
    Tenant, Service, Staff, Appointment, Client,
    StaffSchedule, StaffDayOff, Location,
)

router = APIRouter(tags=["Public Booking"])


# ── Rate limiting (in-memory, simple) ────────────────────────────────────
_booking_requests: dict = {}  # {ip: [timestamp, ...]}
_RATE_LIMIT = 5  # max bookings per IP per hour


def _check_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=1)
    reqs = _booking_requests.get(ip, [])
    reqs = [t for t in reqs if t > cutoff]
    _booking_requests[ip] = reqs
    if len(reqs) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes. Intente de nuevo en una hora.")
    reqs.append(now)
    _booking_requests[ip] = reqs


# ── Helpers ──────────────────────────────────────────────────────────────

def _get_tenant_by_slug(slug: str, db: Session) -> Tenant:
    """Resolve tenant by slug, validate it's active and booking-enabled."""
    tenant = db.query(Tenant).filter(
        Tenant.slug == slug,
        Tenant.is_active == True,
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Negocio no encontrado")
    if not tenant.booking_enabled:
        raise HTTPException(status_code=403, detail="Este negocio no tiene reservas en linea habilitadas")
    return tenant


def _time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


# ============================================================================
# 1. GET /public/book/{slug} — Business info for rendering the booking page
# ============================================================================

@router.get("/public/book/{slug}")
def get_booking_page(slug: str, db: Session = Depends(get_db)):
    tenant = _get_tenant_by_slug(slug, db)

    # Services grouped by category
    services = db.query(Service).filter(
        Service.tenant_id == tenant.id,
        Service.is_active == True,
    ).order_by(Service.category, Service.name).all()

    categories = defaultdict(list)
    for s in services:
        categories[s.category or "General"].append({
            "id": s.id,
            "name": s.name,
            "price": s.price,
            "duration_minutes": s.duration_minutes or 30,
            "category": s.category or "General",
        })

    # Active staff
    staff = db.query(Staff).filter(
        Staff.tenant_id == tenant.id,
        Staff.is_active == True,
    ).all()

    staff_list = []
    for st in staff:
        # Get working days for display
        schedules = db.query(StaffSchedule).filter(
            StaffSchedule.staff_id == st.id,
            StaffSchedule.tenant_id == tenant.id,
            StaffSchedule.is_working == True,
        ).order_by(StaffSchedule.day_of_week).all()
        days_working = [sch.day_of_week for sch in schedules]

        staff_list.append({
            "id": st.id,
            "name": st.name,
            "specialty": st.specialty or st.role,
            "photo_url": getattr(st, "photo_url", None),
            "days_working": days_working,
        })

    # Business hours from Location or tenant
    location = db.query(Location).filter(
        Location.tenant_id == tenant.id,
        Location.is_active == True,
    ).first()

    business_hours = None
    if location:
        business_hours = {
            "address": location.address,
            "city": location.city,
            "phone": location.phone,
        }

    return {
        "business": {
            "name": tenant.name,
            "slug": tenant.slug,
            "tagline": tenant.booking_tagline,
            "description": tenant.booking_description,
            "logo_url": tenant.logo_url,
            "brand_color": tenant.brand_color,
            "brand_color_dark": tenant.brand_color_dark,
            "brand_color_accent": tenant.brand_color_accent,
            "gallery_images": tenant.gallery_images or [],
            "currency": getattr(tenant, "currency", "COP"),
            "timezone": getattr(tenant, "timezone", "America/Bogota"),
        },
        "location": business_hours,
        "services": dict(categories),
        "staff": staff_list,
    }


# ============================================================================
# 2. GET /public/book/{slug}/availability — Available time slots
# ============================================================================

@router.get("/public/book/{slug}/availability")
def get_availability(
    slug: str,
    date_str: str = Query(..., alias="date", description="YYYY-MM-DD"),
    staff_id: int = Query(..., description="Staff ID"),
    service_id: int = Query(..., description="Service ID (for duration)"),
    db: Session = Depends(get_db),
):
    tenant = _get_tenant_by_slug(slug, db)

    # Validate date
    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha invalido. Use YYYY-MM-DD")

    # Don't allow past dates
    today = date.today()
    if target_date < today:
        raise HTTPException(status_code=400, detail="No se puede agendar en fechas pasadas")

    # Max 60 days in the future
    if target_date > today + timedelta(days=60):
        raise HTTPException(status_code=400, detail="Solo se puede agendar hasta 60 dias en el futuro")

    # Validate staff belongs to this tenant
    staff = db.query(Staff).filter(
        Staff.id == staff_id,
        Staff.tenant_id == tenant.id,
        Staff.is_active == True,
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    # Get service duration
    service = db.query(Service).filter(
        Service.id == service_id,
        Service.tenant_id == tenant.id,
        Service.is_active == True,
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    duration = service.duration_minutes or 30
    day_of_week = target_date.weekday()

    # Check schedule
    schedule = db.query(StaffSchedule).filter(
        StaffSchedule.staff_id == staff_id,
        StaffSchedule.tenant_id == tenant.id,
        StaffSchedule.day_of_week == day_of_week,
    ).first()

    if not schedule or not schedule.is_working:
        return {
            "staff_id": staff_id,
            "staff_name": staff.name,
            "date": target_date.isoformat(),
            "is_available": False,
            "reason": "No trabaja este dia",
            "slots": [],
        }

    # Check day off
    is_day_off = db.query(StaffDayOff).filter(
        StaffDayOff.staff_id == staff_id,
        StaffDayOff.tenant_id == tenant.id,
        StaffDayOff.date == target_date,
    ).first()

    if is_day_off:
        return {
            "staff_id": staff_id,
            "staff_name": staff.name,
            "date": target_date.isoformat(),
            "is_available": False,
            "reason": "Dia libre",
            "slots": [],
        }

    # Get existing appointments
    appointments = db.query(Appointment).filter(
        Appointment.staff_id == staff_id,
        Appointment.tenant_id == tenant.id,
        Appointment.date == target_date,
        Appointment.status.in_(["confirmed", "completed"]),
    ).all()

    # Calculate free slots using service duration
    slots = _calculate_slots(schedule, appointments, duration)

    return {
        "staff_id": staff_id,
        "staff_name": staff.name,
        "date": target_date.isoformat(),
        "is_available": len(slots) > 0,
        "slots": slots,
        "working_hours": {
            "start": schedule.start_time,
            "end": schedule.end_time,
        },
    }


def _calculate_slots(schedule, appointments, slot_duration: int = 30) -> list:
    """Calculate free time slots given a schedule and existing appointments."""
    if not schedule or not schedule.is_working or not schedule.start_time or not schedule.end_time:
        return []

    work_start = _time_to_minutes(schedule.start_time)
    work_end = _time_to_minutes(schedule.end_time)

    busy = []
    if schedule.break_start and schedule.break_end:
        busy.append((_time_to_minutes(schedule.break_start), _time_to_minutes(schedule.break_end)))

    for appt in appointments:
        try:
            appt_start = _time_to_minutes(appt.time)
            appt_end = appt_start + (appt.duration_minutes or 30)
            busy.append((appt_start, appt_end))
        except Exception:
            continue

    busy.sort()

    slots = []
    current = work_start
    while current + slot_duration <= work_end:
        slot_end = current + slot_duration
        is_free = all(not (current < b_end and slot_end > b_start) for b_start, b_end in busy)
        if is_free:
            slots.append(_minutes_to_time(current))
        current += 15  # 15-min increments for flexibility
    return slots


# ============================================================================
# 3. POST /public/book/{slug}/appointment — Create a booking
# ============================================================================

class BookingRequest(BaseModel):
    service_id: int
    staff_id: int
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    client_name: str = Field(..., min_length=2, max_length=200)
    client_phone: str = Field(..., min_length=7, max_length=20)
    client_email: Optional[str] = None
    notes: Optional[str] = None


@router.post("/public/book/{slug}/appointment")
def create_booking(slug: str, data: BookingRequest, request: Request, db: Session = Depends(get_db)):
    _check_rate_limit(request)
    tenant = _get_tenant_by_slug(slug, db)

    # Validate service
    service = db.query(Service).filter(
        Service.id == data.service_id,
        Service.tenant_id == tenant.id,
        Service.is_active == True,
    ).first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    # Validate staff
    staff = db.query(Staff).filter(
        Staff.id == data.staff_id,
        Staff.tenant_id == tenant.id,
        Staff.is_active == True,
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    # Validate date
    try:
        apt_date = date.fromisoformat(data.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Fecha invalida")

    today = date.today()
    if apt_date < today:
        raise HTTPException(status_code=400, detail="No se puede agendar en fechas pasadas")

    duration = service.duration_minutes or 30
    req_hour, req_min = int(data.time.split(":")[0]), int(data.time.split(":")[1])
    req_start = req_hour * 60 + req_min
    req_end = req_start + duration

    # ── CONFLICT CHECK: Staff ──
    existing = db.query(Appointment).filter(
        Appointment.staff_id == staff.id,
        Appointment.tenant_id == tenant.id,
        Appointment.date == apt_date,
        Appointment.status.in_(["confirmed", "completed"]),
    ).all()

    for ea in existing:
        try:
            eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
            ea_start = eh * 60 + em
            ea_end = ea_start + (ea.duration_minutes or 30)
            if req_start < ea_end and req_end > ea_start:
                raise HTTPException(
                    status_code=409,
                    detail="Lo sentimos, ese horario ya no esta disponible. Por favor seleccione otro."
                )
        except HTTPException:
            raise
        except Exception:
            continue

    # ── Find or create client ──
    phone_clean = data.client_phone.strip().replace(" ", "").replace("-", "")
    client = db.query(Client).filter(
        Client.phone == phone_clean,
        Client.tenant_id == tenant.id,
    ).first()

    if not client:
        client = Client(
            name=data.client_name.strip(),
            phone=phone_clean,
            email=data.client_email,
            tenant_id=tenant.id,
            is_active=True,
            status="active",
        )
        db.add(client)
        db.flush()

    # ── Create appointment ──
    appointment = Appointment(
        tenant_id=tenant.id,
        client_id=client.id,
        client_name=data.client_name.strip(),
        client_phone=phone_clean,
        staff_id=staff.id,
        service_id=service.id,
        date=apt_date,
        time=data.time,
        duration_minutes=duration,
        price=service.price,
        status="confirmed",
        notes=data.notes,
        created_by="online_booking",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    return {
        "success": True,
        "appointment": {
            "id": appointment.id,
            "service": service.name,
            "staff": staff.name,
            "date": data.date,
            "time": data.time,
            "duration_minutes": duration,
            "price": service.price,
            "client_name": data.client_name,
        },
        "message": "Cita agendada exitosamente. Te esperamos!",
    }
