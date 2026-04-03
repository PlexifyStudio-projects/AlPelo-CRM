from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import date, datetime
from typing import Optional

from database.connection import get_db
from database.models import StaffPayment, Staff, VisitHistory, StaffCommission, Tenant, Client, Appointment
from schemas.staff_payment import (
    StaffPaymentCreate, StaffPaymentUpdate, StaffPaymentResponse,
    StaffPayrollSummary, StaffPaymentDetailResponse, VisitDetailItem,
    StaffBankInfo,
)
from middleware.auth_middleware import get_current_user
from database.models import Admin

router = APIRouter(prefix="/staff-payments", tags=["Staff Payments"])


def _tid(user, db):
    from routes._helpers import safe_tid
    return safe_tid(user, db)


def _mask(value: str | None, show_last: int = 4) -> str | None:
    """Mask sensitive data: ****4567"""
    if not value:
        return None
    if len(value) <= show_last:
        return value
    return "*" * (len(value) - show_last) + value[-show_last:]


def _next_receipt_number(db: Session, tid: int) -> str:
    """Generate next receipt number CP-XXXX for this tenant."""
    result = db.execute(text(
        "SELECT receipt_number FROM staff_payment "
        "WHERE tenant_id = :tid AND receipt_number IS NOT NULL "
        "ORDER BY id DESC LIMIT 1"
    ), {"tid": tid})
    row = result.fetchone()
    if row and row[0]:
        try:
            num = int(row[0].replace("CP-", ""))
            return f"CP-{num + 1:04d}"
        except (ValueError, AttributeError):
            pass
    return "CP-0001"


def _build_bank_info(staff: Staff) -> StaffBankInfo:
    """Build masked bank info from staff record."""
    return StaffBankInfo(
        document_type=getattr(staff, 'document_type', None),
        document_number_masked=_mask(getattr(staff, 'document_number', None)),
        bank_name=getattr(staff, 'bank_name', None),
        bank_account_type=getattr(staff, 'bank_account_type', None),
        bank_account_number_masked=_mask(getattr(staff, 'bank_account_number', None)),
        nequi_phone_masked=_mask(getattr(staff, 'nequi_phone', None)),
        daviplata_phone_masked=_mask(getattr(staff, 'daviplata_phone', None)),
        preferred_payment_method=getattr(staff, 'preferred_payment_method', None),
    )


def _staff_has_bank_info(staff: Staff) -> bool:
    return bool(
        getattr(staff, 'bank_account_number', None)
        or getattr(staff, 'nequi_phone', None)
        or getattr(staff, 'daviplata_phone', None)
    )


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

        # Count unpaid visits (no payment_id linked)
        unpaid_count = sum(1 for v in visits if not getattr(v, 'payment_id', None))

        # Payments made in period
        pay_q = db.query(StaffPayment).filter(
            StaffPayment.staff_id == s.id,
            StaffPayment.status == "paid",
        )
        if tid:
            pay_q = pay_q.filter(StaffPayment.tenant_id == tid)
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
            unpaid_services_count=unpaid_count,
            payment_count=payment_count,
            preferred_payment_method=getattr(s, 'preferred_payment_method', None),
            has_bank_info=_staff_has_bank_info(s),
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
# CREATE PAYMENT — Now accepts visit_ids to link visits
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

    # Generate receipt number
    receipt_num = _next_receipt_number(db, tid or 0)

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
        receipt_number=receipt_num,
        status="paid",
    )
    db.add(payment)
    db.flush()  # Get the ID before linking visits

    # Link appointments to this payment
    if data.appointment_ids:
        # Specific appointments selected by the user
        for aid in data.appointment_ids:
            apt = db.query(Appointment).filter(
                Appointment.id == aid,
                Appointment.staff_id == data.staff_id,
            )
            if tid:
                apt = apt.filter(Appointment.tenant_id == tid)
            apt = apt.first()
            if apt:
                apt.staff_payment_id = payment.id
    else:
        # No specific selection → auto-link ALL unpaid appointments in the period
        unpaid_q = db.query(Appointment).filter(
            Appointment.staff_id == data.staff_id,
            Appointment.date >= data.period_from,
            Appointment.date <= data.period_to,
            Appointment.status.in_(["completed", "paid"]),
            Appointment.staff_payment_id.is_(None),
        )
        if tid:
            unpaid_q = unpaid_q.filter(Appointment.tenant_id == tid)
        for apt in unpaid_q.all():
            apt.staff_payment_id = payment.id

    # Link visit_history records too
    if data.visit_ids:
        for vid in data.visit_ids:
            visit = db.query(VisitHistory).filter(
                VisitHistory.id == vid,
                VisitHistory.staff_id == data.staff_id,
            )
            if tid:
                visit = visit.filter(VisitHistory.tenant_id == tid)
            visit = visit.first()
            if visit:
                visit.payment_id = payment.id
    else:
        # Auto-link all unpaid visits in the period
        unpaid_visits = db.query(VisitHistory).filter(
            VisitHistory.staff_id == data.staff_id,
            VisitHistory.visit_date >= data.period_from,
            VisitHistory.visit_date <= data.period_to,
            VisitHistory.status == "completed",
            VisitHistory.payment_id.is_(None),
        )
        if tid:
            unpaid_visits = unpaid_visits.filter(VisitHistory.tenant_id == tid)
        for v in unpaid_visits.all():
            v.payment_id = payment.id

    db.commit()
    db.refresh(payment)

    return StaffPaymentResponse(
        **{c.name: getattr(payment, c.name) for c in payment.__table__.columns},
        staff_name=staff.name,
    )


# ============================================================================
# PAYMENT DETAIL — Full info for receipt/comprobante generation
# ============================================================================

@router.get("/{payment_id}/detail", response_model=StaffPaymentDetailResponse)
def get_payment_detail(
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

    staff = db.query(Staff).filter(Staff.id == payment.staff_id).first()

    # Get linked visits
    visits_q = db.query(VisitHistory).filter(VisitHistory.payment_id == payment.id)
    visits_raw = visits_q.all()
    visits = []
    for v in visits_raw:
        client = db.query(Client).filter(Client.id == v.client_id).first()
        visits.append(VisitDetailItem(
            id=v.id,
            client_name=client.name if client else "?",
            service_name=v.service_name,
            amount=v.amount or 0,
            visit_date=v.visit_date,
            payment_method=v.payment_method,
            notes=v.notes,
        ))

    # Tenant info for receipt header
    tenant = db.query(Tenant).filter(Tenant.id == (tid or payment.tenant_id)).first()

    # Build response
    base = {c.name: getattr(payment, c.name) for c in payment.__table__.columns}
    return StaffPaymentDetailResponse(
        **base,
        staff_name=staff.name if staff else "?",
        visits=visits,
        staff_bank=_build_bank_info(staff) if staff else None,
        staff_role=staff.role if staff else "",
        staff_photo_url=getattr(staff, 'photo_url', None) if staff else None,
        tenant_name=tenant.name if tenant else None,
        tenant_address=getattr(tenant, 'address', None) if tenant else None,
        tenant_phone=getattr(tenant, 'phone', None) if tenant else None,
        tenant_logo_url=getattr(tenant, 'logo_url', None) if tenant else None,
        tenant_nit=getattr(tenant, 'nit', None) if tenant else None,
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
# DELETE PAYMENT — Also unlinks visits
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

    # Unlink appointments and visits associated with this payment
    db.query(Appointment).filter(
        Appointment.staff_payment_id == payment.id
    ).update({"staff_payment_id": None})
    db.query(VisitHistory).filter(
        VisitHistory.payment_id == payment.id
    ).update({"payment_id": None})

    db.delete(payment)
    db.commit()
    return {"success": True, "message": "Payment deleted"}


# ============================================================================
# STAFF BANK INFO — GET / PUT (admin only)
# ============================================================================

@router.get("/bank-info/{staff_id}")
def get_bank_info(
    staff_id: int,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = _tid(user, db)
    q = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        q = q.filter(Staff.tenant_id == tid)
    staff = q.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    return {
        "staff_id": staff.id,
        "staff_name": staff.name,
        "document_type": getattr(staff, 'document_type', None),
        "document_number": getattr(staff, 'document_number', None),
        "bank_name": getattr(staff, 'bank_name', None),
        "bank_account_type": getattr(staff, 'bank_account_type', None),
        "bank_account_number": getattr(staff, 'bank_account_number', None),
        "nequi_phone": getattr(staff, 'nequi_phone', None),
        "daviplata_phone": getattr(staff, 'daviplata_phone', None),
        "preferred_payment_method": getattr(staff, 'preferred_payment_method', None),
    }


@router.put("/bank-info/{staff_id}")
def update_bank_info(
    staff_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = _tid(user, db)
    q = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        q = q.filter(Staff.tenant_id == tid)
    staff = q.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    allowed_fields = [
        'document_type', 'document_number', 'bank_name', 'bank_account_type',
        'bank_account_number', 'nequi_phone', 'daviplata_phone', 'preferred_payment_method',
    ]
    for field in allowed_fields:
        if field in data:
            setattr(staff, field, data[field])

    db.commit()
    db.refresh(staff)

    return {
        "success": True,
        "staff_id": staff.id,
        "message": f"Bank info updated for {staff.name}",
    }
