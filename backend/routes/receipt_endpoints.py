# ============================================================================
# Public Receipt — return a printable view-model for a single sale
# Accessible without auth so customers can open the link from WhatsApp/email
# URL: /api/public/receipt/{ref}
#  · "ref" is either an invoice id or a visit id (we accept both)
# ============================================================================
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional

from database.connection import get_db
from database.models import (
    Tenant, Invoice, InvoiceItem, VisitHistory, Client, Staff,
)

router = APIRouter(tags=["Public Receipt"])


def _build_from_invoice(inv: Invoice, db: Session) -> dict:
    tenant = db.query(Tenant).filter(Tenant.id == inv.tenant_id).first()
    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == inv.id).all()
    items_payload = []
    for it in items:
        staff_name = getattr(it, 'staff_name', None)
        if not staff_name and getattr(it, 'staff_id', None):
            st = db.query(Staff).filter(Staff.id == it.staff_id).first()
            staff_name = st.name if st else None
        qty = it.quantity or 1
        unit_price = it.unit_price or 0
        total = it.total or (qty * unit_price)
        items_payload.append({
            "name": it.service_name or "Servicio",
            "qty": qty,
            "unit_price": unit_price,
            "total": total,
            "staff_name": staff_name,
        })
    client_name = None
    if inv.client_id:
        cli = db.query(Client).filter(Client.id == inv.client_id).first()
        client_name = cli.name if cli else None

    inv_status = (getattr(inv, 'status', '') or '').lower()
    status_label_map = {
        'paid': 'Pagado',
        'sent': 'Emitida',
        'draft': 'Borrador',
        'cancelled': 'Cancelada',
    }
    return {
        "id": inv.id,
        "kind": "invoice",
        "number": getattr(inv, 'invoice_number', None) or getattr(inv, 'pos_full_number', None) or f"#{inv.id}",
        "status": status_label_map.get(inv_status, inv_status.title() or 'Emitida'),
        "issued_at": inv.created_at.isoformat() if inv.created_at else None,
        "items": items_payload,
        "subtotal": getattr(inv, 'subtotal', 0) or sum(i["total"] for i in items_payload),
        "tax": getattr(inv, 'tax_amount', 0) or 0,
        "total": getattr(inv, 'total', 0) or sum(i["total"] for i in items_payload),
        "payment_method": getattr(inv, 'payment_method', None) or None,
        "client_name": client_name or getattr(inv, 'client_name', None),
        "tenant": {
            "name": tenant.name if tenant else None,
            "logo_url": getattr(tenant, 'logo_url', None) if tenant else None,
            "phone": getattr(tenant, 'wa_phone_display', None) or getattr(tenant, 'booking_phone', None) if tenant else None,
            "address": getattr(tenant, 'address', None) if tenant else None,
            "brand_color": getattr(tenant, 'brand_color', None) if tenant else None,
        },
    }


def _build_from_visit(visit: VisitHistory, db: Session) -> dict:
    tenant = db.query(Tenant).filter(Tenant.id == visit.tenant_id).first()
    cli = db.query(Client).filter(Client.id == visit.client_id).first() if visit.client_id else None
    staff = db.query(Staff).filter(Staff.id == visit.staff_id).first() if visit.staff_id else None
    return {
        "id": visit.id,
        "kind": "visit",
        "number": f"V-{visit.id}",
        "status": "Pagado" if (visit.payment_method and visit.status == "completed") else (
            "Completado" if visit.status == "completed" else visit.status.title()
        ),
        "issued_at": visit.created_at.isoformat() if visit.created_at else (visit.visit_date.isoformat() if visit.visit_date else None),
        "items": [{
            "name": visit.service_name or "Servicio",
            "qty": 1,
            "unit_price": visit.amount or 0,
            "total": visit.amount or 0,
            "staff_name": staff.name if staff else None,
        }],
        "subtotal": visit.amount or 0,
        "tax": 0,
        "total": visit.amount or 0,
        "payment_method": visit.payment_method or None,
        "client_name": cli.name if cli else None,
        "tenant": {
            "name": tenant.name if tenant else None,
            "logo_url": getattr(tenant, 'logo_url', None) if tenant else None,
            "phone": getattr(tenant, 'wa_phone_display', None) or getattr(tenant, 'booking_phone', None) if tenant else None,
            "address": getattr(tenant, 'address', None) if tenant else None,
            "brand_color": getattr(tenant, 'brand_color', None) if tenant else None,
        },
    }


@router.get("/public/receipt/{ref}")
def get_public_receipt(ref: int, db: Session = Depends(get_db)):
    """Return printable receipt data — no auth required.
    Tries invoice first; if not found, falls back to visit."""
    inv = db.query(Invoice).filter(Invoice.id == ref).first()
    if inv:
        return _build_from_invoice(inv, db)
    visit = db.query(VisitHistory).filter(VisitHistory.id == ref).first()
    if visit:
        return _build_from_visit(visit, db)
    raise HTTPException(status_code=404, detail="Recibo no encontrado")
