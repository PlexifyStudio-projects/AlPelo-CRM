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

@router.get("/my/stats")
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
    completed = [a for a in appts_today if a.status in ("completed", "paid")]

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

    # Yesterday revenue (for comparison)
    from datetime import timedelta as _td
    yesterday = today - _td(days=1)
    revenue_yesterday = db.query(func.coalesce(func.sum(VisitHistory.amount), 0)).filter(
        VisitHistory.staff_id == staff.id,
        VisitHistory.visit_date == yesterday,
        VisitHistory.status == "completed",
        VisitHistory.tenant_id == tid,
    ).scalar() or 0

    # Total visits this month
    from datetime import timedelta as _td_early
    _month_start = today.replace(day=1)
    total_visits = db.query(func.count(VisitHistory.id)).filter(
        VisitHistory.staff_id == staff.id,
        VisitHistory.status == "completed",
        VisitHistory.tenant_id == tid,
        VisitHistory.visit_date >= _month_start,
    ).scalar() or 0

    # Visits today
    visits_today = db.query(VisitHistory).filter(
        VisitHistory.staff_id == staff.id,
        VisitHistory.visit_date == today,
        VisitHistory.status == "completed",
        VisitHistory.tenant_id == tid,
    ).count()

    # Visits this month (with details for the list)
    from datetime import timedelta as _td2
    month_start = today.replace(day=1)
    month_visits = db.query(VisitHistory).filter(
        VisitHistory.staff_id == staff.id,
        VisitHistory.status == "completed",
        VisitHistory.tenant_id == tid,
        VisitHistory.visit_date >= month_start,
        VisitHistory.visit_date <= today,
    ).order_by(VisitHistory.visit_date.desc(), VisitHistory.created_at.desc()).all()
    print(f"[STAFF STATS] Staff '{staff.name}' (id={staff.id}, tenant={tid}) — {len(month_visits)} visits this month")

    # Build visit data — show EVERY visit_history entry for this staff, no dedup
    import re as _re
    _client_cache = {}
    _apt_cache = {}  # (date, client_id) → appointment
    month_visits_data = []
    for v in month_visits:
        if v.client_id not in _client_cache:
            _client_cache[v.client_id] = db.query(Client).filter(Client.id == v.client_id).first()
        client = _client_cache[v.client_id]

        # Find linked appointment for ticket and time
        ticket = None
        appt_time = None
        is_paid = v.payment_id is not None
        if v.notes:
            code_match = _re.search(r'\[CODIGO:([^\]]+)\]', v.notes or '')
            if code_match:
                ticket = code_match.group(1)
        # Cache appointment lookup by (date, client_id)
        _apt_key = (v.visit_date, v.client_id)
        if _apt_key not in _apt_cache:
            _apt_cache[_apt_key] = db.query(Appointment).filter(
                Appointment.staff_id == staff.id,
                Appointment.date == v.visit_date,
                Appointment.client_id == v.client_id,
                Appointment.tenant_id == tid,
            ).first()
        apt = _apt_cache[_apt_key]
        if apt:
            ticket = ticket or apt.visit_code or f"A-{apt.id}"
            appt_time = apt.time
            if apt.status == "paid":
                is_paid = True

        month_visits_data.append({
            "id": v.id,
            "client_name": client.name if client else "Cliente",
            "service_name": v.service_name,
            "amount": v.amount,
            "commission": int(v.amount * commission_rate),
            "tip": v.tip or 0,
            "visit_date": v.visit_date.isoformat() if v.visit_date else None,
            "time": appt_time,
            "ticket": ticket,
            "is_paid": is_paid,
            "payment_method": v.payment_method,
        })

    month_commission = sum(int(v.amount * commission_rate) for v in month_visits)
    month_tips = sum(v.tip or 0 for v in month_visits)
    month_revenue = sum(v.amount for v in month_visits)

    # Product commissions this month (from CheckoutItem where staff sold products)
    from database.models import CheckoutItem, Checkout
    month_product_comm = 0
    month_products = []
    try:
        product_items = (
            db.query(CheckoutItem)
            .join(Checkout, CheckoutItem.checkout_id == Checkout.id)
            .filter(
                CheckoutItem.staff_id == staff.id,
                CheckoutItem.tenant_id == tid,
                CheckoutItem.service_name.like("[Producto]%"),
                Checkout.created_at >= datetime.combine(month_start, datetime.min.time()),
            )
            .all()
        )
        for pi in product_items:
            pc = pi.commission_amount or (int(pi.total * commission_rate) if pi.total else 0)
            month_product_comm += pc
            month_products.append({
                "name": pi.service_name.replace("[Producto] ", ""),
                "amount": pi.total or 0,
                "commission": pc,
            })
    except Exception:
        pass

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
        "commission_yesterday": int(revenue_yesterday * commission_rate),
        "revenue_yesterday": revenue_yesterday,
        "visits_today": visits_today,
        "total_visits": total_visits,
        "month_visits": month_visits_data,
        "month_commission": month_commission,
        "month_tips": month_tips,
        "month_revenue": month_revenue,
        "month_product_comm": month_product_comm,
        "month_products": month_products,
        "next_appointment": next_appt,
    }


# ============================================================================
# STAFF APPOINTMENTS (own only)
# ============================================================================

@router.get("/my/appointments")
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

@router.get("/my/notifications")
def staff_notifications(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    staff = _get_staff_user(current_user)
    tid = staff.tenant_id
    today = now_colombia().date()

    # Get ALL today's appointments (confirmed, completed, paid — not cancelled/no_show)
    appts = db.query(Appointment).filter(
        Appointment.staff_id == staff.id,
        Appointment.date == today,
        Appointment.status.in_(["confirmed", "completed", "paid"]),
        Appointment.tenant_id == tid,
    ).order_by(Appointment.time).all()

    notifications = []
    for a in appts:
        svc = db.query(Service).filter(Service.id == a.service_id).first()
        notifications.append({
            "id": a.id,
            "type": "appointment",
            "status": a.status,
            "message": f"Tienes una cita con {a.client_name} a las {a.time} por {svc.name if svc else 'Servicio'}",
            "time": a.time,
            "client_name": a.client_name,
            "service_name": svc.name if svc else "Servicio",
            "duration_minutes": a.duration_minutes,
            "price": a.price or 0,
        })

    return notifications


# ============================================================================
# STAFF: COMPLETE APPOINTMENT (with payment code)
# ============================================================================

@router.put("/my/appointments/{appointment_id}/complete")
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

@router.get("/my/commissions")
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

    # Get completed/paid appointments in range
    from database.models import StaffServiceCommission
    apts = db.query(Appointment).filter(
        Appointment.staff_id == staff.id,
        Appointment.date >= d_from,
        Appointment.date <= d_to,
        Appointment.status.in_(["completed", "paid"]),
        Appointment.tenant_id == tid,
    ).order_by(Appointment.date.desc(), Appointment.time.desc()).all()

    items = []
    total_revenue = 0
    total_commission = 0
    total_paid = 0
    total_pending = 0

    for apt in apts:
        # Use locked commission if available, otherwise look up per-service rate
        if getattr(apt, 'commission_rate', None) is not None:
            rate = apt.commission_rate
            commission_amount = getattr(apt, 'commission_amount', None) or int((apt.price or 0) * rate)
        else:
            svc_comm = db.query(StaffServiceCommission).filter(
                StaffServiceCommission.staff_id == staff.id,
                StaffServiceCommission.service_id == apt.service_id,
            ).first()
            rate = svc_comm.commission_rate if svc_comm else default_rate
            commission_amount = int((apt.price or 0) * rate)

        total_revenue += apt.price or 0
        total_commission += commission_amount

        is_paid = apt.staff_payment_id is not None and apt.staff_payment_id > 0
        if is_paid:
            total_paid += commission_amount
        else:
            total_pending += commission_amount

        svc = db.query(Service).filter(Service.id == apt.service_id).first()
        items.append({
            "id": apt.id,
            "date": apt.date.isoformat(),
            "time": apt.time,
            "client_name": apt.client_name or "Cliente",
            "service_name": svc.name if svc else "Servicio",
            "visit_code": getattr(apt, 'visit_code', None),
            "amount": apt.price or 0,
            "rate": rate,
            "commission": commission_amount,
            "is_paid": is_paid,
        })

    return {
        "period": period,
        "date_from": d_from.isoformat(),
        "date_to": d_to.isoformat(),
        "default_rate": default_rate,
        "total_revenue": total_revenue,
        "total_commission": total_commission,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "services_count": len(items),
        "items": items,
    }
