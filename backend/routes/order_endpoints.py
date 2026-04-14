from typing import List, Optional
from datetime import datetime, date, timedelta

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from database.connection import get_db
from database.models import Order, OrderItem, OrderProduct, Client, Staff, Service, Product
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid, now_colombia

router = APIRouter(prefix="/api/orders", tags=["Orders"])

# ─── Helpers ──────────────────────────────────────────────

def _next_ticket(db: Session, tid: int) -> str:
    last = db.query(func.max(Order.id)).filter(Order.tenant_id == tid).scalar() or 0
    return f"T-{last + 1:04d}"


def _order_to_dict(o: Order) -> dict:
    staff_name = None
    if o.staff_id:
        from sqlalchemy.orm import Session as S
        s = object.__getattribute__(o, '_sa_instance_state').session
        if s:
            st = s.query(Staff).filter(Staff.id == o.staff_id).first()
            staff_name = st.name if st else None

    return {
        "id": o.id,
        "tenant_id": o.tenant_id,
        "ticket_number": o.ticket_number,
        "client_id": o.client_id,
        "client_name": o.client_name,
        "client_phone": o.client_phone or "",
        "client_email": o.client_email or "",
        "client_doc_type": o.client_doc_type or "",
        "client_doc_number": o.client_doc_number or "",
        "staff_id": o.staff_id,
        "staff_name": staff_name,
        "status": o.status,
        "arrival_time": o.arrival_time.isoformat() if o.arrival_time else None,
        "service_date": (o.service_date.isoformat() if o.service_date
                         else (o.arrival_time + timedelta(hours=-5)).strftime('%Y-%m-%d') if o.arrival_time and not o.service_date else None),
        "service_time": (o.service_time if o.service_time
                         else (o.arrival_time + timedelta(hours=-5)).strftime('%H:%M') if o.arrival_time and not o.service_time else None),
        "service_start_time": o.service_start_time.isoformat() if o.service_start_time else None,
        "service_end_time": o.service_end_time.isoformat() if o.service_end_time else None,
        "subtotal": o.subtotal,
        "discount_type": o.discount_type,
        "discount_value": o.discount_value,
        "discount_amount": o.discount_amount,
        "tip": o.tip,
        "total": o.total,
        "payment_method": o.payment_method,
        "payment_status": o.payment_status,
        "commission_rate": o.commission_rate,
        "commission_amount": o.commission_amount,
        "notes": o.notes,
        "created_by": o.created_by,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
        "items": [
            {
                "id": i.id,
                "service_id": i.service_id,
                "service_name": i.service_name,
                "staff_id": i.staff_id,
                "price": i.price,
                "duration_minutes": i.duration_minutes,
            }
            for i in (o.items or [])
        ],
        "products": [
            {
                "id": p.id,
                "product_id": p.product_id,
                "product_name": p.product_name,
                "quantity": p.quantity,
                "unit_price": p.unit_price,
                "total": p.total,
                "charged_to": p.charged_to,
            }
            for p in (o.products or [])
        ],
    }


# ─── LIST ─────────────────────────────────────────────────

@router.get("/")
def list_orders(
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tid = safe_tid(user, db)
    q = db.query(Order)
    if tid:
        q = q.filter(Order.tenant_id == tid)

    if status:
        q = q.filter(Order.status == status)

    if date_from:
        q = q.filter(Order.arrival_time >= datetime.fromisoformat(date_from))
    if date_to:
        dt_to = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59)
        q = q.filter(Order.arrival_time <= dt_to)

    if search:
        term = f"%{search}%"
        digits = ''.join(c for c in search if c.isdigit())
        conditions = [
            Order.ticket_number.ilike(term),
            Order.client_name.ilike(term),
        ]
        if digits:
            conditions.append(Order.client_phone.ilike(f"%{digits}%"))
            # Also match ticket by digits only (e.g. search "M8824" finds ticket "8824")
            conditions.append(Order.ticket_number.ilike(f"%{digits}%"))
        q = q.filter(or_(*conditions))

    total = q.count()
    orders = q.order_by(Order.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"orders": [_order_to_dict(o) for o in orders], "total": total, "page": page, "pages": (total + limit - 1) // limit}


# ─── GET ──────────────────────────────────────────────────

@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    o = db.query(Order).filter(Order.id == order_id)
    if tid:
        o = o.filter(Order.tenant_id == tid)
    o = o.first()
    if not o:
        raise HTTPException(404, "Orden no encontrada")
    return _order_to_dict(o)


# ─── CREATE ───────────────────────────────────────────────

@router.post("/")
def create_order(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(400, "Tenant requerido")

    ticket = data.get("ticket_number", "").strip() or _next_ticket(db, tid)

    # Find or create client
    client_id = data.get("client_id")
    client_name = data.get("client_name", "").strip()
    client_phone = data.get("client_phone", "").strip()

    if not client_name:
        raise HTTPException(400, "Nombre del cliente requerido")

    if not client_id and client_phone:
        existing = db.query(Client).filter(
            Client.tenant_id == tid,
            Client.phone == client_phone
        ).first()
        if existing:
            client_id = existing.id
        else:
            last_c = db.query(Client).order_by(Client.id.desc()).first()
            next_num = (last_c.id + 1) if last_c else 1
            new_client = Client(
                tenant_id=tid,
                client_id=f"C{next_num:05d}",
                name=client_name,
                phone=client_phone,
                email=data.get("client_email", ""),
                is_active=True,
            )
            db.add(new_client)
            db.flush()
            client_id = new_client.id

    order = Order(
        tenant_id=tid,
        ticket_number=ticket,
        client_id=client_id,
        client_name=client_name,
        client_phone=client_phone,
        client_email=data.get("client_email", ""),
        client_doc_type=data.get("client_doc_type", ""),
        client_doc_number=data.get("client_doc_number", ""),
        staff_id=data.get("staff_id"),
        status="pending",
        arrival_time=now_colombia(),
        service_date=data.get("service_date"),
        service_time=data.get("service_time"),
        notes=data.get("notes", ""),
        created_by=user.username if hasattr(user, 'username') else str(user.id),
    )
    db.add(order)
    db.flush()

    # Add services
    subtotal = 0
    for item in data.get("items", []):
        svc = db.query(Service).filter(Service.id == item.get("service_id")).first() if item.get("service_id") else None
        oi = OrderItem(
            tenant_id=tid,
            order_id=order.id,
            service_id=item.get("service_id"),
            service_name=item.get("service_name") or (svc.name if svc else "Servicio"),
            staff_id=item.get("staff_id"),
            price=item.get("price") or (svc.price if svc else 0),
            duration_minutes=item.get("duration_minutes") or (svc.duration_minutes if svc else 30),
        )
        subtotal += oi.price
        db.add(oi)

    # Add products
    for prod in data.get("products", []):
        p = db.query(Product).filter(Product.id == prod.get("product_id")).first() if prod.get("product_id") else None
        qty = prod.get("quantity", 1)
        unit = prod.get("unit_price") or (p.price if p else 0)
        op = OrderProduct(
            tenant_id=tid,
            order_id=order.id,
            product_id=prod.get("product_id"),
            product_name=prod.get("product_name") or (p.name if p else "Producto"),
            quantity=qty,
            unit_price=unit,
            total=qty * unit,
            charged_to=prod.get("charged_to", "client"),
        )
        subtotal += op.total if op.charged_to == "client" else 0
        db.add(op)

    order.subtotal = subtotal
    order.total = subtotal
    db.commit()
    db.refresh(order)
    return _order_to_dict(order)


# ─── UPDATE ───────────────────────────────────────────────

@router.put("/{order_id}")
def update_order(order_id: int, data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    o = db.query(Order).filter(Order.id == order_id)
    if tid:
        o = o.filter(Order.tenant_id == tid)
    o = o.first()
    if not o:
        raise HTTPException(404, "Orden no encontrada")

    # Update simple fields
    for field in ["ticket_number", "service_date", "service_time", "client_name", "client_phone", "client_email", "client_doc_type",
                  "client_doc_number", "staff_id", "status", "notes", "payment_method",
                  "payment_status", "tip", "discount_type", "discount_value",
                  "commission_rate", "commission_amount"]:
        if field in data:
            setattr(o, field, data[field])

    if data.get("status") == "in_progress" and not o.service_start_time:
        o.service_start_time = now_colombia()
    if data.get("status") == "completed" and not o.service_end_time:
        o.service_end_time = now_colombia()

    # Replace items if provided
    if "items" in data:
        for old in o.items:
            db.delete(old)
        subtotal = 0
        for item in data["items"]:
            svc = db.query(Service).filter(Service.id == item.get("service_id")).first() if item.get("service_id") else None
            oi = OrderItem(
                tenant_id=o.tenant_id,
                order_id=o.id,
                service_id=item.get("service_id"),
                service_name=item.get("service_name") or (svc.name if svc else "Servicio"),
                staff_id=item.get("staff_id"),
                price=item.get("price") or (svc.price if svc else 0),
                duration_minutes=item.get("duration_minutes") or (svc.duration_minutes if svc else 30),
            )
            subtotal += oi.price
            db.add(oi)
        # Re-add product totals for client-charged
        for p in o.products:
            if p.charged_to == "client":
                subtotal += p.total
        o.subtotal = subtotal

    # Replace products if provided
    if "products" in data:
        for old in o.products:
            db.delete(old)
        prod_client_total = 0
        for prod in data["products"]:
            p = db.query(Product).filter(Product.id == prod.get("product_id")).first() if prod.get("product_id") else None
            qty = prod.get("quantity", 1)
            unit = prod.get("unit_price") or (p.price if p else 0)
            op = OrderProduct(
                tenant_id=o.tenant_id,
                order_id=o.id,
                product_id=prod.get("product_id"),
                product_name=prod.get("product_name") or (p.name if p else "Producto"),
                quantity=qty,
                unit_price=unit,
                total=qty * unit,
                charged_to=prod.get("charged_to", "client"),
            )
            if op.charged_to == "client":
                prod_client_total += op.total
            db.add(op)
        # Recalculate subtotal: service items + client-charged products
        svc_total = sum(i.price for i in o.items) if "items" not in data else sum(
            item.get("price", 0) for item in data.get("items", []))
        o.subtotal = svc_total + prod_client_total

    # Recalculate total
    discount = 0
    if o.discount_type == "percent" and o.discount_value:
        discount = int(o.subtotal * o.discount_value / 100)
    elif o.discount_type == "fixed" and o.discount_value:
        discount = int(o.discount_value)
    o.discount_amount = discount
    o.total = max(0, o.subtotal - discount + (o.tip or 0))

    db.commit()
    db.refresh(o)
    return _order_to_dict(o)


# ─── DELETE ───────────────────────────────────────────────

@router.delete("/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    o = db.query(Order).filter(Order.id == order_id)
    if tid:
        o = o.filter(Order.tenant_id == tid)
    o = o.first()
    if not o:
        raise HTTPException(404, "Orden no encontrada")
    db.delete(o)
    db.commit()
    return {"detail": "Orden eliminada"}
