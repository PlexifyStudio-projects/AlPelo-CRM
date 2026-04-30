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
    Admin, Checkout, CheckoutItem, CashRegister, CashMovement,
    Appointment, Client, Staff, Service, Tenant,
    VisitHistory, Invoice, InvoiceItem, StaffCommission, StaffServiceCommission,
    Product, InventoryMovement, Expense, StaffPayment,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid, now_colombia

router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class CheckoutItemCreate(BaseModel):
    service_id: Optional[int] = None
    product_id: Optional[int] = None
    service_name: str
    quantity: int = 1
    unit_price: int
    staff_id: Optional[int] = None
    staff_name: Optional[str] = None
    commission: int = 0  # Fixed $ commission for products


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
    payment_details: Optional[dict | list] = None  # for mixto or efectivo
    notes: Optional[str] = None
    receipt_url: Optional[str] = None  # base64 data URI of receipt photo


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
        "service_name": ", ".join(i["service_name"] for i in items) if items else None,
        "items": items,
    }


def _recalculate_register_totals(db: Session, register: CashRegister, tid):
    """Recalculate all totals on a CashRegister from completed checkouts of the day.

    Counts and money amounts are split into services vs products. A line is
    classified as product when service_name starts with "[Producto]" (same
    convention as VisitHistory and StaffPayrollSummary). Both classifications
    are exposed via _register_to_dict so the cuadre can show the same breakdown
    Weibook does (cantidad/total facturado en servicios vs productos)."""
    q = db.query(Checkout).filter(
        Checkout.status == "completed",
        func.date(Checkout.created_at) == register.date,
    )
    q = _tenant_filter(q, Checkout, tid)
    checkouts = q.all()
    checkout_ids = [c.id for c in checkouts]

    register.total_sales = sum(c.total for c in checkouts)
    register.total_tips = sum(c.tip for c in checkouts)
    register.total_discounts = sum(c.discount_amount for c in checkouts)
    register.transaction_count = len(checkouts)

    # Stash on the register object (NOT persisted columns) so the serializer
    # can return the service/product split without a schema migration.
    services_count = 0
    products_count = 0
    services_billed = 0
    products_billed = 0
    if checkout_ids:
        items = db.query(CheckoutItem).filter(CheckoutItem.checkout_id.in_(checkout_ids)).all()
        for it in items:
            qty = int(it.quantity or 1)
            line_total = int(it.total or 0)
            is_product = bool((it.service_name or "").startswith("[Producto]"))
            if is_product:
                products_count += qty
                products_billed += line_total
            else:
                services_count += qty
                services_billed += line_total
    register._services_count = services_count
    register._products_count = products_count
    register._services_billed = services_billed
    register._products_billed = products_billed

    # Totals by payment method
    total_cash = 0
    total_nequi = 0
    total_daviplata = 0
    total_transfer = 0
    total_card = 0

    for c in checkouts:
        if c.payment_method == "mixto" and c.payment_details:
            # Mixed payment: iterate sub-payments
            details = c.payment_details if isinstance(c.payment_details, list) else c.payment_details.get("splits", []) if isinstance(c.payment_details, dict) else []
            for detail in details:
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

    # Resolve full client info if we have client_id
    client_document = None
    client_document_type = None
    client_email = None
    if client_id:
        client_obj = db.query(Client).filter(Client.id == client_id).first()
        if client_obj:
            client_name = client_name if data.client_name else client_obj.name
            client_phone = client_phone or client_obj.phone
            client_document = client_obj.document_number
            client_document_type = client_obj.document_type
            client_email = client_obj.email

    # ---- Ensure client_id is not None (visit_history requires it) ----
    if not client_id and client_name:
        # Try to find by name or phone
        if client_phone:
            existing = db.query(Client).filter(Client.tenant_id == tid, Client.phone.ilike(f"%{client_phone.replace('+', '').strip()}%")).first()
        else:
            existing = db.query(Client).filter(Client.tenant_id == tid, Client.name == client_name).first()
        if existing:
            client_id = existing.id
        else:
            # Create a minimal client record
            import random, string
            random_id = "C" + "".join(random.choices(string.digits, k=5))
            new_client = Client(
                tenant_id=tid,
                client_id=random_id,
                name=client_name,
                phone=client_phone or "0000000000",
                is_active=True,
            )
            db.add(new_client)
            db.flush()
            client_id = new_client.id

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
        receipt_url=data.receipt_url,
        created_by=getattr(current_user, "username", None),
        created_at=now_colombia(),
    )
    db.add(checkout)
    db.flush()  # get checkout.id

    # ---- Create CheckoutItems (freeze commission rates at payment time) ----
    for item in data.items:
        item_staff = item.staff_id or staff_id
        item_total = item.unit_price * item.quantity
        # Freeze commission: look up current rate and lock it
        frozen_rate = None
        frozen_amount = None
        if item_staff and item.service_id:
            ssc = db.query(StaffServiceCommission).filter(
                StaffServiceCommission.staff_id == item_staff,
                StaffServiceCommission.service_id == item.service_id,
            ).first()
            if ssc and ssc.commission_rate:
                frozen_rate = ssc.commission_rate
                frozen_amount = int(item_total * ssc.commission_rate)
        # Fallback to staff default rate
        if frozen_rate is None and item_staff:
            sc = db.query(StaffCommission).filter(StaffCommission.staff_id == item_staff).first()
            if sc and sc.default_rate:
                frozen_rate = sc.default_rate
                frozen_amount = int(item_total * sc.default_rate)
        ci = CheckoutItem(
            tenant_id=tid,
            checkout_id=checkout.id,
            service_id=item.service_id,
            service_name=item.service_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item_total,
            staff_id=item_staff,
            staff_name=item.staff_name or staff_name,
            commission_rate=frozen_rate,
            commission_amount=frozen_amount,
        )
        db.add(ci)

    # ---- Deduct product stock ----
    for item in data.items:
        if item.product_id:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                product.stock = max(0, product.stock - item.quantity)
                db.add(InventoryMovement(
                    tenant_id=tid,
                    product_id=item.product_id,
                    movement_type="sale",
                    quantity=-item.quantity,
                    unit_cost=item.unit_price,
                    note=f"Venta checkout #{checkout.id}",
                    reference_id=checkout.id,
                    created_by=getattr(current_user, "username", None),
                ))

    # ---- Auto-create VisitHistory (ONE PER STAFF) ----
    # Group items by staff_id so each staff gets their own visit record
    staff_items: dict[int, list] = {}
    for item in data.items:
        sid = item.staff_id or staff_id
        if not sid:
            continue  # Skip items with no staff (e.g. products without seller)
        if sid not in staff_items:
            staff_items[sid] = []
        staff_items[sid].append(item)

    # Separate services from products
    visit_ids = []
    for sid, items_for_staff in staff_items.items():
        services = [i for i in items_for_staff if not (i.service_name or "").startswith("[Producto]")]
        products = [i for i in items_for_staff if (i.service_name or "").startswith("[Producto]")]

        service_revenue = sum(i.unit_price * i.quantity for i in services)
        product_revenue = sum(i.unit_price * i.quantity for i in products)
        product_commission = sum(i.commission or 0 for i in products)
        service_names = ", ".join(i.service_name for i in services) if services else ", ".join(i.service_name for i in items_for_staff)

        # Build notes with product info for Nómina
        notes_parts = []
        if data.notes:
            notes_parts.append(data.notes)
        if products:
            import json as _json
            prod_data = [{"name": p.service_name.replace("[Producto] ", ""), "qty": p.quantity, "sale": p.unit_price, "comm": p.commission or 0} for p in products]
            notes_parts.append(f"<!--PRODUCTS:{_json.dumps(prod_data)}:PRODUCTS-->")
        if product_commission > 0:
            notes_parts.append(f"[PRODUCT_COMMISSION:{product_commission}]")

        sname = db.query(Staff).filter(Staff.id == sid).first()
        visit = VisitHistory(
            tenant_id=tid,
            client_id=client_id,
            staff_id=sid,
            service_name=service_names,
            amount=service_revenue + product_revenue,
            visit_date=now_colombia().date(),
            status="completed",
            payment_method=data.payment_method,
            is_invoiced=True,
            notes="\n".join(notes_parts) if notes_parts else None,
        )
        db.add(visit)
        db.flush()
        visit_ids.append(visit.id)

    # Distribute tip evenly across staff visits
    if data.tip and visit_ids:
        tip_per_staff = data.tip // len(visit_ids)
        remainder = data.tip - (tip_per_staff * len(visit_ids))
        for idx, vid in enumerate(visit_ids):
            v = db.query(VisitHistory).filter(VisitHistory.id == vid).first()
            if v:
                v.tip = tip_per_staff + (remainder if idx == 0 else 0)

    # Link checkout to first visit (backwards compat)
    if visit_ids:
        checkout.visit_id = visit_ids[0]

    # ---- IVA from tenant config (IVA INCLUIDO en el precio) ----
    tenant = db.query(Tenant).filter(Tenant.id == tid).first() if tid else None
    tax_rate = getattr(tenant, 'default_tax_rate', 0) or 0
    if tax_rate > 0:
        # Price INCLUDES IVA → decompose: base = total / (1 + rate), iva = total - base
        taxable_base = subtotal - discount_amount
        base_amount = round(taxable_base / (1 + tax_rate))
        tax_amount = taxable_base - base_amount
    else:
        base_amount = subtotal - discount_amount
        tax_amount = 0
    invoice_total = subtotal - discount_amount + data.tip  # Client pays same price, IVA is internal

    # ---- Auto-create Invoice + InvoiceItems ----
    invoice_number = _next_invoice_number(db, tid)
    invoice = Invoice(
        tenant_id=tid,
        invoice_number=invoice_number,
        client_id=client_id,
        client_name=client_name,
        client_phone=client_phone,
        client_document=client_document,
        client_document_type=client_document_type,
        client_email=client_email,
        subtotal=base_amount if tax_rate > 0 else subtotal,
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        discount_amount=discount_amount,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total=invoice_total,
        payment_method=data.payment_method,
        status="paid",
        issued_date=now_colombia().date(),
        paid_at=now_colombia(),
        notes=getattr(data, 'notes', None),
    )
    db.add(invoice)
    db.flush()
    checkout.invoice_id = invoice.id

    for item in data.items:
        inv_item = InvoiceItem(
            tenant_id=tid,
            invoice_id=invoice.id,
            service_id=item.service_id,
            service_name=item.service_name,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total=item.unit_price * item.quantity,
            staff_id=item.staff_id or staff_id,
            staff_name=item.staff_name or staff_name,
            visit_id=visit_ids[0] if visit_ids else None,
        )
        db.add(inv_item)

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

    # ---- Register cash movement if paid in cash ----
    cash_amount = 0
    if data.payment_method == 'efectivo':
        cash_amount = total
    elif data.payment_method == 'mixto' and data.payment_details:
        splits = data.payment_details.get('splits', []) if isinstance(data.payment_details, dict) else []
        cash_amount = sum(s.get('amount', 0) for s in splits if s.get('method') == 'efectivo')
    if cash_amount > 0 and tid:
        from database.models import CashMovement
        # Cash received (what the client actually handed over)
        cash_received = cash_amount
        cash_change = 0
        if data.payment_method == 'efectivo' and isinstance(data.payment_details, dict):
            received = data.payment_details.get('received', 0)
            if received and received > total:
                cash_received = received
                cash_change = received - total

        cur_balance = int(db.query(func.coalesce(func.sum(CashMovement.amount), 0)).filter(
            CashMovement.tenant_id == tid
        ).scalar() or 0)

        # Register cash IN (what was received)
        db.add(CashMovement(
            tenant_id=tid,
            movement_type="sale",
            amount=cash_received,
            balance_after=cur_balance + cash_received,
            description=f"Cobro #{checkout.id} — {client_name}",
            reference_type="checkout",
            reference_id=checkout.id,
            created_by=getattr(current_user, "username", None),
        ))

        # Register change OUT (vuelto)
        if cash_change > 0:
            db.add(CashMovement(
                tenant_id=tid,
                movement_type="withdrawal",
                amount=-cash_change,
                balance_after=cur_balance + cash_received - cash_change,
                description=f"Vuelto cobro #{checkout.id} — {client_name}",
                reference_type="checkout",
                reference_id=checkout.id,
                created_by=getattr(current_user, "username", None),
            ))

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

    _void_checkout_cascade(checkout, db, tid)

    db.commit()
    db.refresh(checkout)
    return _checkout_to_dict(checkout)


def _void_checkout_cascade(checkout, db, tid):
    """Full cascade: void checkout + cancel invoice + cancel visits + revert appointment + restore stock."""
    checkout.status = "voided"

    # Cancel linked invoice
    if checkout.invoice_id:
        invoice = db.query(Invoice).filter(Invoice.id == checkout.invoice_id).first()
        if invoice:
            invoice.status = "cancelled"

    # Cancel linked visits
    if checkout.visit_id:
        visit = db.query(VisitHistory).filter(VisitHistory.id == checkout.visit_id).first()
        if visit:
            visit.status = "cancelled"
    # Also cancel any visits created for this checkout (multi-staff)
    if checkout.appointment_id:
        from database.models import Appointment as Appt
        appt = db.query(Appt).filter(Appt.id == checkout.appointment_id).first()
        if appt:
            # Find visits on same date, same client
            related_visits = db.query(VisitHistory).filter(
                VisitHistory.tenant_id == tid,
                VisitHistory.client_id == appt.client_id,
                VisitHistory.visit_date == appt.date,
                VisitHistory.status == "completed",
            ).all()
            for v in related_visits:
                v.status = "cancelled"
            # Revert appointment status
            if appt.status == "paid":
                appt.status = "confirmed"

    # Restore product stock from InventoryMovement records
    sale_movements = db.query(InventoryMovement).filter(
        InventoryMovement.reference_id == checkout.id,
        InventoryMovement.movement_type == "sale",
    )
    if tid:
        sale_movements = sale_movements.filter(InventoryMovement.tenant_id == tid)
    for mov in sale_movements.all():
        product = db.query(Product).filter(Product.id == mov.product_id).first()
        if product:
            product.stock = product.stock + abs(mov.quantity)
        # Create a reversal movement
        db.add(InventoryMovement(
            tenant_id=tid,
            product_id=mov.product_id,
            movement_type="adjustment",
            quantity=abs(mov.quantity),
            unit_cost=mov.unit_cost,
            note=f"Devolucion checkout #{checkout.id}",
            reference_id=checkout.id,
            created_by="system",
        ))


# ============================================================================
# 5b. POST /checkouts/void-by-appointment/{appointment_id}
# ============================================================================

@router.post("/checkouts/void-by-appointment/{appointment_id}")
def void_checkout_by_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    """Void a checkout by its linked appointment_id. Used by Nómina retornar."""
    tid = safe_tid(current_user, db)
    q = db.query(Checkout).filter(Checkout.appointment_id == appointment_id)
    if tid:
        q = q.filter(Checkout.tenant_id == tid)
    checkout = q.first()
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout no encontrado para esta cita")

    if checkout.status == "voided":
        raise HTTPException(status_code=400, detail="Este checkout ya fue anulado")

    _void_checkout_cascade(checkout, db, tid)
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
        # Reopen closed register
        existing.status = "open"
        existing.opening_amount = data.opening_amount
        existing.opened_by = current_user.username if hasattr(current_user, 'username') else "admin"
        from datetime import datetime as dt
        existing.opened_at = dt.utcnow()
        existing.closed_at = None
        existing.counted_cash = None
        existing.discrepancy = None
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "status": "open", "date": str(today), "opening_amount": existing.opening_amount, "message": "Caja reabierta"}

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
    return _register_to_dict(register, db)


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
    # Re-run after refresh so the cached extras (services_count etc.) survive
    _recalculate_register_totals(db, register, tid)
    return _register_to_dict(register, db)


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
    _recalculate_register_totals(db, register, tid)
    return _register_to_dict(register, db)


# ============================================================================
# 8.b PUT /cash-register/responsible — Change cashier mid-session
# ============================================================================

class CashRegisterResponsible(BaseModel):
    opened_by: str  # username of the new responsible person


@router.put("/cash-register/responsible")
def change_register_responsible(
    data: CashRegisterResponsible,
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
        raise HTTPException(status_code=400, detail="No puedes cambiar el responsable de una caja cerrada")

    new_responsible = (data.opened_by or "").strip()
    if not new_responsible:
        raise HTTPException(status_code=400, detail="opened_by es obligatorio")

    register.opened_by = new_responsible
    register.updated_at = now_colombia()
    db.commit()
    db.refresh(register)
    _recalculate_register_totals(db, register, tid)
    return _register_to_dict(register, db)


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

def _compute_register_extras(db: Session, register_date, tid) -> dict:
    """Compute the day's extras that are NOT stored on CashRegister:
    deposits/withdrawals (CashMovement), expenses (Expense), payroll (StaffPayment).
    Returns COP totals split by payment method where relevant.

    cash_real (efectivo en caja al cierre) =
      opening_amount + total_cash + deposits_cash − withdrawals_cash − expenses_cash − payroll_cash
    """
    extras = {
        "deposits_total": 0, "deposits_cash": 0,
        "withdrawals_total": 0, "withdrawals_cash": 0,
        "expenses_total": 0, "expenses_cash": 0,
        "payroll_total": 0, "payroll_cash": 0,
    }

    # Cash movements (deposits + withdrawals + adjustments)
    mvq = db.query(CashMovement).filter(func.date(CashMovement.created_at) == register_date)
    mvq = _tenant_filter(mvq, CashMovement, tid)
    for m in mvq.all():
        amt = int(m.amount or 0)
        if m.movement_type == "deposit":
            extras["deposits_total"] += amt
            extras["deposits_cash"] += amt  # manual deposits are always cash
        elif m.movement_type == "withdrawal":
            extras["withdrawals_total"] += abs(amt)
            extras["withdrawals_cash"] += abs(amt)

    # Business expenses paid today (any method)
    exq = db.query(Expense).filter(Expense.date == register_date, Expense.deleted_at.is_(None))
    exq = _tenant_filter(exq, Expense, tid)
    for e in exq.all():
        amt = int(e.amount or 0)
        extras["expenses_total"] += amt
        if (e.payment_method or "efectivo") == "efectivo":
            extras["expenses_cash"] += amt

    # Staff payments made today
    pyq = db.query(StaffPayment).filter(
        func.date(StaffPayment.paid_at) == register_date,
        StaffPayment.status == "paid",
    )
    pyq = _tenant_filter(pyq, StaffPayment, tid)
    for p in pyq.all():
        amt = int(p.amount or 0)
        extras["payroll_total"] += amt
        if (p.payment_method or "efectivo") == "efectivo":
            extras["payroll_cash"] += amt

    return extras


def _register_to_dict(register: CashRegister, db: Optional[Session] = None) -> dict:
    """Serialize CashRegister + day extras + service/product split + cash_real.

    `db` is optional only for backwards compatibility; pass it to include the
    day extras (deposits/withdrawals/expenses/payroll/cash_real). Without `db`
    the response only has the persisted columns.
    """
    base = {
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
        # Service vs product split (set by _recalculate_register_totals)
        "services_count": getattr(register, "_services_count", 0),
        "products_count": getattr(register, "_products_count", 0),
        "services_billed": getattr(register, "_services_billed", 0),
        "products_billed": getattr(register, "_products_billed", 0),
    }

    if db is not None and register.date is not None:
        extras = _compute_register_extras(db, register.date, register.tenant_id)
        base.update(extras)
        # cash_real = arranque + ventas en efectivo + ingresos manuales − gastos efectivo − retiros − pagos efectivo
        base["cash_real"] = (
            int(register.opening_amount or 0)
            + int(register.total_cash or 0)
            + extras["deposits_cash"]
            - extras["expenses_cash"]
            - extras["withdrawals_cash"]
            - extras["payroll_cash"]
        )

    return base
