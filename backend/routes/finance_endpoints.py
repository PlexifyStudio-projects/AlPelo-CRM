from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import Optional
import csv
import io

from database.connection import get_db
from database.models import (
    Admin, Staff, Client, VisitHistory, Expense, Invoice, InvoiceItem,
    StaffCommission, Service,
)
from middleware.auth_middleware import get_current_user
from schemas import (
    ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseSummaryItem,
    CommissionConfigResponse, CommissionConfigUpdate, CommissionPayoutItem,
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, InvoiceItemResponse,
    PnLResponse, PaymentMethodItem, ImportResult, UninvoicedVisitResponse,
)

router = APIRouter()


# ============================================================================
# HELPERS
# ============================================================================

def _parse_period(period: str, date_from: Optional[str], date_to: Optional[str]):
    today = datetime.utcnow().date()
    if date_from and date_to:
        return date.fromisoformat(date_from), date.fromisoformat(date_to)
    if period == "today":
        return today, today
    if period == "week":
        return today - timedelta(days=today.weekday()), today
    if period == "year":
        return date(today.year, 1, 1), today
    # month default
    return date(today.year, today.month, 1), today


# ============================================================================
# EXPENSES
# ============================================================================

@router.get("/expenses/", response_model=list[ExpenseResponse])
def list_expenses(
    period: str = Query("month"),
    category: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    start, end = _parse_period(period, date_from, date_to)
    q = db.query(Expense).filter(Expense.date >= start, Expense.date <= end)
    if category:
        q = q.filter(Expense.category == category)
    return q.order_by(Expense.date.desc()).all()


@router.post("/expenses/", response_model=ExpenseResponse)
def create_expense(data: ExpenseCreate, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    expense = Expense(**data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(expense_id: int, data: ExpenseUpdate, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(expense, k, v)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(expense)
    db.commit()
    return {"ok": True}


@router.get("/expenses/summary")
def expenses_summary(
    period: str = Query("month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    start, end = _parse_period(period, date_from, date_to)
    expenses = (
        db.query(Expense)
        .filter(Expense.date >= start, Expense.date <= end)
        .all()
    )
    total = sum(e.amount for e in expenses)
    cat_map = {}
    for e in expenses:
        if e.category not in cat_map:
            cat_map[e.category] = {"total": 0, "count": 0}
        cat_map[e.category]["total"] += e.amount
        cat_map[e.category]["count"] += 1

    items = sorted(
        [
            ExpenseSummaryItem(
                category=c,
                total=info["total"],
                count=info["count"],
                pct_of_total=round((info["total"] / total * 100), 1) if total > 0 else 0,
            )
            for c, info in cat_map.items()
        ],
        key=lambda x: x.total,
        reverse=True,
    )
    return {"total": total, "count": len(expenses), "by_category": items}


# ============================================================================
# COMMISSIONS
# ============================================================================

@router.get("/finances/commissions/config", response_model=list[CommissionConfigResponse])
def list_commission_configs(db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    staff_list = db.query(Staff).filter(Staff.is_active == True).all()
    result = []
    for s in staff_list:
        comm = db.query(StaffCommission).filter(StaffCommission.staff_id == s.id).first()
        result.append(CommissionConfigResponse(
            staff_id=s.id,
            staff_name=s.name,
            default_rate=comm.default_rate if comm else 0.40,
            service_overrides=comm.service_overrides if comm else {},
        ))
    return result


@router.put("/finances/commissions/config/{staff_id}", response_model=CommissionConfigResponse)
def update_commission_config(staff_id: int, data: CommissionConfigUpdate, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    comm = db.query(StaffCommission).filter(StaffCommission.staff_id == staff_id).first()
    if not comm:
        comm = StaffCommission(staff_id=staff_id)
        db.add(comm)

    comm.default_rate = data.default_rate
    comm.service_overrides = data.service_overrides
    db.commit()
    db.refresh(comm)

    return CommissionConfigResponse(
        staff_id=staff.id,
        staff_name=staff.name,
        default_rate=comm.default_rate,
        service_overrides=comm.service_overrides,
    )


@router.get("/finances/commissions/payouts", response_model=list[CommissionPayoutItem])
def get_commission_payouts(
    period: str = Query("month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    start, end = _parse_period(period, date_from, date_to)
    visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(VisitHistory.visit_date >= start, VisitHistory.visit_date <= end)
        .all()
    )

    # Group by staff
    staff_rev = {}
    for v in visits:
        if v.staff_id not in staff_rev:
            staff_rev[v.staff_id] = {"revenue": 0, "count": 0}
        staff_rev[v.staff_id]["revenue"] += v.amount
        staff_rev[v.staff_id]["count"] += 1

    result = []
    for sid, info in staff_rev.items():
        staff = db.query(Staff).filter(Staff.id == sid).first()
        comm = db.query(StaffCommission).filter(StaffCommission.staff_id == sid).first()
        rate = comm.default_rate if comm else 0.40
        commission_amount = int(info["revenue"] * rate)
        result.append(CommissionPayoutItem(
            staff_id=sid,
            staff_name=staff.name if staff else "Desconocido",
            rate=rate,
            total_revenue=info["revenue"],
            commission_amount=commission_amount,
            services_count=info["count"],
        ))

    return sorted(result, key=lambda x: x.commission_amount, reverse=True)


# ============================================================================
# UNINVOICED VISITS
# ============================================================================

@router.get("/finances/uninvoiced-visits", response_model=list[UninvoicedVisitResponse])
def get_uninvoiced_visits(
    client_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """List completed visits that haven't been invoiced yet."""
    q = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(
            (VisitHistory.is_invoiced == False) | (VisitHistory.is_invoiced == None)
        )
    )
    if client_id:
        q = q.filter(VisitHistory.client_id == client_id)
    if date_from:
        q = q.filter(VisitHistory.visit_date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(VisitHistory.visit_date <= date.fromisoformat(date_to))

    visits = q.order_by(VisitHistory.visit_date.desc()).limit(50).all()

    result = []
    for v in visits:
        client = db.query(Client).filter(Client.id == v.client_id).first()
        staff = db.query(Staff).filter(Staff.id == v.staff_id).first()
        result.append(UninvoicedVisitResponse(
            id=v.id,
            client_id=v.client_id,
            client_name=client.name if client else "?",
            staff_name=staff.name if staff else "?",
            service_name=v.service_name,
            amount=v.amount,
            visit_date=v.visit_date,
        ))
    return result


# ============================================================================
# INVOICES
# ============================================================================

@router.get("/invoices/", response_model=list[InvoiceResponse])
def list_invoices(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    q = db.query(Invoice)
    if status:
        q = q.filter(Invoice.status == status)
    invoices = q.order_by(Invoice.issued_date.desc()).all()
    return invoices


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return inv


@router.post("/invoices/", response_model=InvoiceResponse)
def create_invoice(data: InvoiceCreate, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    # Auto-generate invoice number
    last = db.query(Invoice).order_by(Invoice.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    invoice_number = f"FV-{next_num:04d}"

    # Calculate totals
    subtotal = sum(item.unit_price * item.quantity for item in data.items)
    tax_amount = int(subtotal * data.tax_rate)
    total = subtotal + tax_amount

    inv = Invoice(
        invoice_number=invoice_number,
        client_id=data.client_id,
        client_name=data.client_name,
        client_phone=data.client_phone,
        client_document=data.client_document,
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        payment_method=data.payment_method,
        status="draft",
        issued_date=data.issued_date or datetime.utcnow().date(),
        notes=data.notes,
    )
    db.add(inv)
    db.flush()

    for item_data in data.items:
        item = InvoiceItem(
            invoice_id=inv.id,
            service_name=item_data.service_name,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            total=item_data.unit_price * item_data.quantity,
            staff_name=item_data.staff_name,
            visit_id=item_data.visit_id,
        )
        db.add(item)

        # Mark visit as invoiced
        if item_data.visit_id:
            visit = db.query(VisitHistory).filter(VisitHistory.id == item_data.visit_id).first()
            if visit:
                visit.is_invoiced = True

    db.commit()
    db.refresh(inv)
    return inv


@router.put("/invoices/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(invoice_id: int, data: InvoiceUpdate, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(inv, k, v)

    # If marking as paid, set paid_at
    if data.status == "paid" and not inv.paid_at:
        inv.paid_at = datetime.utcnow()

    db.commit()
    db.refresh(inv)
    return inv


@router.delete("/invoices/{invoice_id}")
def cancel_invoice(invoice_id: int, db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    inv.status = "cancelled"
    db.commit()
    return {"ok": True}


# ============================================================================
# P&L & PAYMENT METHODS
# ============================================================================

@router.get("/finances/pnl", response_model=PnLResponse)
def get_pnl(
    period: str = Query("month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    start, end = _parse_period(period, date_from, date_to)

    # Revenue
    visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(VisitHistory.visit_date >= start, VisitHistory.visit_date <= end)
        .all()
    )
    total_revenue = sum(v.amount for v in visits)

    # Expenses
    expenses = (
        db.query(Expense)
        .filter(Expense.date >= start, Expense.date <= end)
        .all()
    )
    total_expenses = sum(e.amount for e in expenses)

    # Commissions
    staff_rev = {}
    for v in visits:
        if v.staff_id not in staff_rev:
            staff_rev[v.staff_id] = 0
        staff_rev[v.staff_id] += v.amount

    total_commissions = 0
    for sid, rev in staff_rev.items():
        comm = db.query(StaffCommission).filter(StaffCommission.staff_id == sid).first()
        rate = comm.default_rate if comm else 0.40
        total_commissions += int(rev * rate)

    net_profit = total_revenue - total_expenses - total_commissions
    margin_pct = round((net_profit / total_revenue * 100), 1) if total_revenue > 0 else 0.0

    return PnLResponse(
        period=period,
        date_from=start.isoformat(),
        date_to=end.isoformat(),
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        total_commissions=total_commissions,
        net_profit=net_profit,
        margin_pct=margin_pct,
    )


@router.get("/finances/payment-methods")
def get_payment_methods(
    period: str = Query("month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    start, end = _parse_period(period, date_from, date_to)
    visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(VisitHistory.visit_date >= start, VisitHistory.visit_date <= end)
        .all()
    )

    method_map = {}
    for v in visits:
        m = v.payment_method or "Sin registrar"
        if m not in method_map:
            method_map[m] = {"count": 0, "total": 0}
        method_map[m]["count"] += 1
        method_map[m]["total"] += v.amount

    grand_total = sum(info["total"] for info in method_map.values()) or 1
    items = sorted(
        [
            PaymentMethodItem(
                method=m,
                count=info["count"],
                total=info["total"],
                pct_of_total=round((info["total"] / grand_total * 100), 1),
            )
            for m, info in method_map.items()
        ],
        key=lambda x: x.total,
        reverse=True,
    )
    return {"items": items}


# ============================================================================
# EXPORT / IMPORT CLIENTS
# ============================================================================

@router.get("/clients/export")
def export_clients(db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    clients = db.query(Client).order_by(Client.name).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Codigo", "Nombre", "Telefono", "Email", "Cumpleanos",
        "Estado", "Visitas", "Total Gastado", "Ticket Promedio",
        "Ultima Visita", "Profesional Preferido", "Tags",
    ])

    for c in clients:
        completed = [v for v in c.visits if v.status == "completed"]
        total_spent = sum(v.amount for v in completed)
        visit_count = len(completed)
        avg_ticket = total_spent // visit_count if visit_count > 0 else 0
        last_visit = max((v.visit_date for v in completed), default=None)
        pref_barber = c.preferred_barber.name if c.preferred_barber else ""
        tags_str = ", ".join(c.tags) if c.tags else ""
        birthday = c.birthday.isoformat() if c.birthday else ""
        status = c.status_override or ("activo" if c.is_active else "inactivo")

        writer.writerow([
            c.id, c.client_id, c.name, c.phone, c.email or "",
            birthday, status, visit_count, total_spent, avg_ticket,
            last_visit.isoformat() if last_visit else "", pref_barber, tags_str,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=clientes.csv"},
    )


@router.post("/clients/import", response_model=ImportResult)
async def import_clients(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: Admin = Depends(get_current_user)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Archivo requerido")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    content = await file.read()

    rows = []
    if ext == "csv":
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    elif ext in ("xlsx", "xls"):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            headers_row = [str(c.value or "").strip() for c in next(ws.iter_rows(min_row=1, max_row=1))]
            for row in ws.iter_rows(min_row=2):
                row_dict = {}
                for i, cell in enumerate(row):
                    if i < len(headers_row):
                        row_dict[headers_row[i]] = str(cell.value or "").strip()
                rows.append(row_dict)
        except ImportError:
            raise HTTPException(status_code=400, detail="Instala openpyxl para importar Excel")
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado. Usa CSV o XLSX")

    imported = 0
    skipped = 0
    errors = []

    # Normalize header keys (case-insensitive lookup)
    def get_val(row, *keys):
        for k in keys:
            for rk in row:
                if rk.lower().strip() == k.lower():
                    return row[rk].strip()
        return ""

    # Get max client_id number
    existing_ids = {c.client_id for c in db.query(Client.client_id).all()}
    max_num = 0
    for cid in existing_ids:
        try:
            num = int("".join(filter(str.isdigit, cid)))
            max_num = max(max_num, num)
        except ValueError:
            pass

    existing_phones = {c.phone for c in db.query(Client.phone).all()}

    for i, row in enumerate(rows):
        try:
            name = get_val(row, "nombre", "name")
            phone = get_val(row, "telefono", "phone", "tel")
            if not name or not phone:
                errors.append(f"Fila {i+2}: nombre o telefono vacio")
                continue

            if phone in existing_phones:
                skipped += 1
                continue

            max_num += 1
            client_id = f"M{max_num:05d}"
            while client_id in existing_ids:
                max_num += 1
                client_id = f"M{max_num:05d}"

            email = get_val(row, "email", "correo") or None
            birthday = None
            bday_str = get_val(row, "cumpleanos", "cumpleaños", "birthday")
            if bday_str:
                try:
                    birthday = date.fromisoformat(bday_str)
                except ValueError:
                    pass

            tags_str = get_val(row, "tags", "etiquetas")
            tags = [t.strip() for t in tags_str.split(",") if t.strip()] if tags_str else []

            client = Client(
                client_id=client_id,
                name=name,
                phone=phone,
                email=email,
                birthday=birthday,
                tags=tags,
                is_active=True,
                accepts_whatsapp=True,
            )
            db.add(client)
            existing_ids.add(client_id)
            existing_phones.add(phone)
            imported += 1
        except Exception as e:
            errors.append(f"Fila {i+2}: {str(e)[:80]}")

    if imported > 0:
        db.commit()

    return ImportResult(imported=imported, skipped=skipped, errors=errors[:20])


# ============================================================================
# ANALYTICS
# ============================================================================

WEEKDAY_NAMES = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]


def _calc_change_pct(current, previous):
    if previous > 0:
        return round(((current - previous) / previous * 100), 1)
    return 100.0 if current > 0 else 0


def _calc_commissions(visits, db):
    staff_rev = {}
    for v in visits:
        if v.staff_id not in staff_rev:
            staff_rev[v.staff_id] = 0
        staff_rev[v.staff_id] += v.amount

    total = 0
    for sid, rev in staff_rev.items():
        comm = db.query(StaffCommission).filter(StaffCommission.staff_id == sid).first()
        rate = comm.default_rate if comm else 0.40
        total += int(rev * rate)
    return total


@router.get("/finances/analytics")
def get_finance_analytics(
    period: str = Query("month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    start, end = _parse_period(period, date_from, date_to)

    # Previous period
    period_days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)

    # Current period visits & expenses
    visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(VisitHistory.visit_date >= start, VisitHistory.visit_date <= end)
        .all()
    )
    expenses = (
        db.query(Expense)
        .filter(Expense.date >= start, Expense.date <= end)
        .all()
    )

    # Previous period visits & expenses
    prev_visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(VisitHistory.visit_date >= prev_start, VisitHistory.visit_date <= prev_end)
        .all()
    )
    prev_expenses = (
        db.query(Expense)
        .filter(Expense.date >= prev_start, Expense.date <= prev_end)
        .all()
    )

    total_revenue = sum(v.amount for v in visits)
    prev_revenue = sum(v.amount for v in prev_visits)
    total_expenses = sum(e.amount for e in expenses)
    prev_expenses_total = sum(e.amount for e in prev_expenses)
    total_commissions = _calc_commissions(visits, db)
    prev_commissions = _calc_commissions(prev_visits, db)
    net_profit = total_revenue - total_expenses - total_commissions
    prev_profit = prev_revenue - prev_expenses_total - prev_commissions

    # Revenue by day
    day_map = {}
    for v in visits:
        d = v.visit_date.isoformat()
        if d not in day_map:
            day_map[d] = {"revenue": 0, "visits": 0}
        day_map[d]["revenue"] += v.amount
        day_map[d]["visits"] += 1
    revenue_by_day = sorted(
        [
            {
                "date": d,
                "revenue": info["revenue"],
                "visits": info["visits"],
                "avg_ticket": info["revenue"] // info["visits"] if info["visits"] else 0,
            }
            for d, info in day_map.items()
        ],
        key=lambda x: x["date"],
    )

    # Best day / busiest day
    best_day_date = None
    best_day_revenue = 0
    busiest_day_date = None
    busiest_day_visits = 0
    for entry in revenue_by_day:
        if entry["revenue"] > best_day_revenue:
            best_day_revenue = entry["revenue"]
            best_day_date = entry["date"]
        if entry["visits"] > busiest_day_visits:
            busiest_day_visits = entry["visits"]
            busiest_day_date = entry["date"]

    # Revenue by staff
    staff_map = {}
    for v in visits:
        if v.staff_id not in staff_map:
            staff_map[v.staff_id] = {"revenue": 0, "count": 0}
        staff_map[v.staff_id]["revenue"] += v.amount
        staff_map[v.staff_id]["count"] += 1
    revenue_by_staff = []
    for sid, info in staff_map.items():
        staff = db.query(Staff).filter(Staff.id == sid).first()
        revenue_by_staff.append({
            "staff_id": sid,
            "staff_name": staff.name if staff else "Desconocido",
            "revenue": info["revenue"],
            "count": info["count"],
            "avg_ticket": info["revenue"] // info["count"] if info["count"] else 0,
            "pct_of_total": round((info["revenue"] / total_revenue * 100), 1) if total_revenue > 0 else 0,
        })
    revenue_by_staff.sort(key=lambda x: x["revenue"], reverse=True)

    # Revenue by service (with category lookup)
    svc_map = {}
    for v in visits:
        sn = v.service_name or "Sin servicio"
        if sn not in svc_map:
            svc_map[sn] = {"revenue": 0, "count": 0}
        svc_map[sn]["revenue"] += v.amount
        svc_map[sn]["count"] += 1
    revenue_by_service = []
    for sn, info in svc_map.items():
        svc = db.query(Service).filter(Service.name == sn).first()
        category = svc.category if svc else "Otros"
        revenue_by_service.append({
            "service_name": sn,
            "category": category,
            "revenue": info["revenue"],
            "count": info["count"],
            "pct_of_total": round((info["revenue"] / total_revenue * 100), 1) if total_revenue > 0 else 0,
        })
    revenue_by_service.sort(key=lambda x: x["revenue"], reverse=True)

    # Revenue by category
    cat_map = {}
    for item in revenue_by_service:
        cat = item["category"]
        if cat not in cat_map:
            cat_map[cat] = {"revenue": 0, "count": 0}
        cat_map[cat]["revenue"] += item["revenue"]
        cat_map[cat]["count"] += item["count"]
    revenue_by_category = sorted(
        [
            {
                "category": cat,
                "revenue": info["revenue"],
                "count": info["count"],
                "pct_of_total": round((info["revenue"] / total_revenue * 100), 1) if total_revenue > 0 else 0,
            }
            for cat, info in cat_map.items()
        ],
        key=lambda x: x["revenue"],
        reverse=True,
    )

    # Revenue by weekday
    wd_map = {}
    for v in visits:
        wd = v.visit_date.weekday()
        if wd not in wd_map:
            wd_map[wd] = {"revenue": 0, "visits": 0}
        wd_map[wd]["revenue"] += v.amount
        wd_map[wd]["visits"] += 1
    revenue_by_weekday = sorted(
        [
            {
                "weekday": wd,
                "weekday_name": WEEKDAY_NAMES[wd],
                "revenue": info["revenue"],
                "visits": info["visits"],
            }
            for wd, info in wd_map.items()
        ],
        key=lambda x: x["weekday"],
    )

    return {
        # Comparison
        "current_revenue": total_revenue,
        "previous_revenue": prev_revenue,
        "revenue_change_pct": _calc_change_pct(total_revenue, prev_revenue),
        "current_expenses": total_expenses,
        "previous_expenses": prev_expenses_total,
        "expenses_change_pct": _calc_change_pct(total_expenses, prev_expenses_total),
        "current_profit": net_profit,
        "previous_profit": prev_profit,
        "profit_change_pct": _calc_change_pct(net_profit, prev_profit),
        "current_visits": len(visits),
        "previous_visits": len(prev_visits),
        "visits_change_pct": _calc_change_pct(len(visits), len(prev_visits)),
        "current_avg_ticket": total_revenue // len(visits) if visits else 0,
        "previous_avg_ticket": prev_revenue // len(prev_visits) if prev_visits else 0,
        # Breakdowns
        "revenue_by_day": revenue_by_day,
        "revenue_by_staff": revenue_by_staff,
        "revenue_by_service": revenue_by_service,
        "revenue_by_category": revenue_by_category,
        "revenue_by_weekday": revenue_by_weekday,
        # Insights
        "best_day_date": best_day_date,
        "best_day_revenue": best_day_revenue,
        "busiest_day_date": busiest_day_date,
        "busiest_day_visits": busiest_day_visits,
        "unique_clients": len(set(v.client_id for v in visits if v.client_id)),
        "avg_ticket": total_revenue // len(visits) if visits else 0,
        "total_revenue": total_revenue,
        "total_visits": len(visits),
        "total_expenses": total_expenses,
        "total_commissions": total_commissions,
        "net_profit": net_profit,
        "margin_pct": round((net_profit / total_revenue * 100), 1) if total_revenue > 0 else 0,
    }


# ============================================================================
# EXPORT TRANSACTIONS
# ============================================================================

@router.get("/finances/export")
def export_transactions(
    period: str = Query("month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    start, end = _parse_period(period, date_from, date_to)
    visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(VisitHistory.visit_date >= start, VisitHistory.visit_date <= end)
        .order_by(VisitHistory.visit_date.desc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Fecha", "Cliente", "Servicio", "Profesional", "Monto", "Metodo de Pago"])

    for v in visits:
        client = db.query(Client).filter(Client.id == v.client_id).first()
        staff = db.query(Staff).filter(Staff.id == v.staff_id).first()
        writer.writerow([
            v.visit_date.isoformat(),
            client.name if client else "Desconocido",
            v.service_name or "",
            staff.name if staff else "Desconocido",
            v.amount,
            v.payment_method or "Sin registrar",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=transacciones_{start}_{end}.csv"},
    )
