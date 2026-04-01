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
import re

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
            "description": s.description,
            "staff_ids": s.staff_ids or [],
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
            "rating": st.rating,
            "bio": getattr(st, "bio", None),
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

    loc_address = location.address if location else None
    loc_phone = location.phone if location else None

    return {
        "business": {
            "name": tenant.name,
            "slug": tenant.slug,
            "tagline": getattr(tenant, 'booking_tagline', None),
            "description": getattr(tenant, 'booking_description', None),
            "logo_url": tenant.logo_url,
            "cover_url": getattr(tenant, 'booking_cover_url', None),
            "brand_color": tenant.brand_color,
            "brand_color_dark": tenant.brand_color_dark,
            "brand_color_accent": tenant.brand_color_accent,
            "gallery_images": getattr(tenant, 'gallery_images', []) or [],
            "currency": getattr(tenant, "currency", "COP"),
            "timezone": getattr(tenant, "timezone", "America/Bogota"),
            "phone": getattr(tenant, 'booking_phone', None) or loc_phone,
            "whatsapp": getattr(tenant, 'booking_whatsapp', None),
            "instagram": getattr(tenant, 'booking_instagram', None),
            "facebook": getattr(tenant, 'booking_facebook', None),
            "tags": getattr(tenant, 'booking_tags', []) or [],
            "address": getattr(tenant, 'address', None) or loc_address,
            "city": getattr(tenant, 'city', None),
        },
        "location": business_hours,
        "services": dict(categories),
        "staff": staff_list,
        "schedule": getattr(tenant, 'booking_schedule', []) or [],
        "reviews": {
            "rating": getattr(tenant, 'booking_google_rating', None),
            "total_reviews": getattr(tenant, 'booking_google_total_reviews', None),
            "items": getattr(tenant, 'booking_google_reviews', []) or [],
        },
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

    # Check staff-specific schedule
    schedule = db.query(StaffSchedule).filter(
        StaffSchedule.staff_id == staff_id,
        StaffSchedule.tenant_id == tenant.id,
        StaffSchedule.day_of_week == day_of_week,
    ).first()

    has_staff_schedule = schedule and schedule.is_working and schedule.start_time and schedule.end_time

    # Fallback to business hours if no staff schedule
    if not has_staff_schedule:
        DAYS_MAP = {'Lunes': 0, 'Martes': 1, 'Miercoles': 2, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sabado': 5, 'Sábado': 5, 'Domingo': 6}
        biz_schedule = getattr(tenant, 'booking_schedule', []) or []
        fallback = None
        for entry in biz_schedule:
            if DAYS_MAP.get(entry.get('day', '')) == day_of_week and entry.get('hours'):
                m = re.match(r'(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)', entry['hours'], re.IGNORECASE)
                if m:
                    sh = int(m.group(1)) % 12 + (12 if m.group(3).upper() == 'PM' else 0)
                    sm = int(m.group(2))
                    eh = int(m.group(4)) % 12 + (12 if m.group(6).upper() == 'PM' else 0)
                    em = int(m.group(5))
                    fallback = (f"{sh:02d}:{sm:02d}", f"{eh:02d}:{em:02d}")
                break
        if not fallback:
            return {"staff_id": staff_id, "staff_name": staff.name, "date": target_date.isoformat(), "is_available": False, "reason": "No trabaja este dia", "slots": []}
        # Create fake schedule for slot calculation
        class _FallbackSched:
            is_working = True
            break_start = None
            break_end = None
        schedule = _FallbackSched()
        schedule.start_time, schedule.end_time = fallback

    # Check day off
    is_day_off = db.query(StaffDayOff).filter(
        StaffDayOff.staff_id == staff_id,
        StaffDayOff.tenant_id == tenant.id,
        StaffDayOff.date == target_date,
    ).first()

    if is_day_off:
        return {"staff_id": staff_id, "staff_name": staff.name, "date": target_date.isoformat(), "is_available": False, "reason": "Dia libre", "slots": []}

    # Get existing appointments
    appointments = db.query(Appointment).filter(
        Appointment.staff_id == staff_id,
        Appointment.tenant_id == tenant.id,
        Appointment.date == target_date,
        Appointment.status.in_(["confirmed", "completed"]),
    ).all()

    # Calculate free slots using service duration
    slots = _calculate_slots(schedule, appointments, duration)

    # Build busy blocks (no client info) for visual timeline
    busy_blocks = []
    for appt in appointments:
        try:
            busy_blocks.append({
                "start": appt.time,
                "end": _minutes_to_time(_time_to_minutes(appt.time) + (appt.duration_minutes or 30)),
                "label": "Ocupado",
            })
        except Exception:
            continue

    return {
        "staff_id": staff_id,
        "staff_name": staff.name,
        "date": target_date.isoformat(),
        "is_available": len(slots) > 0,
        "slots": slots,
        "busy": busy_blocks,
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

    # ── CONFLICT CHECK: Client already has appointment at this time ──
    if client:
        client_appts = db.query(Appointment).filter(
            Appointment.client_id == client.id,
            Appointment.tenant_id == tenant.id,
            Appointment.date == apt_date,
            Appointment.status.in_(["confirmed", "completed"]),
        ).all()
        for ca in client_appts:
            try:
                ch, cm = int(ca.time.split(":")[0]), int(ca.time.split(":")[1])
                ca_start = ch * 60 + cm
                ca_end = ca_start + (ca.duration_minutes or 30)
                if req_start < ca_end and req_end > ca_start:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Ya tienes una cita agendada a las {ca.time} ese día. Por favor elige otro horario."
                    )
            except HTTPException:
                raise
            except Exception:
                continue

    if not client:
        # Generate unique client_id (M + tenant_id + sequential)
        last_client = db.query(Client).filter(Client.tenant_id == tenant.id).order_by(Client.id.desc()).first()
        seq = (last_client.id + 1) if last_client else 1
        new_client_id = f"M{tenant.id}{seq:04d}"
        client = Client(
            client_id=new_client_id,
            name=data.client_name.strip(),
            phone=phone_clean,
            email=data.client_email,
            tenant_id=tenant.id,
            is_active=True,
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


# ============================================================================
# 4. GET /public/book/{slug}/weekly — Weekly schedule for a staff member
# ============================================================================

@router.get("/public/book/{slug}/weekly")
def get_weekly_schedule(
    slug: str,
    staff_id: int = Query(...),
    service_id: int = Query(...),
    week_start: str = Query(..., description="YYYY-MM-DD, Monday of the week"),
    db: Session = Depends(get_db),
):
    """Return a full weekly view: working hours, busy blocks (no client info), free slots."""
    tenant = _get_tenant_by_slug(slug, db)

    staff = db.query(Staff).filter(Staff.id == staff_id, Staff.tenant_id == tenant.id, Staff.is_active == True).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    service = db.query(Service).filter(Service.id == service_id, Service.tenant_id == tenant.id, Service.is_active == True).first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    try:
        start_date = date.fromisoformat(week_start)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")

    duration = service.duration_minutes or 30
    today = date.today()
    days = []

    # Parse business schedule as fallback (booking_schedule is list of {day, hours})
    biz_hours = {}
    biz_schedule = getattr(tenant, 'booking_schedule', []) or []
    DAYS_MAP = {'Lunes': 0, 'Martes': 1, 'Miercoles': 2, 'Miércoles': 2, 'Jueves': 3, 'Viernes': 4, 'Sabado': 5, 'Sábado': 5, 'Domingo': 6}
    for entry in biz_schedule:
        day_name = entry.get('day', '')
        hours_str = entry.get('hours', '')
        dow = DAYS_MAP.get(day_name)
        if dow is not None and hours_str:
            # Parse "7:30AM - 8:00PM" format
            m = re.match(r'(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)', hours_str, re.IGNORECASE)
            if m:
                sh = int(m.group(1)) % 12 + (12 if m.group(3).upper() == 'PM' else 0)
                sm = int(m.group(2))
                eh = int(m.group(4)) % 12 + (12 if m.group(6).upper() == 'PM' else 0)
                em = int(m.group(5))
                biz_hours[dow] = (f"{sh:02d}:{sm:02d}", f"{eh:02d}:{em:02d}")

    for i in range(7):
        day_date = start_date + timedelta(days=i)
        day_str = day_date.isoformat()
        day_of_week = day_date.weekday()  # 0=Monday

        # Skip past dates
        if day_date < today:
            days.append({"date": day_str, "working": False, "slots": [], "busy": [], "hours": None})
            continue

        # Get staff-specific schedule
        schedule = db.query(StaffSchedule).filter(
            StaffSchedule.staff_id == staff_id,
            StaffSchedule.tenant_id == tenant.id,
            StaffSchedule.day_of_week == day_of_week,
        ).first()

        # Check day off
        is_day_off = db.query(StaffDayOff).filter(
            StaffDayOff.staff_id == staff_id,
            StaffDayOff.tenant_id == tenant.id,
            StaffDayOff.date == day_date,
        ).first()

        # If no staff schedule, use business hours as fallback
        has_schedule = schedule and schedule.is_working and schedule.start_time and schedule.end_time
        fallback_hours = biz_hours.get(day_of_week)

        if is_day_off or (not has_schedule and not fallback_hours):
            days.append({"date": day_str, "working": False, "slots": [], "busy": [], "hours": None})
            continue

        # Determine working hours (staff schedule or business fallback)
        if has_schedule:
            work_start = schedule.start_time
            work_end = schedule.end_time
            break_info = {"start": schedule.break_start, "end": schedule.break_end} if schedule.break_start else None
        else:
            work_start, work_end = fallback_hours
            break_info = None

        # Get appointments for this day (for this specific staff)
        appointments = db.query(Appointment).filter(
            Appointment.staff_id == staff_id,
            Appointment.tenant_id == tenant.id,
            Appointment.date == day_date,
            Appointment.status.in_(["confirmed", "completed"]),
        ).order_by(Appointment.time).all()

        # Build busy blocks (NO client info — privacy)
        busy = []
        for appt in appointments:
            try:
                start_min = _time_to_minutes(appt.time)
                end_min = start_min + (appt.duration_minutes or 30)
                busy.append({
                    "start": appt.time,
                    "end": _minutes_to_time(end_min),
                    "duration": appt.duration_minutes or 30,
                })
            except Exception:
                continue

        # Calculate free slots — use a fake schedule object if using fallback
        if has_schedule:
            slots = _calculate_slots(schedule, appointments, duration)
        else:
            # Create a simple schedule-like object for _calculate_slots
            class FakeSchedule:
                is_working = True
                break_start = None
                break_end = None
            fake = FakeSchedule()
            fake.start_time = work_start
            fake.end_time = work_end
            slots = _calculate_slots(fake, appointments, duration)

        days.append({
            "date": day_str,
            "working": True,
            "hours": {"start": work_start, "end": work_end},
            "break": break_info,
            "busy": busy,
            "slots": slots,
        })

    return {
        "staff_id": staff_id,
        "staff_name": staff.name,
        "service_duration": duration,
        "days": days,
    }
