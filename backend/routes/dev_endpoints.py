"""
Plexify Studio — Developer/Super Admin endpoints
Manage tenants, billing, usage, and platform-level operations.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from database.connection import get_db
from database.models import (
    Admin, Tenant, UsageMetrics,
    Client, Staff, WhatsAppMessage, WhatsAppConversation
)
from middleware.auth_middleware import get_current_user

router = APIRouter()

DEV_ROLES = ["dev", "super_admin"]


def _require_dev(current_user: Admin):
    """Ensure the current user is a developer/super admin."""
    if current_user.role not in DEV_ROLES:
        raise HTTPException(status_code=403, detail="Developer access required")
    return current_user


# ============================================================================
# DASHBOARD STATS
# ============================================================================

@router.get("/dev/stats")
def dev_stats(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenants = db.query(Tenant).all()
    active_tenants = [t for t in tenants if t.is_active]

    total_messages = sum(t.messages_used for t in tenants)
    mrr = sum(t.monthly_price for t in active_tenants)

    # Get usage metrics for current month
    now = datetime.utcnow()
    current_period = f"{now.year}-{now.month:02d}"
    metrics = db.query(UsageMetrics).filter(UsageMetrics.period == current_period).all()
    total_tokens = sum(m.ai_tokens_used for m in metrics)

    tenant_list = []
    for t in tenants:
        # Count clients and staff for this tenant (for now, all belong to tenant 1)
        client_count = db.query(func.count(Client.id)).scalar() if t.id == 1 else 0
        staff_count = db.query(func.count(Staff.id)).scalar() if t.id == 1 else 0

        tenant_list.append({
            "id": t.id,
            "slug": t.slug,
            "name": t.name,
            "plan": t.plan,
            "messages_used": t.messages_used,
            "messages_limit": t.messages_limit,
            "ai_is_paused": t.ai_is_paused,
            "is_active": t.is_active,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "total_clients": client_count,
            "total_staff": staff_count,
        })

    return {
        "total_tenants": len(tenants),
        "active_tenants": len(active_tenants),
        "total_messages_sent": total_messages,
        "total_ai_tokens": total_tokens,
        "mrr": mrr,
        "tenants": tenant_list,
    }


# ============================================================================
# TENANTS CRUD
# ============================================================================

@router.get("/dev/tenants")
def list_tenants(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    result = []
    for t in tenants:
        client_count = db.query(func.count(Client.id)).scalar() if t.id == 1 else 0
        staff_count = db.query(func.count(Staff.id)).scalar() if t.id == 1 else 0

        result.append({
            "id": t.id,
            "slug": t.slug,
            "name": t.name,
            "business_type": t.business_type,
            "owner_name": t.owner_name,
            "owner_phone": t.owner_phone,
            "owner_email": t.owner_email,
            "plan": t.plan,
            "monthly_price": t.monthly_price,
            "messages_used": t.messages_used,
            "messages_limit": t.messages_limit,
            "ai_name": t.ai_name,
            "ai_is_paused": t.ai_is_paused,
            "is_active": t.is_active,
            "city": t.city,
            "country": t.country,
            "wa_phone_display": t.wa_phone_display,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "total_clients": client_count,
            "total_staff": staff_count,
        })

    return result


@router.post("/dev/tenants")
def create_tenant(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    slug = data.get("slug", "").strip().lower()
    if not slug:
        raise HTTPException(status_code=400, detail="Slug is required")

    existing = db.query(Tenant).filter(Tenant.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Slug '{slug}' already exists")

    PLAN_LIMITS = {"trial": 500, "basic": 2000, "pro": 5000, "premium": 15000}
    PLAN_PRICES = {"trial": 0, "basic": 150000, "pro": 250000, "premium": 400000}
    plan = data.get("plan", "pro")

    tenant = Tenant(
        slug=slug,
        name=data.get("name", slug),
        business_type=data.get("business_type", "peluqueria"),
        owner_name=data.get("owner_name"),
        owner_phone=data.get("owner_phone"),
        owner_email=data.get("owner_email"),
        plan=plan,
        monthly_price=PLAN_PRICES.get(plan, 250000),
        messages_limit=data.get("messages_limit") or PLAN_LIMITS.get(plan, 5000),
        ai_name=data.get("ai_name", "Lina"),
        city=data.get("city"),
        country=data.get("country", "CO"),
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    return {"id": tenant.id, "slug": tenant.slug, "name": tenant.name}


@router.put("/dev/tenants/{tenant_id}")
def update_tenant(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    updatable = [
        "name", "business_type", "owner_name", "owner_phone", "owner_email",
        "plan", "monthly_price", "messages_limit", "ai_name", "ai_personality",
        "city", "country", "booking_url", "address",
        "wa_phone_number_id", "wa_business_account_id", "wa_access_token",
        "wa_webhook_token", "wa_phone_display",
    ]

    for field in updatable:
        if field in data:
            setattr(tenant, field, data[field])

    tenant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tenant)

    return {"ok": True, "id": tenant.id}


# ============================================================================
# TENANT ACTIONS (pause AI, add messages, suspend)
# ============================================================================

@router.post("/dev/tenants/{tenant_id}/toggle-ai")
def toggle_tenant_ai(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.ai_is_paused = data.get("paused", not tenant.ai_is_paused)
    tenant.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "ai_is_paused": tenant.ai_is_paused}


@router.post("/dev/tenants/{tenant_id}/add-messages")
def add_tenant_messages(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    amount = data.get("amount", 5000)
    tenant.messages_limit += amount
    tenant.updated_at = datetime.utcnow()
    db.commit()

    return {
        "ok": True,
        "messages_limit": tenant.messages_limit,
        "messages_used": tenant.messages_used,
        "added": amount,
    }


@router.post("/dev/tenants/{tenant_id}/toggle-active")
def toggle_tenant_active(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.is_active = data.get("active", not tenant.is_active)
    tenant.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "is_active": tenant.is_active}


# ============================================================================
# USAGE & BILLING
# ============================================================================

@router.get("/dev/usage")
def dev_usage(period: str = None, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    if not period:
        now = datetime.utcnow()
        period = f"{now.year}-{now.month:02d}"

    metrics = db.query(UsageMetrics).filter(UsageMetrics.period == period).all()
    tenants = db.query(Tenant).all()
    tenant_map = {t.id: t for t in tenants}

    total_msgs = sum(m.wa_messages_sent + m.wa_messages_received for m in metrics)
    total_tokens = sum(m.ai_tokens_used for m in metrics)

    # Rough cost estimate: Sonnet input ~$3/M, output ~$15/M, assume 60/40 split
    estimated_cost = (total_tokens / 1_000_000) * 8.0  # ~$8 avg per million tokens

    tenant_details = []
    for m in metrics:
        t = tenant_map.get(m.tenant_id)
        tenant_details.append({
            "slug": t.slug if t else "?",
            "name": t.name if t else "?",
            "messages_sent": m.wa_messages_sent,
            "messages_received": m.wa_messages_received,
            "ai_tokens": m.ai_tokens_used,
            "cost_usd": (m.ai_tokens_used / 1_000_000) * 8.0,
        })

    # If no metrics yet, show tenants with their current usage
    if not tenant_details:
        for t in tenants:
            tenant_details.append({
                "slug": t.slug,
                "name": t.name,
                "messages_sent": t.messages_used,
                "messages_received": 0,
                "ai_tokens": 0,
                "cost_usd": 0,
            })
            total_msgs = sum(t.messages_used for t in tenants)

    return {
        "period": period,
        "total_messages": total_msgs,
        "total_tokens": total_tokens,
        "estimated_cost_usd": round(estimated_cost, 2),
        "tenants": tenant_details,
    }


@router.get("/dev/billing")
def dev_billing(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    # For now, generate billing records from tenant data
    tenants = db.query(Tenant).order_by(Tenant.created_at).all()
    records = []

    now = datetime.utcnow()
    for t in tenants:
        if t.monthly_price > 0:
            # Current month
            records.append({
                "id": t.id * 1000 + now.month,
                "tenant_name": t.name,
                "tenant_slug": t.slug,
                "amount": t.monthly_price,
                "period": f"{now.year}-{now.month:02d}",
                "status": "paid" if t.is_active else "pending",
                "payment_method": "transfer",
                "paid_at": t.updated_at.isoformat() if t.is_active and t.updated_at else None,
            })

    return records


# ============================================================================
# TENANT SELF-SERVICE (for logged-in tenant users)
# ============================================================================

@router.get("/tenant/me")
def get_my_tenant(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Returns the tenant info for the currently logged-in user.
    For now, returns the first tenant (AlPelo) for all non-dev users.
    In full multi-tenant, this would look up tenant by user's tenant_id."""

    if user.role in DEV_ROLES:
        # Devs don't belong to a specific tenant
        return {
            "id": 0,
            "slug": "plexify",
            "name": "Plexify Studio",
            "business_type": "saas",
            "plan": "premium",
            "messages_used": 0,
            "messages_limit": 999999,
            "ai_is_paused": False,
            "ai_name": "Lina",
            "currency": "COP",
            "timezone": "America/Bogota",
        }

    # Find the first (and for now, only) tenant
    tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
    if not tenant:
        # Fallback if no tenant exists yet
        return {
            "id": 0,
            "slug": "",
            "name": "Mi Negocio",
            "business_type": "peluqueria",
            "plan": "trial",
            "messages_used": 0,
            "messages_limit": 5000,
            "ai_is_paused": False,
            "ai_name": "Lina",
            "currency": "COP",
            "timezone": "America/Bogota",
        }

    return {
        "id": tenant.id,
        "slug": tenant.slug,
        "name": tenant.name,
        "business_type": tenant.business_type,
        "plan": tenant.plan,
        "messages_used": tenant.messages_used,
        "messages_limit": tenant.messages_limit,
        "ai_is_paused": tenant.ai_is_paused,
        "ai_name": tenant.ai_name,
        "currency": tenant.currency,
        "timezone": tenant.timezone,
        "booking_url": tenant.booking_url,
        "city": tenant.city,
        "logo_url": None,
        "primary_color": "#2D5A3D",
    }
