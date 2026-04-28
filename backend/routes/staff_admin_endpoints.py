"""Admin-facing endpoints for managing staff: loans, clients attended, commissions summary.

These complement /staff (search/CRUD), /staff-payments (payroll), and /schedule (horarios)
with the additional data the redesigned Equipo page needs in the detail drawer.
"""

from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.connection import get_db
from database.models import (
    Staff, StaffLoan, StaffServiceCommission, Service,
    VisitHistory, Appointment, Client, Invoice,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter(prefix="/staff", tags=["Staff Admin Extras"])


# ============================================================================
# LOANS / ABONOS — admin-managed advances against payroll
# ============================================================================

@router.get("/{staff_id}/loans")
def list_loans(staff_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(StaffLoan).filter(StaffLoan.staff_id == staff_id)
    if tid:
        q = q.filter(StaffLoan.tenant_id == tid)
    loans = q.order_by(StaffLoan.date.desc(), StaffLoan.id.desc()).all()

    total_pendiente = sum(l.amount for l in loans if l.type == 'prestamo' and l.status == 'pendiente')
    total_descontado = sum(l.amount for l in loans if l.status == 'descontado')
    total_abonos = sum(l.amount for l in loans if l.type == 'abono' and l.status == 'pendiente')

    return {
        "loans": [
            {
                "id": l.id,
                "type": l.type,
                "amount": l.amount,
                "date": l.date.isoformat() if l.date else None,
                "note": l.note,
                "status": l.status,
                "created_by": l.created_by,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in loans
        ],
        "summary": {
            "total_pendiente": total_pendiente,
            "total_descontado": total_descontado,
            "total_abonos": total_abonos,
            "balance": total_pendiente - total_abonos,
        },
    }


@router.post("/{staff_id}/loans")
def create_loan(staff_id: int, data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(400, "No tenant assigned")
    staff = db.query(Staff).filter(Staff.id == staff_id, Staff.tenant_id == tid).first()
    if not staff:
        raise HTTPException(404, "Colaborador no encontrado")

    try:
        amount = int(data.get("amount", 0))
    except Exception:
        raise HTTPException(400, "Monto inválido")
    if amount <= 0:
        raise HTTPException(400, "Monto debe ser mayor a 0")

    loan_type = (data.get("type") or "prestamo").lower()
    if loan_type not in ("prestamo", "abono"):
        loan_type = "prestamo"

    date_str = data.get("date")
    try:
        loan_date = date.fromisoformat(date_str) if date_str else date.today()
    except Exception:
        loan_date = date.today()

    loan = StaffLoan(
        tenant_id=tid,
        staff_id=staff.id,
        type=loan_type,
        amount=amount,
        date=loan_date,
        note=(data.get("note") or "").strip() or None,
        status='pendiente',
        created_by=getattr(user, 'username', 'admin'),
    )
    db.add(loan)
    db.commit()
    db.refresh(loan)
    return {"ok": True, "id": loan.id}


@router.put("/{staff_id}/loans/{loan_id}")
def update_loan(staff_id: int, loan_id: int, data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    loan = db.query(StaffLoan).filter(StaffLoan.id == loan_id, StaffLoan.staff_id == staff_id)
    if tid:
        loan = loan.filter(StaffLoan.tenant_id == tid)
    loan = loan.first()
    if not loan:
        raise HTTPException(404, "Movimiento no encontrado")

    if "amount" in data:
        try:
            loan.amount = max(0, int(data["amount"]))
        except Exception:
            pass
    if "note" in data:
        loan.note = (data["note"] or "").strip() or None
    if "status" in data and data["status"] in ("pendiente", "pagado", "descontado"):
        loan.status = data["status"]
    if "date" in data:
        try:
            loan.date = date.fromisoformat(data["date"])
        except Exception:
            pass
    loan.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.delete("/{staff_id}/loans/{loan_id}")
def delete_loan(staff_id: int, loan_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    loan = db.query(StaffLoan).filter(StaffLoan.id == loan_id, StaffLoan.staff_id == staff_id)
    if tid:
        loan = loan.filter(StaffLoan.tenant_id == tid)
    loan = loan.first()
    if not loan:
        raise HTTPException(404, "Movimiento no encontrado")
    db.delete(loan)
    db.commit()
    return {"ok": True}


# ============================================================================
# CLIENTS-DETAIL — clients attended by this staff with full info
# ============================================================================

@router.get("/{staff_id}/clients-detail")
def clients_attended_detail(
    staff_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns full list of visits this staff has attended with client info, ticket, total, etc."""
    tid = safe_tid(user, db)

    q = db.query(VisitHistory).filter(VisitHistory.staff_id == staff_id)
    if tid:
        q = q.filter(VisitHistory.tenant_id == tid)
    if date_from:
        try:
            q = q.filter(VisitHistory.visit_date >= date.fromisoformat(date_from))
        except Exception:
            pass
    if date_to:
        try:
            q = q.filter(VisitHistory.visit_date <= date.fromisoformat(date_to))
        except Exception:
            pass

    visits = q.order_by(VisitHistory.visit_date.desc(), VisitHistory.id.desc()).limit(limit).all()

    # Pre-fetch clients
    client_ids = list({v.client_id for v in visits if v.client_id})
    client_map = {c.id: c for c in db.query(Client).filter(Client.id.in_(client_ids)).all()} if client_ids else {}

    # Visit count per client (lifetime, scoped to tenant)
    visit_count_per_client = {}
    if client_ids:
        rows = db.query(VisitHistory.client_id, func.count(VisitHistory.id))
        if tid:
            rows = rows.filter(VisitHistory.tenant_id == tid)
        rows = rows.filter(VisitHistory.client_id.in_(client_ids)).group_by(VisitHistory.client_id).all()
        visit_count_per_client = {cid: cnt for cid, cnt in rows}

    items = []
    total_amount = 0
    for v in visits:
        c = client_map.get(v.client_id)
        amt = v.amount or 0
        total_amount += amt
        items.append({
            "id": v.id,
            "date": v.visit_date.isoformat() if v.visit_date else None,
            "client_id": v.client_id,
            "client_name": c.name if c else (v.client_name if hasattr(v, 'client_name') else 'Sin registro'),
            "client_phone": c.phone if c else None,
            "client_ticket": c.client_id if c else None,
            "client_visits": visit_count_per_client.get(v.client_id, 0),
            "service_id": v.service_id,
            "service_name": v.service_name,
            "amount": amt,
            "tip": getattr(v, 'tip', 0) or 0,
            "payment_method": v.payment_method,
            "status": v.status,
            "notes": v.notes,
        })

    return {
        "items": items,
        "summary": {
            "total_visits": len(items),
            "total_amount": total_amount,
            "unique_clients": len(client_ids),
        },
    }


# ============================================================================
# COMMISSIONS-SUMMARY — total earned per service for a date range
# ============================================================================

@router.get("/{staff_id}/commissions-summary")
def commissions_summary(
    staff_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Returns per-service breakdown of how much this staff earned in commissions over a date range."""
    tid = safe_tid(user, db)

    # Parse dates (default = current month)
    today = date.today()
    if date_from:
        try: dfrom = date.fromisoformat(date_from)
        except Exception: dfrom = today.replace(day=1)
    else:
        dfrom = today.replace(day=1)
    if date_to:
        try: dto = date.fromisoformat(date_to)
        except Exception: dto = today
    else:
        dto = today

    # Visits attended in range
    v_q = db.query(VisitHistory).filter(
        VisitHistory.staff_id == staff_id,
        VisitHistory.visit_date >= dfrom,
        VisitHistory.visit_date <= dto,
        VisitHistory.status == 'completed',
    )
    if tid:
        v_q = v_q.filter(VisitHistory.tenant_id == tid)
    visits = v_q.all()

    # Commission config per service
    comm_q = db.query(StaffServiceCommission).filter(StaffServiceCommission.staff_id == staff_id)
    if tid:
        comm_q = comm_q.filter(StaffServiceCommission.tenant_id == tid)
    comm_map = {c.service_id: c for c in comm_q.all()}

    # Service info
    svc_ids = list({v.service_id for v in visits if v.service_id})
    svc_map = {s.id: s for s in db.query(Service).filter(Service.id.in_(svc_ids)).all()} if svc_ids else {}

    # Aggregate per service
    by_service = {}
    for v in visits:
        sid = v.service_id
        if sid not in by_service:
            svc = svc_map.get(sid)
            comm = comm_map.get(sid)
            by_service[sid] = {
                "service_id": sid,
                "service_name": svc.name if svc else (v.service_name or "Servicio"),
                "service_price": svc.price if svc else 0,
                "commission_type": (comm.commission_type if comm else "percentage") if comm else "percentage",
                "commission_rate": (comm.commission_rate if comm else 0.0) if comm else 0.0,
                "commission_amount": (comm.commission_amount if comm else 0) if comm else 0,
                "visits": 0,
                "revenue": 0,
                "earned": 0,
            }
        item = by_service[sid]
        item["visits"] += 1
        amt = v.amount or 0
        item["revenue"] += amt
        # Earnings calc per visit
        comm = comm_map.get(sid)
        if comm and comm.commission_type == 'fixed':
            item["earned"] += int(comm.commission_amount or 0)
        else:
            rate = (comm.commission_rate if comm else 0.0) or 0.0
            item["earned"] += int(amt * rate)

    services_list = sorted(by_service.values(), key=lambda x: -x["earned"])

    total_earned = sum(s["earned"] for s in services_list)
    total_revenue = sum(s["revenue"] for s in services_list)

    return {
        "from": dfrom.isoformat(),
        "to": dto.isoformat(),
        "services": services_list,
        "summary": {
            "total_earned": total_earned,
            "total_revenue": total_revenue,
            "total_visits": len(visits),
        },
    }
