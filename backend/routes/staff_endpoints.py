"""Staff-facing endpoints — data scoped to the logged-in staff member.
All /staff/me/* endpoints derive staff_id from the JWT token."""

from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.connection import get_db
from database.models import Staff, Appointment, VisitHistory, Service, Client, StaffCommission
from middleware.auth_middleware import get_current_user, role_required
from routes._helpers import now_colombia

router = APIRouter()


def _get_staff_user(current_user) -> Staff:
    """Ensure current user is a staff member."""
    auth_role = getattr(current_user, '_auth_role', '')
    if auth_role != 'staff':
        raise HTTPException(status_code=403, detail="Solo para personal del equipo")
    return current_user


# ============================================================================
# STAFF DASHBOARD STATS
# ============================================================================

@router.get("/staff/me/stats")
def staff_dashboard_stats(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    staff = _get_staff_user(current_user)
    today = now_colombia().date()
    tid = staff.tenant_id

    # Appointments today
    appts_today = db.query(Appointment).filter(
        Appointment.staff_id == staff.id,
        Appointment.date == today,
        Appointment.tenant_id == tid,
    ).all()

    confirmed = [a for a in appts_today if a.status == "confirmed"]
    completed = [a for a in appts_today if a.status == "completed"]

    # Revenue today (from completed visits)
    revenue_today = db.query(func.coalesce(func.sum(VisitHistory.amount), 0)).filter(
        VisitHistory.staff_id == staff.id,
        VisitHistory.visit_date == today,
        VisitHistory.status == "completed",
        VisitHistory.tenant_id == tid,
    ).scalar() or 0

    # Next appointment
    now_time = now_colombia().strftime("%H:%M")
    next_appt = None
    for a in sorted(confirmed, key=lambda x: x.time):
        if a.time >= now_time:
            svc = db.query(Service).filter(Service.id == a.service_id).first()
            next_appt = {
                "id": a.id,
                "time": a.time,
                "client_name": a.client_name,
                "service_name": svc.name if svc else "Servicio",
                "duration_minutes": a.duration_minutes,
            }
            break

    # Commission info
    commission = db.query(StaffCommission).filter(StaffCommission.staff_id == staff.id).first()
    commission_rate = commission.default_rate if commission else 0.4

    return {
        "staff_name": staff.name,
        "staff_role": staff.role,
        "today": today.isoformat(),
        "appointments_today": len(appts_today),
        "confirmed_pending": len(confirmed),
        "completed_today": len(completed),
        "revenue_today": revenue_today,
        "commission_rate": commission_rate,
        "commission_today": int(revenue_today * commission_rate),
        "next_appointment": next_appt,
    }


# ============================================================================
# STAFF APPOINTMENTS (own only)
# ============================================================================

@router.get("/staff/me/appointments")
def staff_appointments(
    date_from: str = None,
    date_to: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    staff = _get_staff_user(current_user)
    tid = staff.tenant_id

    today = now_colombia().date()
    d_from = date.fromisoformat(date_from) if date_from else today
    d_to = date.fromisoformat(date_to) if date_to else today

    appts = db.query(Appointment).filter(
        Appointment.staff_id == staff.id,
        Appointment.date >= d_from,
        Appointment.date <= d_to,
        Appointment.tenant_id == tid,
    ).order_by(Appointment.date, Appointment.time).all()

    result = []
    for a in appts:
        svc = db.query(Service).filter(Service.id == a.service_id).first()
        result.append({
            "id": a.id,
            "client_name": a.client_name,
            "client_phone": a.client_phone,
            "service_name": svc.name if svc else "Servicio",
            "date": a.date.isoformat(),
            "time": a.time,
            "duration_minutes": a.duration_minutes,
            "price": a.price,
            "status": a.status,
            "notes": a.notes,
        })

    return result


# ============================================================================
# STAFF NOTIFICATIONS (upcoming appointments)
# ============================================================================

@router.get("/staff/me/notifications")
def staff_notifications(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    staff = _get_staff_user(current_user)
    tid = staff.tenant_id
    today = now_colombia().date()

    # Get today's confirmed appointments
    appts = db.query(Appointment).filter(
        Appointment.staff_id == staff.id,
        Appointment.date == today,
        Appointment.status == "confirmed",
        Appointment.tenant_id == tid,
    ).order_by(Appointment.time).all()

    notifications = []
    for a in appts:
        svc = db.query(Service).filter(Service.id == a.service_id).first()
        notifications.append({
            "id": a.id,
            "type": "appointment",
            "message": f"Tienes una cita con {a.client_name} a las {a.time} por {svc.name if svc else 'Servicio'}",
            "time": a.time,
            "client_name": a.client_name,
            "service_name": svc.name if svc else "Servicio",
        })

    return notifications


# ============================================================================
# STAFF: COMPLETE APPOINTMENT (with payment code)
# ============================================================================

@router.put("/staff/me/appointments/{appointment_id}/complete")
def staff_complete_appointment(
    appointment_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Staff marks their own appointment as completed with a payment/reference code."""
    staff = _get_staff_user(current_user)
    tid = staff.tenant_id

    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.staff_id == staff.id,
        Appointment.tenant_id == tid,
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    if appt.status not in ("confirmed",):
        raise HTTPException(status_code=400, detail=f"No se puede completar una cita con estado '{appt.status}'")

    payment_code = (data.get("payment_code") or "").strip()
    if not payment_code:
        raise HTTPException(status_code=400, detail="El codigo de referencia es obligatorio")

    # Update appointment
    old_status = appt.status
    appt.status = "completed"
    appt.notes = f"[REF:{payment_code}]" + (f" {appt.notes}" if appt.notes else "")
    db.commit()

    # Auto-create VisitHistory (same logic as update_endpoints)
    if appt.client_id:
        svc = db.query(Service).filter(Service.id == appt.service_id).first()
        existing_visit = db.query(VisitHistory).filter(
            VisitHistory.client_id == appt.client_id,
            VisitHistory.visit_date == appt.date,
            VisitHistory.staff_id == appt.staff_id,
            VisitHistory.service_name == (svc.name if svc else "Servicio"),
        ).first()
        if not existing_visit:
            visit = VisitHistory(
                tenant_id=tid,
                client_id=appt.client_id,
                staff_id=appt.staff_id,
                service_name=svc.name if svc else "Servicio",
                amount=appt.price or 0,
                visit_date=appt.date,
                status="completed",
                payment_method=None,
                notes=f"Completada por {staff.name} — Ref: {payment_code}",
            )
            db.add(visit)
            db.commit()

    return {"success": True, "message": f"Cita completada con referencia {payment_code}"}


# ============================================================================
# STAFF COMMISSIONS / FINANCES
# ============================================================================

@router.get("/staff/me/commissions")
def staff_commissions(
    period: str = "today",
    date_from: str = None,
    date_to: str = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    staff = _get_staff_user(current_user)
    tid = staff.tenant_id
    today = now_colombia().date()

    # Determine date range
    if date_from and date_to:
        d_from = date.fromisoformat(date_from)
        d_to = date.fromisoformat(date_to)
    elif period == "today":
        d_from = d_to = today
    elif period == "week":
        d_from = today - timedelta(days=today.weekday())
        d_to = today
    elif period == "month":
        d_from = today.replace(day=1)
        d_to = today
    else:
        d_from = d_to = today

    # Get commission config
    commission = db.query(StaffCommission).filter(StaffCommission.staff_id == staff.id).first()
    default_rate = commission.default_rate if commission else 0.4
    overrides = commission.service_overrides if commission else {}

    # Get completed visits in range
    visits = db.query(VisitHistory).filter(
        VisitHistory.staff_id == staff.id,
        VisitHistory.visit_date >= d_from,
        VisitHistory.visit_date <= d_to,
        VisitHistory.status == "completed",
        VisitHistory.tenant_id == tid,
    ).order_by(VisitHistory.visit_date.desc()).all()

    items = []
    total_revenue = 0
    total_commission = 0

    for v in visits:
        # Find matching service for overrides
        rate = default_rate
        svc = db.query(Service).filter(Service.name == v.service_name, Service.tenant_id == tid).first()
        if svc and str(svc.id) in overrides:
            rate = overrides[str(svc.id)]

        commission_amount = int(v.amount * rate)
        total_revenue += v.amount
        total_commission += commission_amount

        client = db.query(Client).filter(Client.id == v.client_id).first()
        items.append({
            "id": v.id,
            "date": v.visit_date.isoformat(),
            "client_name": client.name if client else "Cliente",
            "service_name": v.service_name,
            "amount": v.amount,
            "rate": rate,
            "commission": commission_amount,
        })

    return {
        "period": period,
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "default_rate": default_rate,
        "total_revenue": total_revenue,
        "total_commission": total_commission,
        "services_count": len(items),
        "items": items,
    }
