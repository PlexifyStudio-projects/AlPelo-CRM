"""Walk-in Queue — Round-robin staff assignment for walk-in clients."""
from datetime import datetime, date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.connection import get_db
from database.models import (
    StaffQueue, Staff, Appointment, Service, Client,
    StaffSchedule, StaffDayOff, Admin,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid, now_colombia

router = APIRouter(prefix="/walkin", tags=["Walk-in Queue"])


def _tid(user, db):
    return safe_tid(user, db)


def _ensure_queue(db, tid):
    """Initialize queue if empty — add all active staff in order."""
    existing = db.query(StaffQueue).filter(StaffQueue.tenant_id == tid).count()
    if existing > 0:
        return
    staff = db.query(Staff).filter(Staff.tenant_id == tid, Staff.is_active == True).order_by(Staff.id).all()
    for i, s in enumerate(staff):
        db.add(StaffQueue(tenant_id=tid, staff_id=s.id, position=i + 1))
    db.commit()


def _is_staff_working_now(db, staff_id, tid):
    """Check if staff is working today and not on day off."""
    today = now_colombia().date()
    weekday = today.weekday()  # 0=Monday

    # Check day off
    day_off = db.query(StaffDayOff).filter(
        StaffDayOff.staff_id == staff_id,
        StaffDayOff.date == today,
    ).first()
    if day_off:
        return False

    # Check schedule
    schedule = db.query(StaffSchedule).filter(
        StaffSchedule.staff_id == staff_id,
        StaffSchedule.day_of_week == weekday,
    ).first()
    if schedule and not schedule.is_working:
        return False

    return True


def _find_next_slot(db, staff_id, service_duration, tid):
    """Find the next available time slot for a staff member today."""
    today = now_colombia().date()
    now_time = now_colombia().time()

    # Get today's appointments for this staff
    appointments = db.query(Appointment).filter(
        Appointment.staff_id == staff_id,
        Appointment.date == today,
        Appointment.status.in_(["confirmed", "waiting", "completed"]),
    )
    if tid:
        appointments = appointments.filter(Appointment.tenant_id == tid)
    appointments = appointments.order_by(Appointment.time).all()

    # Get staff schedule
    weekday = today.weekday()
    schedule = db.query(StaffSchedule).filter(
        StaffSchedule.staff_id == staff_id,
        StaffSchedule.day_of_week == weekday,
    ).first()

    work_start = schedule.start_time if schedule else "08:00"
    work_end = schedule.end_time if schedule else "20:00"
    break_start = schedule.break_start if schedule else None
    break_end = schedule.break_end if schedule else None

    # Build busy blocks
    busy = []
    for a in appointments:
        h, m = map(int, a.time.split(":"))
        start_min = h * 60 + m
        end_min = start_min + (a.duration_minutes or 30)
        busy.append((start_min, end_min))

    if break_start and break_end:
        bh1, bm1 = map(int, break_start.split(":"))
        bh2, bm2 = map(int, break_end.split(":"))
        busy.append((bh1 * 60 + bm1, bh2 * 60 + bm2))

    busy.sort()

    # Find first available slot from now
    wh, wm = map(int, work_start.split(":"))
    eh, em = map(int, work_end.split(":"))
    work_start_min = wh * 60 + wm
    work_end_min = eh * 60 + em
    now_min = now_time.hour * 60 + now_time.minute

    # Start from current time (rounded up to next 15 min)
    search_start = max(work_start_min, now_min)
    search_start = ((search_start + 14) // 15) * 15  # Round up to 15 min

    slot = search_start
    while slot + service_duration <= work_end_min:
        # Check if slot overlaps with any busy block
        slot_end = slot + service_duration
        is_free = True
        for bs, be in busy:
            if slot < be and slot_end > bs:
                is_free = False
                slot = ((be + 14) // 15) * 15  # Jump past busy block
                break
        if is_free:
            h = slot // 60
            m = slot % 60
            wait_min = max(0, slot - now_min)
            return f"{h:02d}:{m:02d}", wait_min
        # slot already advanced past busy block in the loop

    return None, None  # No slot available today


# ============================================================================
# GET QUEUE — Staff rotation order
# ============================================================================

@router.get("/queue")
def get_queue(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = _tid(user, db)
    _ensure_queue(db, tid)

    queue = db.query(StaffQueue).filter(
        StaffQueue.tenant_id == tid
    ).order_by(StaffQueue.position).all()

    result = []
    now = now_colombia()
    today = now.date()

    for q in queue:
        staff = db.query(Staff).filter(Staff.id == q.staff_id).first()
        if not staff or not staff.is_active:
            continue

        # Check if currently busy (has appointment right now)
        current_apt = db.query(Appointment).filter(
            Appointment.staff_id == q.staff_id,
            Appointment.date == today,
            Appointment.status.in_(["confirmed", "waiting"]),
        )
        if tid:
            current_apt = current_apt.filter(Appointment.tenant_id == tid)
        current_apt = current_apt.all()

        is_busy = False
        current_service = None
        for a in current_apt:
            h, m = map(int, a.time.split(":"))
            start = h * 60 + m
            end = start + (a.duration_minutes or 30)
            now_min = now.hour * 60 + now.minute
            if start <= now_min < end:
                is_busy = True
                current_service = a.notes or "Atendiendo"
                break

        is_working = _is_staff_working_now(db, q.staff_id, tid)

        result.append({
            "id": q.id,
            "staff_id": q.staff_id,
            "staff_name": staff.name,
            "staff_role": staff.role or "",
            "photo_url": getattr(staff, "photo_url", None),
            "position": q.position,
            "is_available": q.is_available and is_working and not is_busy,
            "is_working": is_working,
            "is_busy": is_busy,
            "current_service": current_service,
            "walkins_today": q.walkins_today or 0,
            "last_walkin_at": q.last_walkin_at.isoformat() if q.last_walkin_at else None,
        })

    return result


# ============================================================================
# REORDER QUEUE — Drag-drop reorder
# ============================================================================

@router.put("/queue/reorder")
def reorder_queue(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Reorder queue. Expects { staff_ids: [5, 3, 1, 2, 4] }."""
    tid = _tid(user, db)
    staff_ids = data.get("staff_ids", [])
    if not staff_ids:
        raise HTTPException(status_code=400, detail="staff_ids required")

    for i, sid in enumerate(staff_ids):
        q = db.query(StaffQueue).filter(
            StaffQueue.tenant_id == tid,
            StaffQueue.staff_id == sid,
        ).first()
        if q:
            q.position = i + 1
            q.updated_at = datetime.utcnow()

    db.commit()
    return {"success": True, "order": staff_ids}


# ============================================================================
# CHECK-IN — Register a walk-in client
# ============================================================================

@router.post("/checkin")
def walkin_checkin(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Register a walk-in. Assigns staff via round-robin and finds next slot."""
    tid = _tid(user, db)
    _ensure_queue(db, tid)

    client_name = data.get("client_name", "").strip()
    client_phone = data.get("client_phone", "").strip()
    service_id = data.get("service_id")
    preferred_staff_id = data.get("staff_id")  # Optional: specific staff

    if not client_name:
        raise HTTPException(status_code=400, detail="Nombre del cliente requerido")
    if not service_id:
        raise HTTPException(status_code=400, detail="Servicio requerido")

    # Get service info
    service = db.query(Service).filter(Service.id == service_id)
    if tid:
        service = service.filter(Service.tenant_id == tid)
    service = service.first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    duration = service.duration or 30
    price = service.price or 0

    # Find or create client
    client_id = None
    if client_phone:
        client = db.query(Client).filter(Client.phone == client_phone)
        if tid:
            client = client.filter(Client.tenant_id == tid)
        client = client.first()
        if client:
            client_id = client.id

    # Assign staff
    assigned_staff_id = None
    assigned_time = None
    wait_minutes = None

    if preferred_staff_id:
        # Use preferred staff
        slot_time, wait = _find_next_slot(db, preferred_staff_id, duration, tid)
        if slot_time:
            assigned_staff_id = preferred_staff_id
            assigned_time = slot_time
            wait_minutes = wait
    else:
        # Round-robin: find first available in queue order
        queue = db.query(StaffQueue).filter(
            StaffQueue.tenant_id == tid,
            StaffQueue.is_available == True,
        ).order_by(StaffQueue.position).all()

        for q in queue:
            if not _is_staff_working_now(db, q.staff_id, tid):
                continue
            slot_time, wait = _find_next_slot(db, q.staff_id, duration, tid)
            if slot_time:
                assigned_staff_id = q.staff_id
                assigned_time = slot_time
                wait_minutes = wait
                break

    if not assigned_staff_id or not assigned_time:
        raise HTTPException(status_code=409, detail="No hay profesionales disponibles en este momento")

    # Get staff info
    staff = db.query(Staff).filter(Staff.id == assigned_staff_id).first()

    # Create appointment as walk-in
    appointment = Appointment(
        tenant_id=tid,
        client_id=client_id,
        client_name=client_name,
        client_phone=client_phone or "",
        staff_id=assigned_staff_id,
        service_id=service_id,
        date=now_colombia().date(),
        time=assigned_time,
        duration_minutes=duration,
        price=price,
        status="waiting",
        created_by="walkin",
        notes=f"[WALKIN] Cola de espera",
    )
    db.add(appointment)

    # Rotate queue: move assigned staff to last position
    queue_all = db.query(StaffQueue).filter(
        StaffQueue.tenant_id == tid
    ).order_by(StaffQueue.position).all()

    max_pos = max(q.position for q in queue_all) if queue_all else 0
    for q in queue_all:
        if q.staff_id == assigned_staff_id:
            q.position = max_pos + 1
            q.walkins_today = (q.walkins_today or 0) + 1
            q.last_walkin_at = datetime.utcnow()
            break

    # Re-normalize positions (1, 2, 3, ...)
    queue_sorted = sorted(queue_all, key=lambda q: q.position)
    for i, q in enumerate(queue_sorted):
        q.position = i + 1

    db.commit()
    db.refresh(appointment)

    return {
        "success": True,
        "appointment_id": appointment.id,
        "staff_name": staff.name if staff else "?",
        "staff_id": assigned_staff_id,
        "time": assigned_time,
        "wait_minutes": wait_minutes,
        "service_name": service.name,
        "client_name": client_name,
        "message": f"{staff.name} lo atendera a las {assigned_time} (~{wait_minutes} min de espera)" if staff else "",
    }


# ============================================================================
# START — Staff begins attending the walk-in
# ============================================================================

@router.put("/{appointment_id}/start")
def walkin_start(appointment_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = _tid(user, db)
    apt = db.query(Appointment).filter(Appointment.id == appointment_id)
    if tid:
        apt = apt.filter(Appointment.tenant_id == tid)
    apt = apt.first()
    if not apt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")
    if apt.status != "waiting":
        raise HTTPException(status_code=400, detail="Esta cita no esta en espera")

    apt.status = "confirmed"
    apt.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "status": "confirmed"}


# ============================================================================
# CANCEL — Walk-in left
# ============================================================================

@router.put("/{appointment_id}/cancel")
def walkin_cancel(appointment_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = _tid(user, db)
    apt = db.query(Appointment).filter(Appointment.id == appointment_id)
    if tid:
        apt = apt.filter(Appointment.tenant_id == tid)
    apt = apt.first()
    if not apt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    apt.status = "cancelled"
    apt.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "status": "cancelled"}


# ============================================================================
# WAITING LIST — Current walk-ins waiting
# ============================================================================

@router.get("/waiting")
def get_waiting(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = _tid(user, db)
    today = now_colombia().date()

    waiting = db.query(Appointment).filter(
        Appointment.date == today,
        Appointment.status == "waiting",
        Appointment.created_by == "walkin",
    )
    if tid:
        waiting = waiting.filter(Appointment.tenant_id == tid)
    waiting = waiting.order_by(Appointment.created_at).all()

    now_min = now_colombia().hour * 60 + now_colombia().minute
    result = []
    for a in waiting:
        staff = db.query(Staff).filter(Staff.id == a.staff_id).first()
        h, m = map(int, a.time.split(":"))
        apt_min = h * 60 + m
        wait = max(0, apt_min - now_min)

        result.append({
            "id": a.id,
            "client_name": a.client_name,
            "client_phone": a.client_phone,
            "service_name": db.query(Service).filter(Service.id == a.service_id).first().name if a.service_id else "?",
            "staff_name": staff.name if staff else "?",
            "staff_id": a.staff_id,
            "time": a.time,
            "wait_minutes": wait,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return result


# ============================================================================
# TOGGLE STAFF AVAILABILITY
# ============================================================================

@router.put("/queue/toggle/{staff_id}")
def toggle_availability(staff_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = _tid(user, db)
    q = db.query(StaffQueue).filter(StaffQueue.tenant_id == tid, StaffQueue.staff_id == staff_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Staff not in queue")
    q.is_available = not q.is_available
    q.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "is_available": q.is_available}
