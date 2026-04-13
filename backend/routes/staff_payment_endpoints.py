from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import date, datetime
from typing import Optional

from database.connection import get_db
from database.models import StaffPayment, Staff, VisitHistory, StaffCommission, StaffServiceCommission, StaffFine, Tenant, Client, Appointment, Service
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

    # Build service catalog for per-service commission lookup
    svc_catalog = {}  # {service_name_lower: service_id}
    svc_q = db.query(Service)
    if tid:
        svc_q = svc_q.filter(Service.tenant_id == tid)
    for svc in svc_q.all():
        svc_catalog[svc.name.lower().strip()] = svc.id

    results = []
    for s in all_staff:
        # Commission config
        comm = db.query(StaffCommission).filter(StaffCommission.staff_id == s.id).first()
        default_rate = comm.default_rate if comm else 0.40

        # Per-service commission rates
        ssc_rows = db.query(StaffServiceCommission).filter(
            StaffServiceCommission.staff_id == s.id
        ).all()
        ssc_map = {r.service_id: r.commission_rate for r in ssc_rows}

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

        # Per-service commission calculation + product commissions from notes
        import re as _re
        commission_earned = 0
        product_commissions_total = 0
        for v in visits:
            names = v.service_name.split(',') if v.service_name else ['Otros']
            per_svc_amount = (v.amount or 0) / max(len(names), 1)
            for name in names:
                name = name.strip()
                is_product = name.startswith('[Producto]')
                svc_id = svc_catalog.get(name.lower().strip())
                if is_product:
                    rate = 0  # Product % commission = 0, fixed $ from notes
                elif svc_id and svc_id in ssc_map:
                    rate = ssc_map[svc_id]
                else:
                    rate = default_rate
                commission_earned += round(per_svc_amount * rate)
            # Extract real product commission from PRODUCTS JSON (comm field)
            if v.notes and '<!--PRODUCTS:' in v.notes:
                import json as _json2
                try:
                    ps2 = v.notes.index('<!--PRODUCTS:') + len('<!--PRODUCTS:')
                    pe2 = v.notes.index(':PRODUCTS-->')
                    prods2 = _json2.loads(v.notes[ps2:pe2])
                    product_commissions_total += sum(p.get('comm', 0) or 0 for p in prods2)
                except Exception:
                    pass

        total_revenue = sum(v.amount or 0 for v in visits)
        total_tips = sum(getattr(v, 'tip', 0) or 0 for v in visits)
        total_earned = commission_earned + product_commissions_total + total_tips

        # Count unpaid visits (no payment_id linked)
        unpaid_count = sum(1 for v in visits if not getattr(v, 'payment_id', None))

        # Fines in period
        fines_q = db.query(StaffFine).filter(
            StaffFine.staff_id == s.id,
            StaffFine.fine_date >= d_from,
            StaffFine.fine_date <= d_to,
            StaffFine.is_paid == False,
        )
        if tid:
            fines_q = fines_q.filter(StaffFine.tenant_id == tid)
        fines = fines_q.all()
        fines_total = sum(f.amount for f in fines)

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

        # Balance = earned - fines - paid
        balance = total_earned - fines_total - total_paid

        results.append(StaffPayrollSummary(
            staff_id=s.id,
            staff_name=s.name,
            staff_role=s.role or "",
            photo_url=getattr(s, 'photo_url', None),
            commission_rate=default_rate,
            total_revenue=total_revenue,
            total_earned=total_earned,
            total_paid=total_paid,
            balance=balance,
            services_count=len(visits),
            unpaid_services_count=unpaid_count,
            payment_count=payment_count,
            tips_total=total_tips,
            fines_total=fines_total,
            fines_count=len(fines),
            fines=[
                {"id": f.id, "reason": f.reason, "amount": f.amount, "fine_date": f.fine_date.isoformat(), "notes": f.notes or ""}
                for f in fines
            ],
            preferred_payment_method=getattr(s, 'preferred_payment_method', None),
            has_bank_info=_staff_has_bank_info(s),
        ))

    return sorted(results, key=lambda x: -x.balance)


# ============================================================================
# STAFF VISITS (from visit_history — includes agenda + orders)
# ============================================================================

@router.get("/visits")
def get_staff_visits(
    staff_id: int = Query(...),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    """Return visit_history records for a staff member — used by Nómina detail."""
    tid = _tid(user, db)
    d_from = date.fromisoformat(date_from) if date_from else date.today().replace(day=1)
    d_to = date.fromisoformat(date_to) if date_to else date.today()

    q = db.query(VisitHistory).filter(
        VisitHistory.staff_id == staff_id,
        VisitHistory.status == "completed",
        VisitHistory.visit_date >= d_from,
        VisitHistory.visit_date <= d_to,
    )
    if tid:
        q = q.filter(VisitHistory.tenant_id == tid)
    visits = q.order_by(VisitHistory.visit_date.desc(), VisitHistory.id.desc()).all()

    # Build service catalog for commission lookup
    svc_catalog = {}
    svc_q = db.query(Service)
    if tid:
        svc_q = svc_q.filter(Service.tenant_id == tid)
    for svc in svc_q.all():
        svc_catalog[svc.name.lower().strip()] = svc.id

    # Commission config
    comm = db.query(StaffCommission).filter(StaffCommission.staff_id == staff_id).first()
    default_rate = comm.default_rate if comm else 0.40
    ssc_rows = db.query(StaffServiceCommission).filter(StaffServiceCommission.staff_id == staff_id).all()
    ssc_map = {r.service_id: r.commission_rate for r in ssc_rows}

    import re as _re
    result = []
    for v in visits:
        # Calculate commission per-service with breakdown
        names = v.service_name.split(',') if v.service_name else ['Otros']
        svc_commission = 0
        svc_breakdown = []
        for name in names:
            name_clean = name.strip()
            is_product = name_clean.startswith('[Producto]')
            svc_id = svc_catalog.get(name_clean.lower().strip())
            per_svc = (v.amount or 0) / max(len(names), 1)
            if is_product:
                rate = 0
            elif svc_id and svc_id in ssc_map:
                rate = ssc_map[svc_id]
            else:
                rate = default_rate
            comm_amt = round(per_svc * rate)
            svc_commission += comm_amt
            if not is_product:
                svc_breakdown.append({"name": name_clean, "price": int(per_svc), "rate": rate, "commission": comm_amt})

        # Product commission from PRODUCTS JSON (comm field), NOT from [PRODUCT_COMMISSION:X] tag
        # The tag stored revenue in legacy data, the JSON comm field has the real commission
        prod_comm = 0
        if v.notes and '<!--PRODUCTS:' in v.notes:
            import json as _json
            try:
                ps = v.notes.index('<!--PRODUCTS:') + len('<!--PRODUCTS:')
                pe = v.notes.index(':PRODUCTS-->')
                prods = _json.loads(v.notes[ps:pe])
                prod_comm = sum(p.get('comm', 0) or 0 for p in prods)
            except Exception:
                pass

        client = db.query(Client).filter(Client.id == v.client_id).first()
        result.append({
            "id": v.id,
            "visit_date": v.visit_date.isoformat(),
            "client_id": v.client_id,
            "client_name": client.name if client else "Desconocido",
            "service_name": v.service_name,
            "amount": v.amount or 0,
            "tip": getattr(v, 'tip', 0) or 0,
            "commission": svc_commission + prod_comm,
            "product_commission": prod_comm,
            "service_breakdown": svc_breakdown,
            "payment_method": v.payment_method,
            "payment_id": v.payment_id,
            "notes": v.notes,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        })
    return result


@router.put("/visits/{visit_id}/unlink")
def unlink_visit_payment(
    visit_id: int,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    """Remove payment_id from a visit_history record (return to unpaid)."""
    tid = _tid(user, db)
    q = db.query(VisitHistory).filter(VisitHistory.id == visit_id)
    if tid:
        q = q.filter(VisitHistory.tenant_id == tid)
    visit = q.first()
    if not visit:
        raise HTTPException(404, "Visita no encontrada")
    visit.payment_id = None
    # Also unlink any associated appointment
    if tid:
        apt = db.query(Appointment).filter(
            Appointment.client_id == visit.client_id,
            Appointment.date == visit.visit_date,
            Appointment.staff_id == visit.staff_id,
            Appointment.tenant_id == tid,
        ).first()
        if apt and apt.staff_payment_id:
            apt.staff_payment_id = None
    db.commit()
    return {"ok": True}


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

    # Mark unpaid fines as paid (they were deducted from this payment)
    unpaid_fines = db.query(StaffFine).filter(
        StaffFine.staff_id == data.staff_id,
        StaffFine.is_paid == False,
        StaffFine.fine_date >= data.period_from,
        StaffFine.fine_date <= data.period_to,
    )
    if tid:
        unpaid_fines = unpaid_fines.filter(StaffFine.tenant_id == tid)
    for f in unpaid_fines.all():
        f.is_paid = True

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

    # Get linked appointments (primary source)
    linked_apts = db.query(Appointment).filter(Appointment.staff_payment_id == payment.id).all()
    visits = []
    for apt in linked_apts:
        svc = db.query(Service).filter(Service.id == apt.service_id).first()
        svc_name = svc.name if svc else "Servicio"
        visits.append(VisitDetailItem(
            id=apt.id,
            client_name=apt.client_name or "?",
            service_name=svc_name,
            amount=apt.price or 0,
            visit_date=apt.date,
            payment_method=None,
            notes=getattr(apt, 'visit_code', None),
        ))

    # Fallback: if no appointments linked, check visit history
    if not visits:
        visits_q = db.query(VisitHistory).filter(VisitHistory.payment_id == payment.id)
        for v in visits_q.all():
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


# ============================================================================
# WOMPI DISPERSIONS — Real payouts to staff bank accounts
# ============================================================================

@router.post("/disburse/{payment_id}")
async def disburse_payment(payment_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Create a real Wompi disbursement for an existing staff payment record.
    Requires: Wompi credentials configured + staff bank info filled."""
    tid = _tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    payment = db.query(StaffPayment).filter(
        StaffPayment.id == payment_id,
        StaffPayment.tenant_id == tid,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    if getattr(payment, 'disbursement_status', None) == 'APPROVED':
        raise HTTPException(status_code=400, detail="Este pago ya fue dispersado exitosamente")

    staff = db.query(Staff).filter(Staff.id == payment.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff no encontrado")

    reference = f"NOM-{tid}-{payment_id}-{staff.id}"

    from services.payments.wompi_payouts import create_disbursement
    result = await create_disbursement(
        db=db,
        tenant_id=tid,
        staff=staff,
        amount=int(payment.amount),
        reference=reference,
        concept=payment.concept or "Pago de nomina",
    )

    if result.get("ok"):
        # Update payment record with disbursement info
        payment.reference = result.get("payout_id", payment.reference)
        payment.notes = (payment.notes or '') + f"\n[WOMPI] {result['environment']}: {result['payout_id']} — {result['status']}"
        db.commit()

    return result


@router.get("/disburse/{payment_id}/status")
async def check_disbursement_status(payment_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Check Wompi disbursement status for a payment."""
    tid = _tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    payment = db.query(StaffPayment).filter(
        StaffPayment.id == payment_id,
        StaffPayment.tenant_id == tid,
    ).first()
    if not payment or not payment.reference:
        raise HTTPException(status_code=404, detail="Pago o referencia no encontrado")

    from services.payments.wompi_payouts import check_payout_status
    return await check_payout_status(db, tid, payment.reference)


@router.get("/wompi/banks")
async def list_wompi_banks(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List available banks from Wompi for dispersions."""
    tid = _tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    from services.payments.wompi_payouts import get_wompi_banks
    banks = await get_wompi_banks(db, tid)
    return {"banks": banks}
