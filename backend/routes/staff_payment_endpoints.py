from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime
from typing import Optional

from database.connection import get_db
from database.models import StaffPayment, Staff, VisitHistory, StaffCommission
from schemas.staff_payment import (
    StaffPaymentCreate, StaffPaymentUpdate, StaffPaymentResponse, StaffPayrollSummary
)
from auth.auth import get_current_user, Admin

router = APIRouter(prefix="/staff-payments", tags=["Staff Payments"])


def _tid(user, db):
    from routes._helpers import safe_tid
    return safe_tid(user, db)


# ============================================================================
# PAYROLL SUMMARY — How much each staff earned vs how much was paid
# ============================================================================

@router.get("/summary", response_model=list[StaffPayrollSummary])
def get_payroll_summary(
    period_from: Optional[str] = None,
    period_to: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = _tid(user, db)
    staff_q = db.query(Staff).filter(Staff.is_active == True)
    if tid:
        staff_q = staff_q.filter(Staff.tenant_id == tid)
    all_staff = staff_q.all()

    # Date range
    if period_from:
        d_from = date.fromisoformat(period_from)
    else:
        d_from = date.today().replace(day=1)
    if period_to:
        d_to = date.fromisoformat(period_to)
    else:
        d_to = date.today()

    results = []
    for s in all_staff:
        # Commission config
        comm = db.query(StaffCommission).filter(StaffCommission.staff_id == s.id).first()
        rate = comm.default_rate if comm else 0.40

        # Earnings from visits in period
        visits_q = db.query(VisitHistory).filter(
            VisitHistory.staff_id == s.id,
            VisitHistory.status == "completed",
            VisitHistory.visit_date >= d_from,
            VisitHistory.visit_date <= d_to,
        )
        if tid:
            visits_q = visits_q.filter(VisitHistory.tenant_id == tid)
        visits = visits_q.all()

        total_revenue = sum(v.amount or 0 for v in visits)
        total_tips = sum(getattr(v, 'tip', 0) or 0 for v in visits)
        commission_earned = round(total_revenue * rate)
        total_earned = commission_earned + total_tips

        # Payments made in period
        pay_q = db.query(StaffPayment).filter(
            StaffPayment.staff_id == s.id,
            StaffPayment.status == "paid",
        )
        if tid:
            pay_q = pay_q.filter(StaffPayment.tenant_id == tid)
        # Payments that overlap with the period
        pay_q = pay_q.filter(
            StaffPayment.period_from <= d_to,
            StaffPayment.period_to >= d_from,
        )
        payments = pay_q.all()
        total_paid = sum(p.amount or 0 for p in payments)
        payment_count = len(payments)

        results.append(StaffPayrollSummary(
            staff_id=s.id,
            staff_name=s.name,
            staff_role=s.role or "",
            photo_url=getattr(s, 'photo_url', None),
            commission_rate=rate,
            total_earned=total_earned,
            total_paid=total_paid,
            balance=total_earned - total_paid,
            services_count=len(visits),
            payment_count=payment_count,
        ))

    return sorted(results, key=lambda x: -x.balance)


# ============================================================================
# LIST PAYMENTS
# ============================================================================

@router.get("/", response_model=list[StaffPaymentResponse])
def list_payments(
    staff_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = _tid(user, db)
    q = db.query(StaffPayment)
    if tid:
        q = q.filter(StaffPayment.tenant_id == tid)
    if staff_id:
        q = q.filter(StaffPayment.staff_id == staff_id)
    if status:
        q = q.filter(StaffPayment.status == status)

    payments = q.order_by(StaffPayment.paid_at.desc()).all()

    result = []
    for p in payments:
        staff = db.query(Staff).filter(Staff.id == p.staff_id).first()
        result.append(StaffPaymentResponse(
            **{c.name: getattr(p, c.name) for c in p.__table__.columns},
            staff_name=staff.name if staff else "?",
        ))
    return result


# ============================================================================
# CREATE PAYMENT
# ============================================================================

@router.post("/", response_model=StaffPaymentResponse)
def create_payment(
    data: StaffPaymentCreate,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = _tid(user, db)

    # Verify staff exists and belongs to tenant
    staff = db.query(Staff).filter(Staff.id == data.staff_id)
    if tid:
        staff = staff.filter(Staff.tenant_id == tid)
    staff = staff.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    payment = StaffPayment(
        tenant_id=tid or 0,
        staff_id=data.staff_id,
        amount=data.amount,
        period_from=data.period_from,
        period_to=data.period_to,
        concept=data.concept,
        payment_method=data.payment_method,
        reference=data.reference,
        receipt_url=data.receipt_url,
        commission_total=data.commission_total,
        tips_total=data.tips_total,
        product_commissions=data.product_commissions,
        deductions=data.deductions,
        notes=data.notes,
        paid_by=user.username,
        status="paid",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return StaffPaymentResponse(
        **{c.name: getattr(payment, c.name) for c in payment.__table__.columns},
        staff_name=staff.name,
    )


# ============================================================================
# UPDATE PAYMENT
# ============================================================================

@router.put("/{payment_id}", response_model=StaffPaymentResponse)
def update_payment(
    payment_id: int,
    data: StaffPaymentUpdate,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = _tid(user, db)
    q = db.query(StaffPayment).filter(StaffPayment.id == payment_id)
    if tid:
        q = q.filter(StaffPayment.tenant_id == tid)
    payment = q.first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)

    db.commit()
    db.refresh(payment)

    staff = db.query(Staff).filter(Staff.id == payment.staff_id).first()
    return StaffPaymentResponse(
        **{c.name: getattr(payment, c.name) for c in payment.__table__.columns},
        staff_name=staff.name if staff else "?",
    )


# ============================================================================
# DELETE PAYMENT
# ============================================================================

@router.delete("/{payment_id}")
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = _tid(user, db)
    q = db.query(StaffPayment).filter(StaffPayment.id == payment_id)
    if tid:
        q = q.filter(StaffPayment.tenant_id == tid)
    payment = q.first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    db.delete(payment)
    db.commit()
    return {"success": True, "message": "Payment deleted"}
