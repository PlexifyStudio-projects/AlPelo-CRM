"""Staff Schedule & Availability endpoints.
Manage weekly schedules, days off, and calculate available time slots."""

from datetime import date, datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from database.connection import get_db
from database.models import Staff, StaffSchedule, StaffDayOff, Appointment
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter()


# ============================================================================
# DEFAULT SCHEDULE — 7-day template
# ============================================================================

DEFAULT_SCHEDULE = {
    0: {"start_time": "08:00", "end_time": "18:00", "break_start": "12:00", "break_end": "13:00", "is_working": True},   # Monday
    1: {"start_time": "08:00", "end_time": "18:00", "break_start": "12:00", "break_end": "13:00", "is_working": True},   # Tuesday
    2: {"start_time": "08:00", "end_time": "18:00", "break_start": "12:00", "break_end": "13:00", "is_working": True},   # Wednesday
    3: {"start_time": "08:00", "end_time": "18:00", "break_start": "12:00", "break_end": "13:00", "is_working": True},   # Thursday
    4: {"start_time": "08:00", "end_time": "18:00", "break_start": "12:00", "break_end": "13:00", "is_working": True},   # Friday
    5: {"start_time": "09:00", "end_time": "15:00", "break_start": None, "break_end": None, "is_working": True},          # Saturday
    6: {"start_time": None, "end_time": None, "break_start": None, "break_end": None, "is_working": False},               # Sunday
}


def _ensure_weekly_schedule(db: Session, staff_id: int, tenant_id: int) -> list:
    """Ensure all 7 days exist for a staff member, creating defaults if missing."""
    existing = db.query(StaffSchedule).filter(
        StaffSchedule.staff_id == staff_id,
        StaffSchedule.tenant_id == tenant_id,
    ).all()

    existing_days = {s.day_of_week: s for s in existing}
    created = False

    for day in range(7):
        if day not in existing_days:
            defaults = DEFAULT_SCHEDULE[day]
            schedule = StaffSchedule(
                tenant_id=tenant_id,
                staff_id=staff_id,
                day_of_week=day,
                **defaults,
            )
            db.add(schedule)
            created = True

    if created:
        db.commit()

    # Re-fetch all 7 sorted
    return db.query(StaffSchedule).filter(
        StaffSchedule.staff_id == staff_id,
        StaffSchedule.tenant_id == tenant_id,
    ).order_by(StaffSchedule.day_of_week).all()


def _schedule_to_dict(s: StaffSchedule) -> dict:
    return {
        "id": s.id,
        "day_of_week": s.day_of_week,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "break_start": s.break_start,
        "break_end": s.break_end,
        "is_working": s.is_working,
    }


# ============================================================================
# GET /staff/{staff_id}/schedule — Weekly schedule (7 days)
# ============================================================================

@router.get("/staff/{staff_id}/schedule")
def get_staff_schedule(
    staff_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tid = safe_tid(user, db)

    staff = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        staff = staff.filter(Staff.tenant_id == tid)
    staff = staff.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff no encontrado")

    schedules = _ensure_weekly_schedule(db, staff_id, staff.tenant_id)

    return {
        "staff_id": staff_id,
        "staff_name": staff.name,
        "schedule": [_schedule_to_dict(s) for s in schedules],
    }


# ============================================================================
# PUT /staff/{staff_id}/schedule — Bulk update weekly schedule
# ============================================================================

@router.put("/staff/{staff_id}/schedule")
def update_staff_schedule(
    staff_id: int,
    data: list,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tid = safe_tid(user, db)

    staff = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        staff = staff.filter(Staff.tenant_id == tid)
    staff = staff.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff no encontrado")

    tenant_id = staff.tenant_id

    for day_data in data:
        day_of_week = day_data.get("day_of_week")
        if day_of_week is None or day_of_week not in range(7):
            raise HTTPException(status_code=400, detail=f"day_of_week invalido: {day_of_week}")

        existing = db.query(StaffSchedule).filter(
            StaffSchedule.staff_id == staff_id,
            StaffSchedule.tenant_id == tenant_id,
            StaffSchedule.day_of_week == day_of_week,
        ).first()

        if existing:
            existing.start_time = day_data.get("start_time", existing.start_time)
            existing.end_time = day_data.get("end_time", existing.end_time)
            existing.break_start = day_data.get("break_start", existing.break_start)
            existing.break_end = day_data.get("break_end", existing.break_end)
            existing.is_working = day_data.get("is_working", existing.is_working)
            existing.updated_at = datetime.utcnow()
        else:
            schedule = StaffSchedule(
                tenant_id=tenant_id,
                staff_id=staff_id,
                day_of_week=day_of_week,
                start_time=day_data.get("start_time"),
                end_time=day_data.get("end_time"),
                break_start=day_data.get("break_start"),
                break_end=day_data.get("break_end"),
                is_working=day_data.get("is_working", True),
            )
            db.add(schedule)

    db.commit()

    # Return updated schedule
    schedules = _ensure_weekly_schedule(db, staff_id, tenant_id)
    return {
        "staff_id": staff_id,
        "staff_name": staff.name,
        "schedule": [_schedule_to_dict(s) for s in schedules],
    }


# ============================================================================
# GET /staff/{staff_id}/days-off — List days off
# ============================================================================

@router.get("/staff/{staff_id}/days-off")
def get_staff_days_off(
    staff_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tid = safe_tid(user, db)

    staff = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        staff = staff.filter(Staff.tenant_id == tid)
    staff = staff.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff no encontrado")

    days_off = db.query(StaffDayOff).filter(
        StaffDayOff.staff_id == staff_id,
        StaffDayOff.tenant_id == staff.tenant_id,
    ).order_by(StaffDayOff.date).all()

    return [
        {
            "id": d.id,
            "date": d.date.isoformat(),
            "reason": d.reason,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in days_off
    ]


# ============================================================================
# POST /staff/{staff_id}/days-off — Add a day off
# ============================================================================

@router.post("/staff/{staff_id}/days-off")
def add_staff_day_off(
    staff_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tid = safe_tid(user, db)

    staff = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        staff = staff.filter(Staff.tenant_id == tid)
    staff = staff.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff no encontrado")

    date_str = data.get("date")
    if not date_str:
        raise HTTPException(status_code=400, detail="El campo 'date' es obligatorio")

    try:
        day_off_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usar YYYY-MM-DD")

    # Check if already exists
    existing = db.query(StaffDayOff).filter(
        StaffDayOff.staff_id == staff_id,
        StaffDayOff.tenant_id == staff.tenant_id,
        StaffDayOff.date == day_off_date,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"{staff.name} ya tiene el dia {date_str} registrado como dia libre")

    day_off = StaffDayOff(
        tenant_id=staff.tenant_id,
        staff_id=staff_id,
        date=day_off_date,
        reason=data.get("reason"),
    )
    db.add(day_off)
    db.commit()
    db.refresh(day_off)

    return {
        "id": day_off.id,
        "staff_id": staff_id,
        "date": day_off.date.isoformat(),
        "reason": day_off.reason,
        "message": f"Dia libre agregado para {staff.name} el {date_str}",
    }


# ============================================================================
# DELETE /staff/{staff_id}/days-off/{day_off_id} — Remove a day off
# ============================================================================

@router.delete("/staff/{staff_id}/days-off/{day_off_id}")
def remove_staff_day_off(
    staff_id: int,
    day_off_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tid = safe_tid(user, db)

    day_off = db.query(StaffDayOff).filter(
        StaffDayOff.id == day_off_id,
        StaffDayOff.staff_id == staff_id,
    )
    if tid:
        day_off = day_off.filter(StaffDayOff.tenant_id == tid)
    day_off = day_off.first()

    if not day_off:
        raise HTTPException(status_code=404, detail="Dia libre no encontrado")

    removed_date = day_off.date.isoformat()
    db.delete(day_off)
    db.commit()

    return {"success": True, "message": f"Dia libre {removed_date} eliminado"}


# ============================================================================
# GET /staff/availability — Check availability for a date
# ============================================================================

def _time_to_minutes(t: str) -> int:
    """Convert "HH:MM" to minutes since midnight."""
    h, m = int(t.split(":")[0]), int(t.split(":")[1])
    return h * 60 + m


def _minutes_to_time(minutes: int) -> str:
    """Convert minutes since midnight to "HH:MM"."""
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def _calculate_available_slots(
    schedule: StaffSchedule,
    appointments: list,
    slot_duration: int = 30,
) -> list:
    """Calculate free time slots given a schedule and existing appointments."""
    if not schedule or not schedule.is_working or not schedule.start_time or not schedule.end_time:
        return []

    work_start = _time_to_minutes(schedule.start_time)
    work_end = _time_to_minutes(schedule.end_time)

    # Build list of busy intervals (appointments + break)
    busy = []

    # Add break if defined
    if schedule.break_start and schedule.break_end:
        busy.append((_time_to_minutes(schedule.break_start), _time_to_minutes(schedule.break_end)))

    # Add existing appointments
    for appt in appointments:
        try:
            appt_start = _time_to_minutes(appt.time)
            appt_end = appt_start + (appt.duration_minutes or 30)
            busy.append((appt_start, appt_end))
        except Exception:
            continue

    # Sort busy intervals
    busy.sort()

    # Generate slots in increments
    slots = []
    current = work_start
    while current + slot_duration <= work_end:
        slot_end = current + slot_duration
        # Check if this slot overlaps any busy interval
        is_free = True
        for b_start, b_end in busy:
            if current < b_end and slot_end > b_start:
                is_free = False
                break
        if is_free:
            slots.append(_minutes_to_time(current))
        current += slot_duration

    return slots


@router.get("/staff/availability")
def check_staff_availability(
    date_str: str = Query(..., alias="date", description="Fecha en formato YYYY-MM-DD"),
    staff_id: Optional[int] = Query(None, description="ID del staff (opcional, si se omite revisa todos)"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tid = safe_tid(user, db)

    try:
        target_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usar YYYY-MM-DD")

    # Python weekday: 0=Monday ... 6=Sunday
    day_of_week = target_date.weekday()

    # Get staff members to check
    staff_query = db.query(Staff).filter(Staff.is_active == True)
    if tid:
        staff_query = staff_query.filter(Staff.tenant_id == tid)
    if staff_id:
        staff_query = staff_query.filter(Staff.id == staff_id)

    staff_members = staff_query.all()
    if not staff_members:
        raise HTTPException(status_code=404, detail="No se encontraron miembros del equipo")

    results = []

    for member in staff_members:
        # Get schedule for this day of week
        schedule = db.query(StaffSchedule).filter(
            StaffSchedule.staff_id == member.id,
            StaffSchedule.tenant_id == member.tenant_id,
            StaffSchedule.day_of_week == day_of_week,
        ).first()

        # Check if it's a day off
        is_day_off = db.query(StaffDayOff).filter(
            StaffDayOff.staff_id == member.id,
            StaffDayOff.tenant_id == member.tenant_id,
            StaffDayOff.date == target_date,
        ).first() is not None

        if is_day_off:
            results.append({
                "staff_id": member.id,
                "staff_name": member.name,
                "date": target_date.isoformat(),
                "is_available": False,
                "reason": "Dia libre",
                "available_slots": [],
                "working_hours": None,
            })
            continue

        if not schedule or not schedule.is_working:
            results.append({
                "staff_id": member.id,
                "staff_name": member.name,
                "date": target_date.isoformat(),
                "is_available": False,
                "reason": "No trabaja este dia",
                "available_slots": [],
                "working_hours": None,
            })
            continue

        # Get existing appointments for this staff on this date
        appointments = db.query(Appointment).filter(
            Appointment.staff_id == member.id,
            Appointment.date == target_date,
            Appointment.status.in_(["confirmed", "completed"]),
        ).all()
        if tid:
            appointments = db.query(Appointment).filter(
                Appointment.staff_id == member.id,
                Appointment.date == target_date,
                Appointment.status.in_(["confirmed", "completed"]),
                Appointment.tenant_id == tid,
            ).all()

        # Calculate available slots
        available_slots = _calculate_available_slots(schedule, appointments)

        results.append({
            "staff_id": member.id,
            "staff_name": member.name,
            "date": target_date.isoformat(),
            "is_available": len(available_slots) > 0,
            "available_slots": available_slots,
            "working_hours": {
                "start": schedule.start_time,
                "end": schedule.end_time,
                "break_start": schedule.break_start,
                "break_end": schedule.break_end,
            },
        })

    # If querying a single staff member, return the single object
    if staff_id and len(results) == 1:
        return results[0]

    return results


# ============================================================================
# GET /staff/{staff_id}/clients-attended — Unique clients served by this staff
# ============================================================================

@router.get("/staff/{staff_id}/clients-attended")
def get_staff_clients_attended(
    staff_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return unique clients this staff has served, with visit stats."""
    tid = safe_tid(user, db)
    from database.models import Client

    staff = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        staff = staff.filter(Staff.tenant_id == tid)
    staff = staff.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff no encontrado")

    try:
        # Get all completed appointments for this staff
        apt_q = db.query(Appointment).filter(
            Appointment.staff_id == staff_id,
            Appointment.status.in_(["completed", "paid"]),
        )
        if tid:
            apt_q = apt_q.filter(Appointment.tenant_id == tid)
        all_apts = apt_q.order_by(Appointment.date.desc()).all()

        # Group by client manually (avoids SQLAlchemy aggregation issues)
        client_map = {}
        total_revenue = 0
        for apt in all_apts:
            cid = apt.client_id or apt.client_name or "unknown"
            if cid not in client_map:
                client = db.query(Client).filter(Client.id == apt.client_id).first() if apt.client_id else None
                client_map[cid] = {
                    "id": apt.client_id or 0,
                    "clientId": client.client_id if client else "?",
                    "name": client.name if client else apt.client_name or "?",
                    "lastService": apt.service_name or "?",
                    "lastVisit": str(apt.date) if apt.date else None,
                    "totalVisits": 0,
                    "totalSpent": 0,
                }
            client_map[cid]["totalVisits"] += 1
            client_map[cid]["totalSpent"] += int(apt.price or 0)
            total_revenue += int(apt.price or 0)

        clients = sorted(client_map.values(), key=lambda c: c["totalVisits"], reverse=True)

        return {
            "staff_id": staff_id,
            "staff_name": staff.name,
            "clients": clients,
            "total_revenue": total_revenue,
            "total_clients": len(clients),
        }
    except Exception as e:
        return {"staff_id": staff_id, "staff_name": staff.name if staff else "?", "clients": [], "total_revenue": 0, "total_clients": 0, "error": str(e)}
