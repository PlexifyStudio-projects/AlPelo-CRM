# ============================================================================
# Plexify Studio — POS (Smart Checkout + Cash Register) Endpoints
# ============================================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta
from typing import Optional
from pydantic import BaseModel

from database.connection import get_db
from database.models import (
    Admin, Checkout, CheckoutItem, CashRegister,
    Appointment, Client, Staff, Service,
    VisitHistory, Invoice, InvoiceItem, StaffCommission,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid, now_colombia

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class CheckoutItemCreate(BaseModel):
    service_id: Optional[int] = None
    service_name: str
    quantity: int = 1
    unit_price: int
    staff_id: Optional[int] = None
    staff_name: Optional[str] = None


class CheckoutCreate(BaseModel):
    appointment_id: Optional[int] = None
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    staff_id: Optional[int] = None
    staff_name: Optional[str] = None
    items: list[CheckoutItemCreate]
    discount_type: Optional[str] = None  # "percent" or "fixed"
    discount_value: int = 0
    tip: int = 0
    payment_method: str = "efectivo"
    payment_details: Optional[list] = None  # for mixto
    notes: Optional[str] = None


class CashRegisterOpen(BaseModel):
    opening_amount: int = 0


class CashRegisterClose(BaseModel):
    counted_cash: int
    notes: Optional[str] = None


# ============================================================================
# HELPERS
# ============================================================================

def _tenant_filter(query, model, tid):
    """Apply tenant_id filter if the user belongs to a tenant."""
    if tid:
        return query.filter(model.tenant_id == tid)
    return query


def _next_invoice_number(db: Session, tid) -> str:
    """Generate next FV-XXXX invoice number for a tenant."""
    q = db.query(Invoice)
    if tid:
        q = q.filter(Invoice.tenant_id == tid)
    last = q.order_by(Invoice.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    return f"FV-{next_num:04d}"


def _checkout_to_dict(checkout: Checkout) -> dict:
    """Serialize a Checkout + items to dict."""
    items = []
    for item in checkout.items:
        items.append({
            "id": item.id,
            "service_id": item.service_id,
            "service_name": item.service_name,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total": item.total,
            "staff_id": item.staff_id,
            "staff_name": item.staff_name,
        })
    return {
        "id": checkout.id,
        "tenant_id": checkout.tenant_id,
        "appointment_id": checkout.appointment_id,
        "client_id": checkout.client_id,
        "client_name": checkout.client_name,
        "staff_id": checkout.staff_id,
        "staff_name": checkout.staff_name,
        "subtotal": checkout.subtotal,
        "discount_type": checkout.discount_type,
        "discount_value": checkout.discount_value,
        "discount_amount": checkout.discount_amount,
        "tip": checkout.tip,
        "total": checkout.total,
        "payment_method": checkout.payment_method,
        "payment_details": checkout.payment_details,
        "status": checkout.status,
        "notes": checkout.notes,
        "receipt_sent": checkout.receipt_sent,
        "invoice_id": checkout.invoice_id,
        "visit_id": checkout.visit_id,
        "created_by": checkout.created_by,
        "created_at": checkout.created_at.isoformat() if checkout.created_at else None,
        "items": items,
    }


def _recalculate_register_totals(db: Session, register: CashRegister, tid):
    """Recalculate all totals on a CashRegister from completed checkouts of the day."""
    q = db.query(Checkout).filter(
        Checkout.status == "completed",
        func.date(Checkout.created_at) == register.date,
    )
    q = _tenant_filter(q, Checkout, tid)
    checkouts = q.all()

    register.total_sales = sum(c.total for c in checkouts)
    register.total_tips = sum(c.tip for c in checkouts)
    register.total_discounts = sum(c.discount_amount for c in checkouts)
    register.transaction_count = len(checkouts)

    # Totals by payment method
    total_cash = 0
    total_nequi = 0
    total_daviplata = 0
    total_transfer = 0
    total_card = 0

    for c in checkouts:
        if c.payment_method == "mixto" and c.payment_details:
            # Mixed payment: iterate sub-payments
            for detail in c.payment_details:
                amt = detail.get("amount", 0)
                method = detail.get("method", "")
                if method == "efectivo":
                    total_cash += amt
                elif method == "nequi":
                    total_nequi += amt
                elif method == "daviplata":
                    total_daviplata += amt
                elif method == "transferencia":
                    total_transfer += amt
                elif method in ("tarjeta_debito", "tarjeta_credito"):
                    total_card += amt
        else:
            amt = c.total
            if c.payment_method == "efectivo":
                total_cash += amt
            elif c.payment_method == "nequi":
                total_nequi += amt
            elif c.payment_method == "daviplata":
                total_daviplata += amt
            elif c.payment_method == "transferencia":
                total_transfer += amt
            elif c.payment_method in ("tarjeta_debito", "tarjeta_credito"):
                total_card += amt

    register.total_cash = total_cash
    register.total_nequi = total_nequi
    register.total_daviplata = total_daviplata
    register.total_transfer = total_transfer
    register.total_card = total_card


# ============================================================================
# 1. POST /checkout — Create a checkout (main endpoint)
# ============================================================================

@router.post("/checkout")
def create_checkout(
    data: CheckoutCreate,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)

    if not data.items:
        raise HTTPException(status_code=400, detail="Se requiere al menos un servicio")

    # Resolve client info from appointment or direct
    client_id = data.client_id
    client_name = data.client_name or "Cliente"
    staff_id = data.staff_id
    staff_name = data.staff_name
    client_phone = None

    if data.appointment_id:
        appt = db.query(Appointment).filter(Appointment.id == data.appointment_id)
        appt = _tenant_filter(appt, Appointment, tid).first()
        if not appt:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        client_id = client_id or appt.client_id
        client_name = client_name if data.client_name else appt.client_name
        staff_id = staff_id or appt.staff_id
        if appt.staff:
            staff_name = staff_name or appt.staff.name
        client_phone = appt.client_phone

    # Resolve client phone if we have client_id
    if client_id and not client_phone:
        client_obj = db.query(Client).filter(Client.id == client_id).first()
        if client_obj:
            client_name = client_name if data.client_name else client_obj.name
            client_phone = client_obj.phone

    # ---- Calculate pricing ----
    subtotal = sum(item.unit_price * item.quantity for item in data.items)

    discount_amount = 0
    if data.discount_type == "percent" and data.discount_value > 0:
        discount_amount = subtotal * data.discount_value // 100
    elif data.discount_type == "fixed" and data.discount_value > 0:
        discount_amount = min(data.discount_value, subtotal)

    total = subtotal - discount_amount + data.tip

    # ---- Create Checkout ----
    checkout = Checkout(
        tenant_id=tid,
        appointment_id=data.appointment_id,
        client_id=client_id,
        client_name=client_name,
        staff_id=staff_id,
        staff_name=staff_name,
        subtotal=subtotal,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        discount_amount=discount_amount,
        tip=data.tip,
        total=total,
        payment_method=data.payment_method,
        payment_details=data.payment_details,
        status="completed",
        notes=data.notes,
        created_by=getattr(current_user, "username", None),
        created_at=now_colombia(),
    )
    db.add(checkout)
    db.flush()  # get checkout.id

    # ---- Create CheckoutItems ----
    for item in data.items:
        ci = CheckoutItem(
            tenant_id=tid,
            checkout_id=checkout.id,
            service_id=item.service_id,
            service_name=item.service_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.unit_price * item.quantity,
            staff_id=item.staff_id or staff_id,
            staff_name=item.staff_name or staff_name,
        )
        db.add(ci)

    # ---- Auto-create VisitHistory ----
    visit = VisitHistory(
        tenant_id=tid,
        client_id=client_id,
        staff_id=staff_id,
        service_name=", ".join(i.service_name for i in data.items),
        amount=total,
        visit_date=now_colombia().date(),
        status="completed",
        payment_method=data.payment_method,
        is_invoiced=True,
    )
    db.add(visit)
    db.flush()
    checkout.visit_id = visit.id

    # ---- Auto-create Invoice + InvoiceItems ----
    invoice_number = _next_invoice_number(db, tid)
    invoice = Invoice(
        tenant_id=tid,
        invoice_number=invoice_number,
        client_id=client_id,
        client_name=client_name,
        client_phone=client_phone,
        subtotal=subtotal,
        tax_rate=0,
        tax_amount=0,
        total=total,
        payment_method=data.payment_method,
        status="paid",
        issued_date=now_colombia().date(),
        paid_at=now_colombia(),
    )
    db.add(invoice)
    db.flush()
    checkout.invoice_id = invoice.id

    for item in data.items:
        inv_item = InvoiceItem(
            tenant_id=tid,
            invoice_id=invoice.id,
            service_name=item.service_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.unit_price * item.quantity,
            staff_name=item.staff_name or staff_name,
            visit_id=visit.id,
        )
        db.add(inv_item)

    # ---- Auto-create StaffCommission ----
    # Group earnings by staff_id from items
    staff_earnings: dict[int, int] = {}
    for item in data.items:
        sid = item.staff_id or staff_id
        if sid:
            staff_earnings[sid] = staff_earnings.get(sid, 0) + (item.unit_price * item.quantity)

    for sid, earnings in staff_earnings.items():
        # Look up custom commission rate, default to 50%
        commission_config = db.query(StaffCommission).filter(
            StaffCommission.staff_id == sid
        )
        commission_config = _tenant_filter(commission_config, StaffCommission, tid).first()
        rate = commission_config.default_rate if commission_config else 0.50
        commission_amount = int(earnings * rate)

        # Create a visit-linked commission record in visit_history-style
        # StaffCommission is a config table, so we record the payout in visit
        # The commission tracking is handled via the existing finance P&L system
        # which reads from visit_history and staff_commission rates

    # ---- Update Appointment status ----
    if data.appointment_id:
        appt = db.query(Appointment).filter(Appointment.id == data.appointment_id)
        appt = _tenant_filter(appt, Appointment, tid).first()
        if appt:
            appt.status = "paid"
            appt.updated_at = now_colombia()

    # ---- Auto-award loyalty points ----
    if client_id and total > 0:
        try:
            from routes.loyalty_endpoints import award_visit_points
            award_visit_points(db, client_id, total, tid, visit_id=visit.id)
        except Exception as e:
            print(f"[CHECKOUT] Loyalty points error (non-blocking): {e}")

    db.commit()
    db.refresh(checkout)
    return _checkout_to_dict(checkout)


# ============================================================================
# 2. GET /checkouts — List checkouts (today or date range)
# ============================================================================

@router.get("/checkouts")
def list_checkouts(
    date_from: Optional[str] = Query(None, alias="from"),
    date_to: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)

    if date_from and date_to:
        start = date.fromisoformat(date_from)
        end = date.fromisoformat(date_to)
    else:
        # Default: today (Colombia time)
        start = now_colombia().date()
        end = start

    q = db.query(Checkout).filter(
        func.date(Checkout.created_at) >= start,
        func.date(Checkout.created_at) <= end,
    )
    q = _tenant_filter(q, Checkout, tid)
    checkouts = q.order_by(Checkout.created_at.desc()).all()
    return [_checkout_to_dict(c) for c in checkouts]


# ============================================================================
# 3. GET /checkouts/{checkout_id} — Single checkout with items
# ============================================================================

@router.get("/checkouts/{checkout_id}")
def get_checkout(
    checkout_id: int,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    q = db.query(Checkout).filter(Checkout.id == checkout_id)
    q = _tenant_filter(q, Checkout, tid)
    checkout = q.first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout no encontrado")
    return _checkout_to_dict(checkout)


# ============================================================================
# 4. POST /checkouts/{checkout_id}/send-receipt — Send receipt via WhatsApp
# ============================================================================

@router.post("/checkouts/{checkout_id}/send-receipt")
def send_receipt(
    checkout_id: int,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    q = db.query(Checkout).filter(Checkout.id == checkout_id)
    q = _tenant_filter(q, Checkout, tid)
    checkout = q.first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout no encontrado")

    # Get client phone
    phone = None
    if checkout.client_id:
        client = db.query(Client).filter(Client.id == checkout.client_id).first()
        if client:
            phone = client.phone

    if not phone:
        raise HTTPException(status_code=400, detail="El cliente no tiene teléfono registrado")

    # Build receipt message
    items_text = ""
    for item in checkout.items:
        items_text += f"  - {item.service_name} x{item.quantity}: ${item.total:,} COP\n"

    message = (
        f"Recibo de pago\n"
        f"{'=' * 20}\n"
        f"Cliente: {checkout.client_name}\n"
        f"{items_text}"
        f"Subtotal: ${checkout.subtotal:,} COP\n"
    )
    if checkout.discount_amount > 0:
        message += f"Descuento: -${checkout.discount_amount:,} COP\n"
    if checkout.tip > 0:
        message += f"Propina: ${checkout.tip:,} COP\n"
    message += (
        f"TOTAL: ${checkout.total:,} COP\n"
        f"Método: {checkout.payment_method}\n"
        f"{'=' * 20}\n"
        f"Gracias por tu visita!"
    )

    # Send via WhatsApp
    try:
        from routes._helpers import get_wa_token, get_wa_phone_id, normalize_phone
        import httpx

        wa_token = get_wa_token(db, tid)
        phone_id = get_wa_phone_id(db, tid)
        clean_phone = normalize_phone(phone)

        if wa_token and phone_id:
            url = f"https://graph.facebook.com/v21.0/{phone_id}/messages"
            headers = {"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"}
            payload = {
                "messaging_product": "whatsapp",
                "to": clean_phone,
                "type": "text",
                "text": {"body": message},
            }
            resp = httpx.post(url, json=payload, headers=headers, timeout=15)
            if resp.status_code == 200:
                checkout.receipt_sent = True
                db.commit()
                return {"status": "ok", "message": "Recibo enviado por WhatsApp"}
            else:
                raise HTTPException(status_code=502, detail=f"Error de WhatsApp: {resp.text[:200]}")
        else:
            raise HTTPException(status_code=400, detail="WhatsApp no configurado para este tenant")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al enviar recibo: {str(e)[:200]}")


# ============================================================================
# 5. POST /checkouts/{checkout_id}/void — Void a checkout
# ============================================================================

@router.post("/checkouts/{checkout_id}/void")
def void_checkout(
    checkout_id: int,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    q = db.query(Checkout).filter(Checkout.id == checkout_id)
    q = _tenant_filter(q, Checkout, tid)
    checkout = q.first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout no encontrado")

    if checkout.status == "voided":
        raise HTTPException(status_code=400, detail="Este checkout ya fue anulado")

    checkout.status = "voided"

    # Also void the linked invoice
    if checkout.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == checkout.invoice_id).first()
        if invoice:
            invoice.status = "cancelled"

    # Mark linked visit as cancelled
    if checkout.visit_id:
        visit = db.query(VisitHistory).filter(VisitHistory.id == checkout.visit_id).first()
        if visit:
            visit.status = "cancelled"

    # Revert appointment status back to confirmed
    if checkout.appointment_id:
        appt = db.query(Appointment).filter(Appointment.id == checkout.appointment_id).first()
        if appt and appt.status == "paid":
            appt.status = "confirmed"

    db.commit()
    db.refresh(checkout)
    return _checkout_to_dict(checkout)


# ============================================================================
# 6. POST /cash-register/open — Open today's register
# ============================================================================

@router.post("/cash-register/open")
def open_register(
    data: CashRegisterOpen,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    today = now_colombia().date()

    # Check if already open
    existing = db.query(CashRegister).filter(CashRegister.date == today)
    existing = _tenant_filter(existing, CashRegister, tid).first()
    if existing:
        if existing.status == "open":
            raise HTTPException(status_code=400, detail="La caja ya está abierta hoy")
        raise HTTPException(status_code=400, detail="La caja de hoy ya fue cerrada")

    register = CashRegister(
        tenant_id=tid,
        date=today,
        status="open",
        opening_amount=data.opening_amount,
        opened_by=getattr(current_user, "username", None),
        opened_at=now_colombia(),
    )
    db.add(register)
    db.commit()
    db.refresh(register)
    return _register_to_dict(register)


# ============================================================================
# 7. GET /cash-register/today — Today's register status + totals
# ============================================================================

@router.get("/cash-register/today")
def get_today_register(
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    today = now_colombia().date()

    register = db.query(CashRegister).filter(CashRegister.date == today)
    register = _tenant_filter(register, CashRegister, tid).first()
    if not register:
        return {"status": "not_opened", "date": today.isoformat(), "message": "La caja no ha sido abierta hoy"}

    # Recalculate live totals from checkouts
    _recalculate_register_totals(db, register, tid)
    db.commit()
    db.refresh(register)
    return _register_to_dict(register)


# ============================================================================
# 8. POST /cash-register/close — Close today's register
# ============================================================================

@router.post("/cash-register/close")
def close_register(
    data: CashRegisterClose,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    today = now_colombia().date()

    register = db.query(CashRegister).filter(CashRegister.date == today)
    register = _tenant_filter(register, CashRegister, tid).first()
    if not register:
        raise HTTPException(status_code=404, detail="La caja no ha sido abierta hoy")
    if register.status == "closed":
        raise HTTPException(status_code=400, detail="La caja ya fue cerrada hoy")

    # Recalculate all totals from today's checkouts
    _recalculate_register_totals(db, register, tid)

    # Calculate expected cash and discrepancy
    register.expected_cash = register.opening_amount + register.total_cash
    register.counted_cash = data.counted_cash
    register.discrepancy = data.counted_cash - register.expected_cash

    register.status = "closed"
    register.closed_by = getattr(current_user, "username", None)
    register.closed_at = now_colombia()
    register.notes = data.notes
    register.updated_at = now_colombia()

    db.commit()
    db.refresh(register)
    return _register_to_dict(register)


# ============================================================================
# 9. GET /cash-register/history — Past register sessions
# ============================================================================

@router.get("/cash-register/history")
def register_history(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    q = db.query(CashRegister)
    q = _tenant_filter(q, CashRegister, tid)
    total = q.count()
    registers = q.order_by(CashRegister.date.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [_register_to_dict(r) for r in registers],
    }


# ============================================================================
# SERIALIZER — CashRegister
# ============================================================================

def _register_to_dict(register: CashRegister) -> dict:
    return {
        "id": register.id,
        "tenant_id": register.tenant_id,
        "date": register.date.isoformat() if register.date else None,
        "status": register.status,
        "opening_amount": register.opening_amount,
        "opened_by": register.opened_by,
        "opened_at": register.opened_at.isoformat() if register.opened_at else None,
        "expected_cash": register.expected_cash,
        "counted_cash": register.counted_cash,
        "discrepancy": register.discrepancy,
        "closed_by": register.closed_by,
        "closed_at": register.closed_at.isoformat() if register.closed_at else None,
        "total_sales": register.total_sales,
        "total_cash": register.total_cash,
        "total_nequi": register.total_nequi,
        "total_daviplata": register.total_daviplata,
        "total_transfer": register.total_transfer,
        "total_card": register.total_card,
        "total_tips": register.total_tips,
        "total_discounts": register.total_discounts,
        "transaction_count": register.transaction_count,
        "notes": register.notes,
    }
