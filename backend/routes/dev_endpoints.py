"""
Plexify Studio — Developer/Super Admin endpoints
Manage tenants, billing, usage, and platform-level operations.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from datetime import datetime, timedelta, date
import os, sys, platform, json, time

import httpx
import traceback as tb_module
from auth.security import hash_password

from database.connection import get_db, SessionLocal
from database.models import (
    Admin, Tenant, UsageMetrics, PlatformConfig,
    Client, Staff, WhatsAppMessage, WhatsAppConversation,
    Appointment, Service, VisitHistory, ClientNote,
    Location, StaffLocation, BusinessProspect, ErrorLog, AIProvider,
)
from middleware.auth_middleware import get_current_user

router = APIRouter()

DEV_ROLES = ["dev", "super_admin"]

# ============================================================================
# PLAN PACKAGES — Pricing & limits
# ============================================================================
PLANS = {
    "starter": {"name": "Starter", "price": 190000, "messages": 1000, "automations": 10},
    "pro": {"name": "Pro", "price": 390000, "messages": 3000, "automations": 25},
    "business": {"name": "Business", "price": 590000, "messages": 5000, "automations": 50},
    "custom": {"name": "Custom", "price": 0, "messages": 0, "automations": 999},
}

RECARGAS = [
    {"id": "recarga_1000", "name": "1,000 mensajes", "messages": 1000, "price": 80000},
    {"id": "recarga_3000", "name": "3,000 mensajes", "messages": 3000, "price": 200000},
]


@router.get("/dev/plans")
def get_plans(user: Admin = Depends(get_current_user)):
    _require_dev(user)
    return {"plans": PLANS, "recargas": RECARGAS}


def _require_dev(current_user: Admin):
    """Ensure the current user is a developer/super admin."""
    if current_user.role not in DEV_ROLES:
        raise HTTPException(status_code=403, detail="Developer access required")
    return current_user


def _safe_tenant_dict(t, db=None):
    """Build a tenant dict safely. All queries scoped to this tenant only."""
    client_count = 0
    staff_count = 0
    admin_user = None

    if db:
        try:
            client_count = db.query(func.count(Client.id)).filter(Client.tenant_id == t.id).scalar() or 0
        except Exception:
            pass
        try:
            staff_count = db.query(func.count(Staff.id)).filter(Staff.tenant_id == t.id).scalar() or 0
        except Exception:
            pass

        # Find admin user ONLY by tenant_id — no fallback guessing
        try:
            admin = db.query(Admin).filter(
                Admin.tenant_id == t.id,
                Admin.role != 'dev',
            ).first()
            if admin:
                admin_user = {"id": admin.id, "username": admin.username, "name": admin.name, "email": admin.email}
        except Exception:
            pass

    # ALWAYS use persistent counter — never count from messages (those get deleted with chats)
    messages_used = getattr(t, 'messages_used', 0)

    return {
        "id": t.id,
        "slug": t.slug,
        "name": t.name,
        "business_type": getattr(t, 'business_type', 'peluqueria'),
        "owner_name": getattr(t, 'owner_name', None),
        "owner_phone": getattr(t, 'owner_phone', None),
        "owner_email": getattr(t, 'owner_email', None),
        "plan": getattr(t, 'plan', 'standard'),
        "monthly_price": getattr(t, 'monthly_price', 0),
        "messages_used": messages_used,
        "messages_limit": getattr(t, 'messages_limit', 1000),
        "max_automations": getattr(t, 'max_automations', 10),
        "ai_name": getattr(t, 'ai_name', 'Lina'),
        "ai_is_paused": getattr(t, 'ai_is_paused', False),
        "is_active": getattr(t, 'is_active', True),
        "city": getattr(t, 'city', None),
        "country": getattr(t, 'country', 'CO'),
        "wa_phone_display": getattr(t, 'wa_phone_display', None),
        "created_at": t.created_at.isoformat() if getattr(t, 'created_at', None) else None,
        "total_clients": client_count,
        "total_staff": staff_count,
        "admin_user": admin_user,
        "paid_until": getattr(t, 'paid_until', None).isoformat() if getattr(t, 'paid_until', None) else None,
        "days_remaining": (getattr(t, 'paid_until', None) - date.today()).days if getattr(t, 'paid_until', None) else None,
    }


# ============================================================================
# DASHBOARD STATS
# ============================================================================

@router.get("/dev/stats")
def dev_stats(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenants = db.query(Tenant).all()
    active_tenants = [t for t in tenants if getattr(t, 'is_active', True)]

    total_messages = sum(getattr(t, 'messages_used', 0) for t in tenants)
    mrr = sum(getattr(t, 'monthly_price', 0) for t in active_tenants)

    # Get usage metrics for current month
    now = datetime.utcnow()
    current_period = f"{now.year}-{now.month:02d}"
    metrics = db.query(UsageMetrics).filter(UsageMetrics.period == current_period).all()
    total_tokens = sum(m.ai_tokens_used for m in metrics)

    tenant_list = [_safe_tenant_dict(t, db) for t in tenants]

    # Additional KPIs
    total_clients = db.query(func.count(Client.id)).scalar()
    total_staff = db.query(func.count(Staff.id)).scalar()
    total_conversations = db.query(func.count(WhatsAppConversation.id)).scalar()
    total_appointments = db.query(func.count(Appointment.id)).scalar()

    # Today's activity
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    msgs_today = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.created_at >= today_start
    ).scalar()
    lina_msgs_today = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.sent_by == 'lina_ia',
        WhatsAppMessage.created_at >= today_start
    ).scalar()

    # GLOBAL counts (all time)
    lina_total = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.sent_by == 'lina_ia'
    ).scalar() or 0
    total_wa_messages = db.query(func.count(WhatsAppMessage.id)).scalar() or 0

    # ALL-TIME tokens (sum across all periods)
    all_tokens = db.query(func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0)).scalar() or 0

    # Cost estimate — $5.40/MTok blended (Claude Sonnet: $3 input × 80% + $15 output × 20%)
    BLENDED_RATE = 5.4
    cost_estimate = round((total_tokens / 1_000_000) * BLENDED_RATE, 2)
    cost_all_time = round((all_tokens / 1_000_000) * BLENDED_RATE, 2)

    return {
        "total_tenants": len(tenants),
        "active_tenants": len(active_tenants),
        "total_messages_sent": total_messages,
        "total_wa_messages": total_wa_messages,
        "total_ai_tokens": total_tokens,
        "all_time_tokens": all_tokens,
        "mrr": mrr,
        "total_clients": total_clients,
        "total_staff": total_staff,
        "total_conversations": total_conversations,
        "total_appointments": total_appointments,
        "messages_today": msgs_today,
        "lina_messages_today": lina_msgs_today,
        "lina_total": lina_total,
        "cost_estimate_usd": cost_estimate,
        "cost_all_time_usd": cost_all_time,
        "period": current_period,
        "tenants": tenant_list,
    }


# ============================================================================
# TENANTS CRUD
# ============================================================================

@router.get("/dev/tenants")
def list_tenants(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)
    tenants = db.query(Tenant).order_by(Tenant.created_at.desc()).all()
    return [_safe_tenant_dict(t, db) for t in tenants]


@router.post("/dev/tenants")
def create_tenant(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    slug = (data.get("slug") or "").strip().lower().replace(" ", "-")
    name = (data.get("name") or "").strip()

    if not slug or not name:
        raise HTTPException(status_code=400, detail="Slug y nombre son requeridos")

    existing = db.query(Tenant).filter(Tenant.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe una agencia con slug '{slug}'")

    # Resolve plan → price + messages
    plan_key = data.get("plan", "starter")
    plan_info = PLANS.get(plan_key, PLANS["starter"])
    monthly_price = plan_info["price"] if plan_key != "custom" else int(data.get("monthly_price", 0))
    messages_limit = plan_info["messages"] if plan_key != "custom" else int(data.get("messages_limit", 5000))
    max_automations = plan_info["automations"] if plan_key != "custom" else int(data.get("max_automations", 999))

    tenant = Tenant(
        slug=slug,
        name=name,
        business_type=data.get("business_type", "peluqueria"),
        owner_name=data.get("owner_name"),
        owner_phone=data.get("owner_phone"),
        owner_email=data.get("owner_email"),
        ai_name=data.get("ai_name", "Lina"),
        plan=plan_key,
        monthly_price=monthly_price,
        messages_limit=messages_limit,
        max_automations=max_automations,
        messages_used=0,
        paid_until=date.today() + timedelta(days=31),
        is_active=True,
        ai_is_paused=False,
        timezone=data.get("timezone", "America/Bogota"),
        currency=data.get("currency", "COP"),
        city=data.get("city"),
        country=data.get("country", "CO"),
        booking_url=data.get("booking_url"),
    )

    # WhatsApp config
    if data.get("wa_phone_number_id"):
        tenant.wa_phone_number_id = data["wa_phone_number_id"]
    if data.get("wa_business_account_id"):
        tenant.wa_business_account_id = data["wa_business_account_id"]
    if data.get("wa_access_token"):
        tenant.wa_access_token = data["wa_access_token"]
    if data.get("wa_webhook_token"):
        tenant.wa_webhook_token = data["wa_webhook_token"]
    if data.get("wa_phone_display"):
        tenant.wa_phone_display = data["wa_phone_display"]

    # Validate admin credentials BEFORE creating anything
    admin_username = (data.get("admin_username") or "").strip()
    admin_password = (data.get("admin_password") or "").strip()

    if not admin_username or not admin_password:
        raise HTTPException(status_code=400, detail="Usuario y contraseña del admin son requeridos")

    existing_admin = db.query(Admin).filter(Admin.username == admin_username).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail=f"El usuario '{admin_username}' ya existe")

    # Create both tenant + admin in a single transaction (atomic)
    try:
        db.add(tenant)
        db.flush()  # Get tenant.id without committing

        admin_user = Admin(
            name=data.get("owner_name") or f"Admin {name}",
            email=data.get("owner_email") or f"{slug}@plexify.studio",
            phone=data.get("owner_phone") or "",
            username=admin_username,
            password=hash_password(admin_password),
            role="admin",
            is_active=True,
            tenant_id=tenant.id,
        )
        db.add(admin_user)
        db.commit()
        db.refresh(tenant)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear agencia: {str(e)[:200]}")

    return _safe_tenant_dict(tenant, db)


@router.delete("/dev/tenants/{tenant_id}")
def delete_tenant(tenant_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Delete a tenant and its admin user. Use with caution."""
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Agencia no encontrada")

    # Delete admin users linked to this tenant
    db.query(Admin).filter(Admin.tenant_id == tenant_id, Admin.role != 'dev').delete()
    # Delete the tenant
    db.delete(tenant)
    db.commit()

    return {"ok": True, "message": f"Agencia '{tenant.name}' eliminada"}


@router.put("/dev/tenants/{tenant_id}")
def update_tenant(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Agencia no encontrada")

    allowed_fields = [
        "name", "business_type", "owner_name", "owner_phone", "owner_email",
        "ai_name", "city", "country", "timezone", "currency", "booking_url",
        "wa_phone_number_id", "wa_business_account_id", "wa_access_token",
        "wa_webhook_token", "wa_phone_display",
        "monthly_price", "messages_limit", "max_automations", "plan",
    ]

    # If plan changes, auto-resolve price + messages + automations
    if "plan" in data and data["plan"] in PLANS and data["plan"] != "custom":
        plan_info = PLANS[data["plan"]]
        data["monthly_price"] = plan_info["price"]
        data["messages_limit"] = plan_info["messages"]
        data["max_automations"] = plan_info["automations"]

    for field in allowed_fields:
        if field in data:
            setattr(tenant, field, data[field])

    db.commit()
    db.refresh(tenant)

    return _safe_tenant_dict(tenant, db)


@router.post("/dev/tenants/{tenant_id}/toggle-ai")
def toggle_tenant_ai(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Agencia no encontrada")

    tenant.ai_is_paused = data.get("paused", not tenant.ai_is_paused)
    db.commit()

    return {"ok": True, "ai_is_paused": tenant.ai_is_paused}


@router.post("/dev/tenants/{tenant_id}/add-messages")
def add_tenant_messages(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Agencia no encontrada")

    amount = data.get("amount", 5000)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Cantidad debe ser positiva")

    tenant.messages_limit = (tenant.messages_limit or 0) + amount
    db.commit()

    return {
        "ok": True,
        "messages_limit": tenant.messages_limit,
        "messages_used": tenant.messages_used,
    }


@router.post("/dev/tenants/{tenant_id}/toggle-active")
def toggle_tenant_active(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Agencia no encontrada")

    tenant.is_active = data.get("active", not tenant.is_active)
    db.commit()

    return {"ok": True, "is_active": tenant.is_active}


@router.put("/dev/tenants/{tenant_id}/admin-credentials")
def update_tenant_admin(tenant_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Agencia no encontrada")

    admin = db.query(Admin).filter(Admin.tenant_id == tenant_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="No se encontro usuario admin para esta agencia")

    if data.get("username"):
        # Check uniqueness
        existing = db.query(Admin).filter(Admin.username == data["username"], Admin.id != admin.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username ya existe")
        admin.username = data["username"]

    if data.get("new_password"):
        if len(data["new_password"]) < 6:
            raise HTTPException(status_code=400, detail="Minimo 6 caracteres")
        admin.password = hash_password(data["new_password"])

    if data.get("name"):
        admin.name = data["name"]

    if data.get("email"):
        admin.email = data["email"]

    db.commit()
    db.refresh(admin)

    return {"ok": True, "admin_user": {"id": admin.id, "username": admin.username, "name": admin.name, "email": admin.email}}


@router.get("/dev/tenants/{tenant_id}/admins")
def list_tenant_admins(tenant_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """List all admin users for a tenant."""
    _require_dev(user)
    admins = db.query(Admin).filter(Admin.tenant_id == tenant_id).order_by(Admin.created_at).all()
    return {
        "admins": [
            {
                "id": a.id,
                "username": a.username,
                "name": a.name,
                "email": a.email,
                "role": a.role,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "last_session": a.session_started_at.isoformat() if a.session_started_at else None,
            }
            for a in admins
        ]
    }


@router.put("/dev/tenants/{tenant_id}/admins/{admin_id}/toggle")
def toggle_admin_active(tenant_id: int, admin_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Activate or deactivate an admin user."""
    _require_dev(user)
    admin = db.query(Admin).filter(Admin.id == admin_id, Admin.tenant_id == tenant_id).first()
    if not admin:
        raise HTTPException(404, "Admin no encontrado")
    admin.is_active = not admin.is_active
    # If deactivating, kill their active session
    if not admin.is_active:
        admin.active_session_token = None
    db.commit()
    return {"ok": True, "is_active": admin.is_active, "username": admin.username}


@router.put("/dev/tenants/{tenant_id}/admins/{admin_id}/password")
def reset_admin_password(tenant_id: int, admin_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Reset password for a specific admin user."""
    _require_dev(user)
    admin = db.query(Admin).filter(Admin.id == admin_id, Admin.tenant_id == tenant_id).first()
    if not admin:
        raise HTTPException(404, "Admin no encontrado")
    new_pw = data.get("password", "").strip()
    if len(new_pw) < 6:
        raise HTTPException(400, "Mínimo 6 caracteres")
    admin.password = hash_password(new_pw)
    admin.active_session_token = None  # Force re-login
    db.commit()
    return {"ok": True, "username": admin.username}


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

    estimated_cost = (total_tokens / 1_000_000) * 5.4

    tenant_details = []
    for m in metrics:
        t = tenant_map.get(m.tenant_id)
        tenant_details.append({
            "slug": t.slug if t else "?",
            "name": t.name if t else "?",
            "messages_sent": m.wa_messages_sent,
            "messages_received": m.wa_messages_received,
            "ai_tokens": m.ai_tokens_used,
            "cost_usd": round((m.ai_tokens_used / 1_000_000) * 5.4, 2),
        })

    # If no metrics yet, compute from real WhatsApp messages
    if not tenant_details:
        # Count real messages from DB for the period
        try:
            year, month = period.split("-")
            period_start = datetime(int(year), int(month), 1)
            if int(month) == 12:
                period_end = datetime(int(year) + 1, 1, 1)
            else:
                period_end = datetime(int(year), int(month) + 1, 1)
        except Exception:
            period_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            period_end = datetime.utcnow()

        real_sent = db.query(func.count(WhatsAppMessage.id)).filter(
            WhatsAppMessage.direction == 'outbound',
            WhatsAppMessage.created_at >= period_start,
            WhatsAppMessage.created_at < period_end,
        ).scalar() or 0

        real_received = db.query(func.count(WhatsAppMessage.id)).filter(
            WhatsAppMessage.direction == 'inbound',
            WhatsAppMessage.created_at >= period_start,
            WhatsAppMessage.created_at < period_end,
        ).scalar() or 0

        lina_sent = db.query(func.count(WhatsAppMessage.id)).filter(
            WhatsAppMessage.sent_by == 'lina_ia',
            WhatsAppMessage.created_at >= period_start,
            WhatsAppMessage.created_at < period_end,
        ).scalar() or 0

        # Estimate tokens: ~300 tokens per AI message (input+output average)
        estimated_tokens = lina_sent * 300
        total_msgs = real_sent + real_received
        total_tokens = estimated_tokens
        estimated_cost = (estimated_tokens / 1_000_000) * 5.4

        for t in tenants:
            tenant_details.append({
                "slug": t.slug,
                "name": t.name,
                "messages_sent": real_sent,
                "messages_received": real_received,
                "ai_tokens": estimated_tokens,
                "cost_usd": round((estimated_tokens / 1_000_000) * 5.4, 2),
            })

    return {
        "period": period,
        "total_messages": total_msgs,
        "total_tokens": total_tokens,
        "estimated_cost_usd": round(estimated_cost, 2),
        "tenants": tenant_details,
    }


@router.get("/dev/usage-history")
def dev_usage_history(tenant_id: int = None, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Get ALL monthly usage history — never deleted, persists forever."""
    _require_dev(user)

    q = db.query(UsageMetrics).order_by(UsageMetrics.period.desc())
    if tenant_id:
        q = q.filter(UsageMetrics.tenant_id == tenant_id)
    metrics = q.all()

    tenants = db.query(Tenant).all()
    tenant_map = {t.id: t for t in tenants}

    history = []
    for m in metrics:
        t = tenant_map.get(m.tenant_id)
        tokens = m.ai_tokens_used or 0
        # Cost calculation: with cache ~$0.011 per AI message, tokens / 5500 = approx messages
        cost_usd = round((tokens / 1_000_000) * 5.4, 2)
        history.append({
            "period": m.period,
            "tenant_id": m.tenant_id,
            "tenant_name": t.name if t else "?",
            "tenant_slug": t.slug if t else "?",
            "wa_sent": m.wa_messages_sent,
            "wa_received": m.wa_messages_received,
            "ai_tokens": tokens,
            "campaigns_sent": m.campaigns_sent,
            "cost_usd": cost_usd,
            "cost_cop": round(cost_usd * 4150),
        })

    return {"history": history, "total_months": len(set(m.period for m in metrics))}


@router.get("/dev/billing")
def dev_billing(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    from database.models import BillingRecord
    records = db.query(BillingRecord).order_by(BillingRecord.created_at.desc()).all()
    tenants = db.query(Tenant).all()
    tenant_map = {t.id: t for t in tenants}

    result = []
    for r in records:
        t = tenant_map.get(r.tenant_id)
        result.append({
            "id": r.id,
            "tenant_id": r.tenant_id,
            "tenant_name": t.name if t else "?",
            "tenant_slug": t.slug if t else "?",
            "amount": r.amount,
            "period": r.period,
            "status": r.status,
            "payment_method": r.payment_method,
            "notes": r.notes,
            "paid_at": r.paid_at.isoformat() if r.paid_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return result


@router.post("/dev/billing")
def create_billing_record(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    from database.models import BillingRecord
    tenant_id = data.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id requerido")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Agencia no encontrada")

    record = BillingRecord(
        tenant_id=tenant_id,
        period=data.get("period", f"{datetime.utcnow().year}-{datetime.utcnow().month:02d}"),
        amount=int(data.get("amount", getattr(tenant, 'monthly_price', 0))),
        status=data.get("status", "pending"),
        payment_method=data.get("payment_method"),
        notes=data.get("notes"),
        paid_at=datetime.utcnow() if data.get("status") == "paid" else None,
    )
    db.add(record)

    # If created as paid, extend paid_until
    if record.status == "paid":
        months = int(data.get("months", 1))
        base = getattr(tenant, 'paid_until', None) or date.today()
        if base < date.today():
            base = date.today()
        tenant.paid_until = base + timedelta(days=31 * months)

    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "tenant_name": tenant.name,
        "tenant_slug": tenant.slug,
        "amount": record.amount,
        "period": record.period,
        "status": record.status,
        "payment_method": record.payment_method,
        "notes": record.notes,
        "paid_at": record.paid_at.isoformat() if record.paid_at else None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "paid_until": tenant.paid_until.isoformat() if tenant.paid_until else None,
        "days_remaining": (tenant.paid_until - date.today()).days if tenant.paid_until else None,
    }


@router.put("/dev/billing/{record_id}")
def update_billing_record(record_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    from database.models import BillingRecord
    record = db.query(BillingRecord).filter(BillingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    if "status" in data:
        record.status = data["status"]
        if data["status"] == "paid" and not record.paid_at:
            record.paid_at = datetime.utcnow()
            # Extend tenant's paid_until by the number of months paid
            tenant = db.query(Tenant).filter(Tenant.id == record.tenant_id).first()
            if tenant:
                months = int(data.get("months", 1))
                base = getattr(tenant, 'paid_until', None) or date.today()
                if base < date.today():
                    base = date.today()
                tenant.paid_until = base + timedelta(days=31 * months)
    if "amount" in data:
        record.amount = int(data["amount"])
    if "payment_method" in data:
        record.payment_method = data["payment_method"]
    if "notes" in data:
        record.notes = data["notes"]
    if "period" in data:
        record.period = data["period"]

    db.commit()
    db.refresh(record)

    tenant = db.query(Tenant).filter(Tenant.id == record.tenant_id).first()
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "tenant_name": tenant.name if tenant else "?",
        "tenant_slug": tenant.slug if tenant else "?",
        "amount": record.amount,
        "period": record.period,
        "status": record.status,
        "payment_method": record.payment_method,
        "notes": record.notes,
        "paid_at": record.paid_at.isoformat() if record.paid_at else None,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }


@router.delete("/dev/billing/{record_id}")
def delete_billing_record(record_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    from database.models import BillingRecord
    record = db.query(BillingRecord).filter(BillingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Registro no encontrado")

    db.delete(record)
    db.commit()
    return {"ok": True}


# ============================================================================
# TENANT SELF-SERVICE (for logged-in tenant users)
# ============================================================================

@router.get("/tenant/me")
def get_my_tenant(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    if user.role in DEV_ROLES:
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

    # Find the tenant that THIS user belongs to (by tenant_id, not just any tenant)
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id, Tenant.is_active == True).first() if user.tenant_id else None
    if not tenant:
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

    # Use persistent counter — NEVER count from WhatsAppMessage (those get deleted with chats)
    real_used = getattr(tenant, 'messages_used', 0)

    # Get current month's token usage from usage_metrics
    now = datetime.utcnow()
    current_period = f"{now.year}-{now.month:02d}"
    month_metrics = db.query(UsageMetrics).filter(
        UsageMetrics.tenant_id == tenant.id,
        UsageMetrics.period == current_period,
    ).first()
    ai_tokens_month = month_metrics.ai_tokens_used if month_metrics else 0
    wa_sent_month = month_metrics.wa_messages_sent if month_metrics else 0
    campaigns_month = month_metrics.campaigns_sent if month_metrics else 0

    return {
        "id": tenant.id,
        "slug": tenant.slug,
        "name": tenant.name,
        "business_type": getattr(tenant, 'business_type', 'peluqueria'),
        "plan": getattr(tenant, 'plan', 'standard'),
        "messages_used": real_used,
        "messages_limit": getattr(tenant, 'messages_limit', 5000),
        "ai_is_paused": getattr(tenant, 'ai_is_paused', False),
        "ai_name": getattr(tenant, 'ai_name', 'Lina'),
        "currency": getattr(tenant, 'currency', 'COP'),
        "timezone": getattr(tenant, 'timezone', 'America/Bogota'),
        "booking_url": getattr(tenant, 'booking_url', None),
        "city": getattr(tenant, 'city', None),
        "logo_url": None,
        "primary_color": "#1E40AF",
        # WhatsApp/Meta config (for Settings page)
        "wa_phone_number_id": getattr(tenant, 'wa_phone_number_id', None),
        "wa_business_account_id": getattr(tenant, 'wa_business_account_id', None),
        "wa_access_token": getattr(tenant, 'wa_access_token', None),
        "wa_phone_display": getattr(tenant, 'wa_phone_display', None),
        # Monthly usage stats
        "ai_tokens_month": ai_tokens_month,
        "wa_sent_month": wa_sent_month,
        "campaigns_month": campaigns_month,
        "ai_cost_month_usd": round((ai_tokens_month / 1_000_000) * 5.4, 3) if ai_tokens_month else 0,
    }


# ============================================================================
# ACTIVITY FEED — Real data from DB (WhatsApp messages by Lina + actions)
# ============================================================================

@router.get("/dev/activity")
def dev_activity(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days_ago = now - timedelta(days=7)
    COL_OFFSET = timedelta(hours=-5)  # Colombia = UTC-5

    def to_col_time(dt):
        """Convert UTC datetime to Colombia display string."""
        if not dt:
            return ""
        col = dt + COL_OFFSET
        return f"{col.day:02d}/{col.month:02d} {col.hour:02d}:{col.minute:02d}"

    # Get Lina's recent messages (responses) from DB
    lina_messages = db.query(WhatsAppMessage).filter(
        WhatsAppMessage.sent_by == 'lina_ia',
        WhatsAppMessage.created_at >= seven_days_ago,
    ).order_by(WhatsAppMessage.created_at.desc()).limit(100).all()

    # Get recent actions (notes with ACCION or system events)
    action_notes = db.query(ClientNote).filter(
        ClientNote.created_at >= seven_days_ago,
        ClientNote.content.ilike('%ACCION:%'),
    ).order_by(ClientNote.created_at.desc()).limit(30).all()

    # Get tasks (PENDIENTE notes)
    task_notes = db.query(ClientNote).filter(
        ClientNote.created_at >= seven_days_ago,
        ClientNote.content.ilike('%PENDIENTE%'),
    ).order_by(ClientNote.created_at.desc()).limit(20).all()

    # Build events list
    events = []

    for msg in lina_messages:
        # Find the conversation to get client name
        convo = db.query(WhatsAppConversation).filter(
            WhatsAppConversation.id == msg.conversation_id
        ).first() if msg.conversation_id else None

        client_name = getattr(convo, 'wa_contact_name', None) or "Cliente"

        display_time = to_col_time(msg.created_at)

        events.append({
            "id": f"msg-{msg.id}",
            "type": "respuesta",
            "description": f"Respondio a {client_name}",
            "details": (msg.content or "")[:150],
            "display_time": display_time,
            "contact_name": client_name,
            "timestamp": msg.created_at.isoformat() if msg.created_at else None,
            "status": msg.status or "sent",
        })

    for note in action_notes:
        client = db.query(Client).filter(Client.id == note.client_id).first() if note.client_id else None
        content = (note.content or "").replace("ACCION:", "").strip()
        cname = client.name if client else "Sistema"
        display_time = to_col_time(note.created_at)

        events.append({
            "id": f"act-{note.id}",
            "type": "accion",
            "description": f"Accion para {cname}",
            "details": content[:150],
            "display_time": display_time,
            "contact_name": cname,
            "timestamp": note.created_at.isoformat() if note.created_at else None,
            "status": "done",
        })

    for note in task_notes:
        client = db.query(Client).filter(Client.id == note.client_id).first() if note.client_id else None
        content = (note.content or "").replace("PENDIENTE:", "").strip()
        cname = client.name if client else "Sistema"
        display_time = to_col_time(note.created_at)

        events.append({
            "id": f"task-{note.id}",
            "type": "tarea",
            "description": f"Tarea: {cname}",
            "details": content[:150],
            "display_time": display_time,
            "contact_name": cname,
            "timestamp": note.created_at.isoformat() if note.created_at else None,
            "status": "pending",
        })

    # Sort all events by timestamp desc
    events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)

    # Daily stats
    lina_today = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.sent_by == 'lina_ia',
        WhatsAppMessage.created_at >= today_start,
    ).scalar()
    lina_total_7d = len(lina_messages)
    failed_7d = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.status == 'failed',
        WhatsAppMessage.created_at >= seven_days_ago,
    ).scalar()
    total_convos_7d = db.query(func.count(WhatsAppConversation.id)).filter(
        WhatsAppConversation.last_message_at >= seven_days_ago,
    ).scalar()

    daily_stats = {
        "messages_sent": lina_today,
        "messages_failed": failed_7d,
        "actions_executed": len(action_notes),
        "conversations_replied": total_convos_7d,
        "tasks_completed": len(task_notes),
        "skips": 0,
    }

    # Also try to get in-memory events (for events from current session)
    try:
        from activity_log import get_recent_events
        mem_events = get_recent_events(50)
        if mem_events:
            for e in mem_events:
                events.append({
                    "id": f"mem-{e.get('id', '')}",
                    "type": e.get("type", "sistema"),
                    "description": e.get("summary", ""),
                    "details": e.get("detail", ""),
                    "display_time": e.get("timestamp", "")[-5:] if e.get("timestamp") else "",
                    "contact_name": e.get("contact_name", ""),
                    "timestamp": e.get("timestamp", ""),
                    "status": e.get("status", "ok"),
                })
            events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)
    except Exception:
        pass

    return {"events": events[:100], "daily_stats": daily_stats}


# ============================================================================
# WHATSAPP HEALTH
# ============================================================================

@router.get("/dev/whatsapp-health")
def dev_whatsapp_health(tenant_id: int = None, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    # Get all tenants for the selector
    all_tenants = db.query(Tenant).filter(Tenant.is_active == True).order_by(Tenant.name).all()
    tenants_list = [{"id": t.id, "name": t.name, "slug": t.slug} for t in all_tenants]

    # Determine which tenant to show (None = all)
    tenant = None
    if tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()

    # Build base queries scoped to tenant
    def conv_q():
        q = db.query(func.count(WhatsAppConversation.id))
        if tenant:
            q = q.filter(WhatsAppConversation.tenant_id == tenant.id)
        return q

    def msg_q():
        q = db.query(func.count(WhatsAppMessage.id))
        if tenant:
            q = q.join(WhatsAppConversation, WhatsAppMessage.conversation_id == WhatsAppConversation.id).filter(WhatsAppConversation.tenant_id == tenant.id)
        return q

    total_conversations = conv_q().scalar()
    active_conversations = conv_q().filter(WhatsAppConversation.last_message_at >= week_ago).scalar()
    ai_active_convos = conv_q().filter(WhatsAppConversation.is_ai_active == True).scalar()

    unread_q = db.query(func.coalesce(func.sum(WhatsAppConversation.unread_count), 0))
    if tenant:
        unread_q = unread_q.filter(WhatsAppConversation.tenant_id == tenant.id)
    total_unread = unread_q.scalar()

    total_messages = msg_q().scalar()
    msgs_today = msg_q().filter(WhatsAppMessage.created_at >= today_start).scalar()
    inbound_today = msg_q().filter(WhatsAppMessage.created_at >= today_start, WhatsAppMessage.direction == 'inbound').scalar()
    outbound_today = msg_q().filter(WhatsAppMessage.created_at >= today_start, WhatsAppMessage.direction == 'outbound').scalar()
    lina_msgs_today = msg_q().filter(WhatsAppMessage.created_at >= today_start, WhatsAppMessage.sent_by == 'lina_ia').scalar()
    failed_msgs = msg_q().filter(WhatsAppMessage.status == 'failed').scalar()
    template_count = msg_q().filter(WhatsAppMessage.message_type == 'template').scalar()
    media_count = msg_q().filter(WhatsAppMessage.message_type.in_(['image', 'audio', 'video', 'sticker'])).scalar()

    # Daily breakdown (last 7 days)
    daily_msgs = []
    for i in range(7):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        count = msg_q().filter(WhatsAppMessage.created_at >= day, WhatsAppMessage.created_at < day_end).scalar()
        daily_msgs.append({"date": day.strftime("%Y-%m-%d"), "count": count})

    # Token status
    display_tenant = tenant or (all_tenants[0] if all_tenants else None)
    has_token = bool(display_tenant and getattr(display_tenant, 'wa_access_token', None))

    # Real counter: sum of messages_used across tenants (never resets when chats are deleted)
    if tenant:
        messages_used_total = getattr(tenant, 'messages_used', 0) or 0
    else:
        messages_used_total = sum(getattr(t, 'messages_used', 0) or 0 for t in all_tenants)

    return {
        "tenants": tenants_list,
        "selected_tenant": {"id": tenant.id, "name": tenant.name} if tenant else None,
        "total_conversations": total_conversations,
        "active_conversations_7d": active_conversations,
        "ai_active_conversations": ai_active_convos,
        "total_unread": total_unread,
        "total_messages": total_messages,
        "total_messages_used": messages_used_total,
        "messages_today": msgs_today,
        "inbound_today": inbound_today,
        "outbound_today": outbound_today,
        "lina_responses_today": lina_msgs_today,
        "failed_messages": failed_msgs,
        "template_messages": template_count,
        "media_messages": media_count,
        "daily_messages": daily_msgs,
        "has_wa_token": has_token,
        "wa_phone_display": getattr(display_tenant, 'wa_phone_display', None) if display_tenant else None,
    }


# ============================================================================
# CLIENTS OVERVIEW
# ============================================================================

@router.get("/dev/clients-overview")
def dev_clients_overview(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    total_clients = db.query(func.count(Client.id)).scalar()
    active_clients = db.query(func.count(Client.id)).filter(Client.is_active == True).scalar()

    # Clients created this month
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_this_month = db.query(func.count(Client.id)).filter(Client.created_at >= month_start).scalar()

    # Status breakdown
    vip_count = db.query(func.count(Client.id)).filter(Client.status_override == 'vip').scalar()
    risk_count = db.query(func.count(Client.id)).filter(Client.status_override == 'en_riesgo').scalar()
    inactive_count = db.query(func.count(Client.id)).filter(Client.is_active == False).scalar()

    # Clients with WhatsApp
    wa_clients = db.query(func.count(Client.id)).filter(Client.accepts_whatsapp == True).scalar()

    # Visit stats
    total_visits = db.query(func.count(VisitHistory.id)).scalar()
    visits_this_month = db.query(func.count(VisitHistory.id)).filter(VisitHistory.visit_date >= month_start.date()).scalar()
    total_revenue = db.query(func.coalesce(func.sum(VisitHistory.amount), 0)).scalar()
    revenue_this_month = db.query(func.coalesce(func.sum(VisitHistory.amount), 0)).filter(
        VisitHistory.visit_date >= month_start.date()
    ).scalar()

    # Top clients by visits
    top_clients = db.query(
        Client.name, Client.client_id, func.count(VisitHistory.id).label('visit_count'),
        func.coalesce(func.sum(VisitHistory.amount), 0).label('total_spent')
    ).join(VisitHistory, VisitHistory.client_id == Client.id).group_by(
        Client.id, Client.name, Client.client_id
    ).order_by(desc('total_spent')).limit(10).all()

    top_list = [{"name": c[0], "client_id": c[1], "visits": c[2], "total_spent": c[3]} for c in top_clients]

    # Notes/tasks
    pending_notes = db.query(func.count(ClientNote.id)).filter(ClientNote.content.ilike('%PENDIENTE%')).scalar()

    return {
        "total_clients": total_clients,
        "active_clients": active_clients,
        "new_this_month": new_this_month,
        "vip_count": vip_count,
        "at_risk_count": risk_count,
        "inactive_count": inactive_count,
        "wa_enabled_clients": wa_clients,
        "total_visits": total_visits,
        "visits_this_month": visits_this_month,
        "total_revenue_cop": total_revenue,
        "revenue_this_month_cop": revenue_this_month,
        "top_clients": top_list,
        "pending_tasks": pending_notes,
    }


# ============================================================================
# AI & PLATFORM PERFORMANCE
# ============================================================================

@router.get("/dev/performance")
def dev_performance(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # AI messages by Lina
    total_lina_msgs = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.sent_by == 'lina_ia'
    ).scalar()
    lina_today = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.sent_by == 'lina_ia',
        WhatsAppMessage.created_at >= today_start
    ).scalar()

    # Admin messages
    admin_msgs = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.direction == 'outbound',
        WhatsAppMessage.sent_by != 'lina_ia',
        WhatsAppMessage.sent_by.isnot(None)
    ).scalar()

    # Appointments stats
    total_appointments = db.query(func.count(Appointment.id)).scalar()
    completed_appts = db.query(func.count(Appointment.id)).filter(Appointment.status.in_(['completed', 'paid'])).scalar()
    cancelled_appts = db.query(func.count(Appointment.id)).filter(Appointment.status == 'cancelled').scalar()
    noshow_appts = db.query(func.count(Appointment.id)).filter(Appointment.status == 'no_show').scalar()
    lina_created_appts = db.query(func.count(Appointment.id)).filter(Appointment.created_by == 'lina_ia').scalar()

    # Service stats
    total_services = db.query(func.count(Service.id)).filter(Service.is_active == True).scalar()

    # Staff stats
    total_staff = db.query(func.count(Staff.id)).filter(Staff.is_active == True).scalar()

    # Avg tokens per message (from usage metrics)
    current_period = f"{now.year}-{now.month:02d}"
    metrics = db.query(UsageMetrics).filter(UsageMetrics.period == current_period).first()
    avg_tokens_per_msg = 0
    if metrics and metrics.wa_messages_sent > 0:
        avg_tokens_per_msg = round(metrics.ai_tokens_used / metrics.wa_messages_sent)

    # Conversation resolution
    ai_paused_convos = db.query(func.count(WhatsAppConversation.id)).filter(
        WhatsAppConversation.is_ai_active == False
    ).scalar()

    return {
        "total_lina_messages": total_lina_msgs,
        "lina_messages_today": lina_today,
        "admin_manual_messages": admin_msgs,
        "total_appointments": total_appointments,
        "completed_appointments": completed_appts,
        "cancelled_appointments": cancelled_appts,
        "noshow_appointments": noshow_appts,
        "lina_created_appointments": lina_created_appts,
        "total_services": total_services,
        "total_active_staff": total_staff,
        "avg_tokens_per_message": avg_tokens_per_msg,
        "ai_paused_conversations": ai_paused_convos,
    }


# ============================================================================
# SYSTEM HEALTH
# ============================================================================

@router.get("/dev/system")
def dev_system(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    import os

    # DB check
    db_ok = True
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    # Count tables/rows
    admin_count = db.query(func.count(Admin.id)).scalar()
    tenant_count = db.query(func.count(Tenant.id)).scalar()
    client_count = db.query(func.count(Client.id)).scalar()
    msg_count = db.query(func.count(WhatsAppMessage.id)).scalar()
    convo_count = db.query(func.count(WhatsAppConversation.id)).scalar()

    # Environment info
    env_vars = {
        "ANTHROPIC_API_KEY": "***" + os.getenv("ANTHROPIC_API_KEY", "")[-4:] if os.getenv("ANTHROPIC_API_KEY") else "NOT SET",
        "WHATSAPP_ACCESS_TOKEN": "***" + os.getenv("WHATSAPP_ACCESS_TOKEN", "")[-4:] if os.getenv("WHATSAPP_ACCESS_TOKEN") else "NOT SET",
        "WHATSAPP_PHONE_NUMBER_ID": os.getenv("WHATSAPP_PHONE_NUMBER_ID", "NOT SET"),
        "DATABASE_URL": "***configured" if os.getenv("DATABASE_URL") else "NOT SET",
        "JWT_SECRET_KEY": "***set" if os.getenv("JWT_SECRET_KEY") else "NOT SET",
        "ENVIRONMENT": os.getenv("ENVIRONMENT", "development"),
        "ALLOWED_ORIGINS": os.getenv("ALLOWED_ORIGINS", "default"),
    }

    return {
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "database_connected": db_ok,
        "admin_users": admin_count,
        "tenants": tenant_count,
        "total_clients": client_count,
        "total_messages": msg_count,
        "total_conversations": convo_count,
        "environment_vars": env_vars,
    }


# ============================================================================
# PLATFORM CONFIG — Global settings (Meta App credentials, etc.)
# ============================================================================

@router.get("/dev/platform-config")
def get_platform_config(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Get all platform config entries. Secrets are masked."""
    _require_dev(user)

    configs = db.query(PlatformConfig).order_by(PlatformConfig.key).all()
    result = {}
    for c in configs:
        if c.is_secret and c.value:
            result[c.key] = f"***{c.value[-4:]}" if len(c.value) > 4 else "***"
        else:
            result[c.key] = c.value or ""
    return {"config": result}


@router.put("/dev/platform-config")
def update_platform_config(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Upsert platform config entries. Expects {key: value, ...}."""
    _require_dev(user)

    items = data.get("items", {})
    if not items:
        raise HTTPException(status_code=400, detail="No se enviaron configuraciones")

    # Which keys are secrets
    SECRET_KEYS = {"META_APP_SECRET"}

    updated = []
    for key, value in items.items():
        key = key.strip().upper()
        if not key:
            continue

        # Don't overwrite secret with masked value
        if value and value.startswith("***"):
            continue

        existing = db.query(PlatformConfig).filter(PlatformConfig.key == key).first()
        if existing:
            existing.value = value.strip() if value else ""
            existing.is_secret = key in SECRET_KEYS
            existing.updated_at = datetime.utcnow()
        else:
            db.add(PlatformConfig(
                key=key,
                value=value.strip() if value else "",
                is_secret=key in SECRET_KEYS,
            ))
        updated.append(key)

    db.commit()
    return {"success": True, "updated": updated}


@router.post("/dev/tenants/{tenant_id}/reset-workflows")
def reset_tenant_workflows(tenant_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Delete and re-seed workflows with latest 40 defaults for a specific tenant."""
    _require_dev(user)

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    return {"success": True, "message": "Legacy workflows removed. Use Automation Studio instead."}


@router.post("/dev/cleanup-duplicate-conversations")
def cleanup_duplicate_conversations(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Remove duplicate WhatsApp conversations. Keeps the one with most messages for each phone+tenant."""
    _require_dev(user)

    from sqlalchemy import func as sqlfunc

    # Find all conversations grouped by phone + tenant
    all_convs = (
        db.query(WhatsAppConversation)
        .order_by(WhatsAppConversation.tenant_id, WhatsAppConversation.wa_contact_phone, WhatsAppConversation.id)
        .all()
    )

    # Group by (tenant_id, phone_tail)
    groups = {}
    for conv in all_convs:
        phone = (conv.wa_contact_phone or "")[-10:]
        key = (conv.tenant_id, phone)
        if key not in groups:
            groups[key] = []
        groups[key].append(conv)

    deleted_count = 0
    merged_count = 0

    for key, convs in groups.items():
        if len(convs) <= 1:
            continue  # No duplicates

        # Find the conversation with the most messages (the "real" one)
        best = None
        best_msg_count = -1
        for conv in convs:
            msg_count = db.query(sqlfunc.count(WhatsAppMessage.id)).filter(
                WhatsAppMessage.conversation_id == conv.id
            ).scalar() or 0
            if msg_count > best_msg_count:
                best = conv
                best_msg_count = msg_count

        # Move messages from duplicates to the best conversation, then delete duplicates
        for conv in convs:
            if conv.id == best.id:
                continue

            # Move any messages from duplicate to the best
            moved = (
                db.query(WhatsAppMessage)
                .filter(WhatsAppMessage.conversation_id == conv.id)
                .update({WhatsAppMessage.conversation_id: best.id}, synchronize_session=False)
            )
            if moved:
                merged_count += moved

            db.delete(conv)
            deleted_count += 1

    db.commit()

    return {
        "success": True,
        "duplicates_deleted": deleted_count,
        "messages_merged": merged_count,
        "groups_processed": len([g for g in groups.values() if len(g) > 1]),
    }


@router.post("/dev/fix-conversation-links")
def fix_conversation_links(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Fix conversations with missing client_id or tenant_id by matching phone numbers."""
    _require_dev(user)
    import re as re_mod

    fixed_client = 0
    fixed_tenant = 0
    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    all_clients = db.query(Client).filter(Client.is_active == True).all()
    all_convs = db.query(WhatsAppConversation).all()

    details = []
    for conv in all_convs:
        conv_phone_clean = re_mod.sub(r'\D', '', conv.wa_contact_phone or '')
        conv_last10 = conv_phone_clean[-10:] if len(conv_phone_clean) >= 10 else conv_phone_clean
        details.append(f"conv {conv.id}: phone={conv.wa_contact_phone} last10={conv_last10} client_id={conv.client_id} tenant_id={conv.tenant_id}")

        # Fix missing tenant_id — default to first active tenant
        if not conv.tenant_id:
            if tenants:
                conv.tenant_id = tenants[0].id
                fixed_tenant += 1
                details.append(f"  -> fixed tenant_id to {tenants[0].id}")

        # Fix missing client_id — match by normalized phone
        if not conv.client_id and conv_last10:
            for c in all_clients:
                c_clean = re_mod.sub(r'\D', '', c.phone or '')
                c_last10 = c_clean[-10:] if len(c_clean) >= 10 else c_clean
                if c_last10 == conv_last10 and c_last10:
                    conv.client_id = c.id
                    fixed_client += 1
                    details.append(f"conv {conv.id}: client_id -> {c.id} ({c.name})")
                    break

    db.commit()
    return {
        "success": True,
        "conversations_fixed_client": fixed_client,
        "conversations_fixed_tenant": fixed_tenant,
        "total_conversations": len(all_convs),
        "details": details,
    }


# ============================================================================
# LOCATION MANAGEMENT (Dev Panel — manage sedes per tenant)
# ============================================================================

@router.get("/dev/tenants/{tenant_id}/locations")
def dev_list_locations(tenant_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List all locations for a tenant (dev only)."""
    if user.role not in DEV_ROLES:
        raise HTTPException(403, "Dev only")
    locations = db.query(Location).filter(Location.tenant_id == tenant_id).order_by(Location.is_default.desc(), Location.name).all()
    return [_serialize_location(loc, db) for loc in locations]


@router.post("/dev/tenants/{tenant_id}/locations")
def dev_create_location(tenant_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Create a location for a tenant (dev only)."""
    if user.role not in DEV_ROLES:
        raise HTTPException(403, "Dev only")
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant no encontrado")

    import re
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Nombre requerido")
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

    existing_count = db.query(Location).filter(Location.tenant_id == tenant_id).count()

    loc = Location(
        tenant_id=tenant_id,
        name=name,
        slug=slug,
        address=body.get("address"),
        phone=body.get("phone"),
        opening_time=body.get("opening_time", "08:00"),
        closing_time=body.get("closing_time", "19:00"),
        days_open=body.get("days_open", [0, 1, 2, 3, 4, 5]),
        is_default=existing_count == 0,
        is_active=True,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return _serialize_location(loc, db)


@router.put("/dev/locations/{location_id}")
def dev_update_location(location_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Update a location (dev only)."""
    if user.role not in DEV_ROLES:
        raise HTTPException(403, "Dev only")
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(404, "Sede no encontrada")
    for field in ["name", "address", "phone", "opening_time", "closing_time", "days_open", "wa_phone_number_id", "is_active"]:
        if field in body:
            setattr(loc, field, body[field])
    loc.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_location(loc, db)


@router.delete("/dev/locations/{location_id}")
def dev_delete_location(location_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete a location (dev only)."""
    if user.role not in DEV_ROLES:
        raise HTTPException(403, "Dev only")
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(404, "Sede no encontrada")
    loc.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/dev/locations/{location_id}/assign-staff")
def dev_assign_staff_to_location(location_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Assign staff to a location (dev only)."""
    if user.role not in DEV_ROLES:
        raise HTTPException(403, "Dev only")
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(404, "Sede no encontrada")

    staff_ids = body.get("staff_ids", [])
    is_primary = body.get("is_primary", False)
    assigned = 0
    for sid in staff_ids:
        existing = db.query(StaffLocation).filter(StaffLocation.staff_id == sid, StaffLocation.location_id == location_id).first()
        if not existing:
            db.add(StaffLocation(staff_id=sid, location_id=location_id, is_primary=is_primary))
            assigned += 1
        if is_primary:
            staff = db.query(Staff).filter(Staff.id == sid).first()
            if staff:
                staff.primary_location_id = location_id
    db.commit()
    return {"ok": True, "assigned": assigned}


def _serialize_location(loc, db):
    staff_count = db.query(StaffLocation).filter(StaffLocation.location_id == loc.id).count()
    apt_count = db.query(Appointment).filter(Appointment.location_id == loc.id).count()
    return {
        "id": loc.id,
        "tenant_id": loc.tenant_id,
        "name": loc.name,
        "slug": loc.slug,
        "address": loc.address,
        "phone": loc.phone,
        "opening_time": loc.opening_time,
        "closing_time": loc.closing_time,
        "days_open": loc.days_open,
        "wa_phone_number_id": loc.wa_phone_number_id,
        "is_active": loc.is_active,
        "is_default": loc.is_default,
        "staff_count": staff_count,
        "appointments_count": apt_count,
    }


# ============================================================================
# DEV MEGA � Cross-tenant comparison, MRR, health, alerts, errors, AI providers
# (Merged from dev_mega_endpoints.py)
# ============================================================================

@router.get("/dev/comparison")
def dev_comparison(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    now = datetime.utcnow()
    current_period = f"{now.year}-{now.month:02d}"
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Previous month for growth calc
    if now.month == 1:
        prev_period = f"{now.year - 1}-12"
        prev_month_start = month_start.replace(year=now.year - 1, month=12)
    else:
        prev_period = f"{now.year}-{now.month - 1:02d}"
        prev_month_start = month_start.replace(month=now.month - 1)

    result = []
    for t in tenants:
        tid = t.id

        clients = db.query(func.count(Client.id)).filter(Client.tenant_id == tid).scalar() or 0
        staff = db.query(func.count(Staff.id)).filter(Staff.tenant_id == tid).scalar() or 0

        # Messages
        messages_used = getattr(t, 'messages_used', 0)
        messages_limit = getattr(t, 'messages_limit', 5000)

        # AI tokens this month
        usage = db.query(UsageMetrics).filter(
            UsageMetrics.tenant_id == tid,
            UsageMetrics.period == current_period,
        ).first()
        ai_tokens = usage.ai_tokens_used if usage else 0

        # Revenue this month
        revenue = db.query(func.coalesce(func.sum(VisitHistory.amount), 0)).filter(
            VisitHistory.tenant_id == tid,
            VisitHistory.visit_date >= month_start.date(),
        ).scalar() or 0

        # Appointments this month
        appointments = db.query(func.count(Appointment.id)).filter(
            Appointment.tenant_id == tid,
            Appointment.date >= month_start.date(),
        ).scalar() or 0

        # Client growth (new this month vs last month)
        new_this = db.query(func.count(Client.id)).filter(
            Client.tenant_id == tid,
            Client.created_at >= month_start,
        ).scalar() or 0
        new_prev = db.query(func.count(Client.id)).filter(
            Client.tenant_id == tid,
            Client.created_at >= prev_month_start,
            Client.created_at < month_start,
        ).scalar() or 0
        growth_rate = round(((new_this - new_prev) / max(new_prev, 1)) * 100, 1)

        result.append({
            "id": tid,
            "name": t.name,
            "slug": t.slug,
            "clients": clients,
            "staff": staff,
            "messages_used": messages_used,
            "messages_limit": messages_limit,
            "ai_tokens_month": ai_tokens,
            "revenue_month": revenue,
            "appointments_month": appointments,
            "new_clients_month": new_this,
            "growth_rate": growth_rate,
            "monthly_price": getattr(t, 'monthly_price', 0),
        })

    return {
        "tenants": result,
        "period": current_period,
    }


# ============================================================================
# 2. MRR HISTORY & TRENDS
# ============================================================================

@router.get("/dev/mrr-history")
def dev_mrr_history(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    months = []

    for i in range(11, -1, -1):
        # Calculate month
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        period = f"{y}-{m:02d}"
        month_start = datetime(y, m, 1)
        if m == 12:
            month_end = datetime(y + 1, 1, 1)
        else:
            month_end = datetime(y, m + 1, 1)

        # Active tenants in that month (created before month_end and still active or paid_until >= month_start)
        active = db.query(Tenant).filter(
            Tenant.created_at < month_end,
            Tenant.is_active == True,
        ).all()

        mrr = sum(getattr(t, 'monthly_price', 0) for t in active)
        active_count = len(active)

        # New tenants this month
        new_tenants = db.query(func.count(Tenant.id)).filter(
            Tenant.created_at >= month_start,
            Tenant.created_at < month_end,
        ).scalar() or 0

        # Usage metrics for the period
        usage = db.query(
            func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0),
            func.coalesce(func.sum(UsageMetrics.wa_messages_sent), 0),
        ).filter(UsageMetrics.period == period).first()

        months.append({
            "period": period,
            "mrr": mrr,
            "active_tenants": active_count,
            "new_tenants": new_tenants,
            "ai_tokens": usage[0] if usage else 0,
            "messages_sent": usage[1] if usage else 0,
        })

    # Current MRR
    current_mrr = months[-1]["mrr"] if months else 0
    prev_mrr = months[-2]["mrr"] if len(months) >= 2 else 0
    growth_rate = round(((current_mrr - prev_mrr) / max(prev_mrr, 1)) * 100, 1) if prev_mrr else 0

    # Simple linear projection (last 6 months)
    recent = [m["mrr"] for m in months[-6:]]
    if len(recent) >= 2:
        avg_delta = (recent[-1] - recent[0]) / max(len(recent) - 1, 1)
        projection = [max(0, round(recent[-1] + avg_delta * (j + 1))) for j in range(3)]
    else:
        projection = [current_mrr] * 3

    return {
        "months": months,
        "current_mrr": current_mrr,
        "growth_rate": growth_rate,
        "projection_next_3": projection,
    }


# ============================================================================
# 3. HEALTH MONITORING
# ============================================================================

@router.get("/dev/health")
def dev_health(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    # DB latency
    start = time.time()
    db.execute(text("SELECT 1"))
    db_latency = round((time.time() - start) * 1000, 1)

    # DB pool stats
    try:
        engine = db.get_bind()
        pool = engine.pool
        pool_info = {
            "size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "checked_in": pool.checkedin(),
        }
    except Exception:
        pool_info = {"size": "unknown", "checked_out": "unknown"}

    # WhatsApp status per tenant
    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    wa_connected = 0
    wa_disconnected = 0
    wa_expiring = 0
    wa_details = []
    for t in tenants:
        token = getattr(t, 'wa_access_token', None)
        expires = getattr(t, 'wa_token_expires_at', None)
        if token:
            wa_connected += 1
            if expires and expires < datetime.utcnow() + timedelta(days=3):
                wa_expiring += 1
                wa_details.append({"tenant": t.name, "status": "expiring", "expires": expires.isoformat()})
            else:
                wa_details.append({"tenant": t.name, "status": "connected"})
        else:
            wa_disconnected += 1
            wa_details.append({"tenant": t.name, "status": "disconnected"})

    # AI status
    ai_key = os.getenv("ANTHROPIC_API_KEY")
    ai_status = "operational" if ai_key else "no_key"

    # Error rate (last hour and last 24h)
    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    errors_hour = db.query(func.count(ErrorLog.id)).filter(ErrorLog.created_at >= hour_ago).scalar() or 0
    errors_day = db.query(func.count(ErrorLog.id)).filter(ErrorLog.created_at >= day_ago).scalar() or 0

    # System info — no external deps
    try:
        import resource
        usage = resource.getrusage(resource.RUSAGE_SELF)
        memory_info = {"rss_mb": round(usage.ru_maxrss / 1024), "used_pct": "N/A"}
    except Exception:
        memory_info = {"rss_mb": "unknown", "used_pct": "N/A"}

    return {
        "db": {
            "status": "healthy" if db_latency < 500 else "slow",
            "latency_ms": db_latency,
            "pool": pool_info,
        },
        "whatsapp": {
            "connected": wa_connected,
            "disconnected": wa_disconnected,
            "expiring_soon": wa_expiring,
            "tenants": wa_details,
        },
        "ai": {
            "status": ai_status,
            "model": "claude-sonnet-4-20250514",
        },
        "errors": {
            "last_hour": errors_hour,
            "last_24h": errors_day,
        },
        "system": {
            "python": sys.version.split()[0],
            "platform": platform.system(),
            "memory": memory_info,
        },
        "timestamp": now.isoformat(),
    }


# ============================================================================
# 4. AUTOMATIC ALERTS
# ============================================================================

@router.get("/dev/alerts")
def dev_alerts(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    alerts = []
    tenants = db.query(Tenant).all()
    now = datetime.utcnow()

    for t in tenants:
        tid = t.id
        name = t.name

        # Message limit >80%
        used = getattr(t, 'messages_used', 0)
        limit = getattr(t, 'messages_limit', 5000)
        if limit > 0 and used > limit * 0.8:
            pct = round((used / limit) * 100, 1)
            severity = "critical" if pct >= 95 else "warning"
            alerts.append({
                "type": "message_limit",
                "severity": severity,
                "tenant": name,
                "tenant_id": tid,
                "message": f"{name} ha usado {pct}% de su limite de mensajes ({used}/{limit})",
                "value": pct,
                "timestamp": now.isoformat(),
            })

        # Overdue payment
        paid_until = getattr(t, 'paid_until', None)
        if paid_until and paid_until < date.today():
            days_overdue = (date.today() - paid_until).days
            alerts.append({
                "type": "overdue_payment",
                "severity": "critical",
                "tenant": name,
                "tenant_id": tid,
                "message": f"{name} tiene el pago vencido hace {days_overdue} dias",
                "value": days_overdue,
                "timestamp": now.isoformat(),
            })

        # WA disconnected
        wa_token = getattr(t, 'wa_access_token', None)
        wa_expires = getattr(t, 'wa_token_expires_at', None)
        if getattr(t, 'is_active', True):
            if not wa_token:
                alerts.append({
                    "type": "wa_disconnected",
                    "severity": "warning",
                    "tenant": name,
                    "tenant_id": tid,
                    "message": f"{name} no tiene WhatsApp conectado",
                    "timestamp": now.isoformat(),
                })
            elif wa_expires and wa_expires < now + timedelta(days=3):
                alerts.append({
                    "type": "wa_expiring",
                    "severity": "warning",
                    "tenant": name,
                    "tenant_id": tid,
                    "message": f"Token de WhatsApp de {name} expira pronto",
                    "timestamp": now.isoformat(),
                })

        # AI paused
        if getattr(t, 'ai_is_paused', False) and getattr(t, 'is_active', True):
            alerts.append({
                "type": "ai_paused",
                "severity": "info",
                "tenant": name,
                "tenant_id": tid,
                "message": f"La IA de {name} esta pausada",
                "timestamp": now.isoformat(),
            })

    # AI token spike: compare current month to previous
    current_period = f"{now.year}-{now.month:02d}"
    if now.month == 1:
        prev_period = f"{now.year - 1}-12"
    else:
        prev_period = f"{now.year}-{now.month - 1:02d}"

    curr_tokens = db.query(func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0)).filter(
        UsageMetrics.period == current_period
    ).scalar() or 0
    prev_tokens = db.query(func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0)).filter(
        UsageMetrics.period == prev_period
    ).scalar() or 0

    if prev_tokens > 0 and curr_tokens > prev_tokens * 2:
        alerts.append({
            "type": "token_spike",
            "severity": "warning",
            "tenant": "Plataforma",
            "message": f"Spike de tokens: {curr_tokens:,} este mes vs {prev_tokens:,} el mes pasado",
            "timestamp": now.isoformat(),
        })

    # Recent errors
    errors_hour = db.query(func.count(ErrorLog.id)).filter(
        ErrorLog.created_at >= now - timedelta(hours=1)
    ).scalar() or 0
    if errors_hour >= 5:
        alerts.append({
            "type": "error_spike",
            "severity": "critical",
            "tenant": "Plataforma",
            "message": f"{errors_hour} errores en la ultima hora",
            "timestamp": now.isoformat(),
        })

    # Sort: critical first, then warning, then info
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 3))

    return {
        "alerts": alerts,
        "total": len(alerts),
        "critical": sum(1 for a in alerts if a["severity"] == "critical"),
        "warning": sum(1 for a in alerts if a["severity"] == "warning"),
    }


# ============================================================================
# 5. ERROR LOGS
# ============================================================================

@router.get("/dev/errors")
def dev_errors(
    days: int = 7,
    error_type: str = None,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    cutoff = datetime.utcnow() - timedelta(days=days)
    query = db.query(ErrorLog).filter(ErrorLog.created_at >= cutoff)

    if error_type:
        query = query.filter(ErrorLog.error_type == error_type)

    errors = query.order_by(ErrorLog.created_at.desc()).limit(200).all()

    # Stats
    total = db.query(func.count(ErrorLog.id)).filter(ErrorLog.created_at >= cutoff).scalar() or 0
    by_type = db.query(
        ErrorLog.error_type, func.count(ErrorLog.id)
    ).filter(ErrorLog.created_at >= cutoff).group_by(ErrorLog.error_type).all()

    return {
        "errors": [
            {
                "id": e.id,
                "endpoint": e.endpoint,
                "method": e.method,
                "status_code": e.status_code,
                "error_type": e.error_type,
                "message": e.message,
                "traceback": e.traceback_text,
                "tenant_id": e.tenant_id,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in errors
        ],
        "total": total,
        "by_type": {t: c for t, c in by_type if t},
        "period_days": days,
    }


# ============================================================================
# 6. AI BUSINESS PROSPECTOR
# ============================================================================

_MODEL = "claude-sonnet-4-20250514"
_API_URL = "https://api.anthropic.com/v1/messages"

PROSPECT_CATEGORIES = [
    "Peluquerias", "Barberias", "Restaurantes", "Odontologia",
    "Clinicas/Hospitales", "Spas", "Gimnasios", "Veterinarias",
    "Hoteles", "Salones de belleza", "Nail salons", "Lavaderos de autos",
    "Lavanderias", "Pet groomers", "Tattoo studios", "Fisioterapia",
    "Opticas", "Psicologia", "Guarderias", "Yoga studios",
    "Coworking spaces", "Centros esteticos", "Consultorios medicos",
    "Academias de baile", "Escuelas de musica",
]


def _call_prospector_ai(system_prompt: str, user_message: str, max_tokens: int = 4096) -> dict:
    """Call Claude for business prospecting. Platform-level, no tenant billing."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=503, detail="API key de IA no configurada")

    payload = {
        "model": _MODEL,
        "max_tokens": max_tokens,
        "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": user_message}],
        "temperature": 0.5,
    }
    headers = {
        "x-api-key": anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(_API_URL, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        print(f"[Prospector] Claude HTTP error: {e.response.status_code}")
        raise HTTPException(status_code=502, detail="Error al comunicarse con el servicio de IA")
    except Exception as e:
        print(f"[Prospector] Claude error: {e}")
        raise HTTPException(status_code=502, detail="Error al comunicarse con el servicio de IA")

    result = response.json()

    # Track usage at platform level (tenant_id=0)
    tokens = result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0)
    try:
        from routes._usage_tracker import track_ai_usage
        track_ai_usage(tokens, tenant_id=0)
    except Exception:
        pass

    text = ""
    for block in result.get("content", []):
        if block.get("type") == "text":
            text += block.get("text", "")

    text = text.strip()
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        text = text[start:end].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": text, "prospects": []}


@router.post("/dev/prospect/generate")
def generate_prospects(
    data: dict,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    city = (data.get("city") or "Bucaramanga").strip()
    categories = data.get("categories", ["Peluquerias", "Barberias"])
    count = min(int(data.get("count", 10)), 20)

    # Exclude already-saved prospects in this city
    existing = db.query(BusinessProspect.name).filter(
        func.lower(BusinessProspect.city) == city.lower()
    ).all()
    exclude_names = [e[0] for e in existing]

    system_prompt = """Eres un analista de mercado senior especializado en negocios de servicios en Colombia y Latinoamerica.

Tu tarea es identificar negocios REALES y PLAUSIBLES que podrian beneficiarse de un CRM SaaS llamado Plexify Studio.
Plexify Studio ofrece: gestion de clientes, agendamiento, WhatsApp Business automatizado, IA asistente, campanas masivas, finanzas, y fidelizacion.

REGLAS ESTRICTAS:
1. Los negocios deben ser PLAUSIBLES para la ciudad indicada (nombres reales, direcciones logicas)
2. Analiza el mercado local: que tipo de negocio tiene mas demanda, competencia, y potencial
3. Para cada prospecto, analiza POR QUE necesitarian Plexify (pain points especificos de su tipo de negocio)
4. Si no tienes informacion exacta de un campo, pon null — NO inventes datos de contacto falsos
5. Responde UNICAMENTE con un JSON valido, sin texto adicional fuera del JSON

FORMATO DE RESPUESTA (JSON array):
[
  {
    "name": "Nombre del negocio",
    "owner_name": "Nombre del dueno si es conocido o null",
    "phone": "Telefono si es conocido o null",
    "email": "Email si es conocido o null",
    "business_type": "Categoria exacta del negocio",
    "address": "Direccion o zona aproximada en la ciudad",
    "ai_analysis": "Analisis del mercado de este tipo de negocio en la ciudad: tamano del mercado, competencia, tendencias, oportunidades",
    "why_plexify": "Razon especifica por la que este negocio se beneficiaria de Plexify Studio: pain points, problemas que resuelve, ROI estimado"
  }
]"""

    exclude_text = ""
    if exclude_names:
        exclude_text = f"\n\nEXCLUIR estos negocios ya registrados (NO los incluyas): {', '.join(exclude_names[:50])}"

    user_msg = f"""Genera {count} prospectos de negocios en {city}, Colombia.

Categorias de interes: {', '.join(categories)}
{exclude_text}

Prioriza negocios que:
- Manejen alto volumen de clientes recurrentes
- Necesiten agendamiento y confirmaciones
- Se beneficien de WhatsApp automatizado
- Tengan potencial de crecimiento con tecnologia

Responde SOLO con el JSON array."""

    result = _call_prospector_ai(system_prompt, user_msg, max_tokens=4096)

    # Parse and save prospects
    prospects_data = result if isinstance(result, list) else result.get("prospects", result.get("raw_response", []))
    if not isinstance(prospects_data, list):
        raise HTTPException(status_code=502, detail="La IA no devolvio un formato valido de prospectos")

    saved = []
    for p in prospects_data:
        if not isinstance(p, dict) or not p.get("name"):
            continue

        # Skip duplicates
        exists = db.query(BusinessProspect).filter(
            func.lower(BusinessProspect.name) == p["name"].lower(),
            func.lower(BusinessProspect.city) == city.lower(),
        ).first()
        if exists:
            continue

        prospect = BusinessProspect(
            name=p["name"],
            owner_name=p.get("owner_name"),
            phone=p.get("phone"),
            email=p.get("email"),
            business_type=p.get("business_type"),
            city=city,
            address=p.get("address"),
            ai_analysis=p.get("ai_analysis"),
            why_plexify=p.get("why_plexify"),
            status="pending",
            source="ai_prospector",
        )
        db.add(prospect)
        saved.append(p["name"])

    db.commit()

    return {
        "generated": len(prospects_data),
        "saved": len(saved),
        "duplicates_skipped": len(prospects_data) - len(saved),
        "names": saved,
    }


@router.get("/dev/prospects")
def list_prospects(
    status: str = None,
    city: str = None,
    business_type: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    query = db.query(BusinessProspect)

    if status:
        query = query.filter(BusinessProspect.status == status)
    if city:
        query = query.filter(func.lower(BusinessProspect.city) == city.lower())
    if business_type:
        query = query.filter(func.lower(BusinessProspect.business_type).contains(business_type.lower()))
    if search:
        search_pattern = f"%{search.lower()}%"
        query = query.filter(
            func.lower(BusinessProspect.name).like(search_pattern)
            | func.lower(BusinessProspect.owner_name).like(search_pattern)
            | func.lower(BusinessProspect.business_type).like(search_pattern)
        )

    prospects = query.order_by(BusinessProspect.created_at.desc()).limit(500).all()

    # Stats
    total = db.query(func.count(BusinessProspect.id)).scalar() or 0
    by_status = db.query(
        BusinessProspect.status, func.count(BusinessProspect.id)
    ).group_by(BusinessProspect.status).all()

    return {
        "prospects": [
            {
                "id": p.id,
                "name": p.name,
                "owner_name": p.owner_name,
                "phone": p.phone,
                "email": p.email,
                "business_type": p.business_type,
                "city": p.city,
                "address": p.address,
                "ai_analysis": p.ai_analysis,
                "why_plexify": p.why_plexify,
                "status": p.status,
                "notes": p.notes,
                "source": p.source,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                "contacted_at": p.contacted_at.isoformat() if p.contacted_at else None,
            }
            for p in prospects
        ],
        "total": total,
        "by_status": {s: c for s, c in by_status},
    }


@router.put("/dev/prospects/{prospect_id}")
def update_prospect(
    prospect_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    prospect = db.query(BusinessProspect).filter(BusinessProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto no encontrado")

    if "status" in data:
        prospect.status = data["status"]
        if data["status"] == "contacted" and not prospect.contacted_at:
            prospect.contacted_at = datetime.utcnow()

    if "notes" in data:
        prospect.notes = data["notes"]

    if "phone" in data:
        prospect.phone = data["phone"]
    if "email" in data:
        prospect.email = data["email"]
    if "owner_name" in data:
        prospect.owner_name = data["owner_name"]

    prospect.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "id": prospect.id, "status": prospect.status}


@router.delete("/dev/prospects/{prospect_id}")
def delete_prospect(
    prospect_id: int,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    prospect = db.query(BusinessProspect).filter(BusinessProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto no encontrado")

    db.delete(prospect)
    db.commit()

    return {"ok": True, "deleted": prospect_id}


@router.get("/dev/prospect/categories")
def prospect_categories(user: Admin = Depends(get_current_user)):
    _require_dev(user)
    return {"categories": PROSPECT_CATEGORIES}


@router.post("/dev/prospects/seed")
def seed_prospects(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Bulk insert prospects without AI. For seeding/testing."""
    _require_dev(user)
    items = data.get("prospects", [])
    saved = 0
    for p in items:
        if not p.get("name"):
            continue
        exists = db.query(BusinessProspect).filter(
            func.lower(BusinessProspect.name) == p["name"].lower()
        ).first()
        if exists:
            continue
        db.add(BusinessProspect(
            name=p["name"], owner_name=p.get("owner_name"), phone=p.get("phone"),
            email=p.get("email"), business_type=p.get("business_type"),
            city=p.get("city", "Bucaramanga"), address=p.get("address"),
            ai_analysis=p.get("ai_analysis"), why_plexify=p.get("why_plexify"),
            status="pending", source="manual_seed",
        ))
        saved += 1
    db.commit()
    return {"saved": saved, "total_sent": len(items)}


# ============================================================================
# 7. AI PROVIDER MANAGEMENT — Multi-provider with failover
# ============================================================================

AI_PROVIDER_TYPES = [
    {"id": "anthropic", "name": "Anthropic (Claude)", "models": [
        "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-opus-4-20250514",
    ]},
    {"id": "openai", "name": "OpenAI (ChatGPT)", "models": [
        "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo",
    ]},
    {"id": "google", "name": "Google (Gemini)", "models": [
        "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash",
    ]},
    {"id": "deepseek", "name": "DeepSeek", "models": [
        "deepseek-chat", "deepseek-reasoner",
    ]},
    {"id": "mistral", "name": "Mistral AI", "models": [
        "mistral-large-latest", "mistral-medium-latest", "mistral-small-latest",
    ]},
    {"id": "groq", "name": "Groq (Fast inference)", "models": [
        "llama-3.3-70b-versatile", "mixtral-8x7b-32768",
    ]},
]

# Official pricing per provider (USD per 1M tokens) — auto-assigned
PROVIDER_PRICING = {
    "anthropic": {"claude-sonnet-4-20250514": (3.0, 15.0), "claude-haiku-4-5-20251001": (0.80, 4.0), "claude-opus-4-20250514": (15.0, 75.0), "_default": (3.0, 15.0)},
    "openai": {"gpt-4o": (2.50, 10.0), "gpt-4o-mini": (0.15, 0.60), "gpt-4-turbo": (10.0, 30.0), "gpt-3.5-turbo": (0.50, 1.50), "_default": (2.50, 10.0)},
    "google": {"gemini-2.0-flash": (0.10, 0.40), "gemini-1.5-pro": (1.25, 5.0), "gemini-1.5-flash": (0.075, 0.30), "_default": (1.25, 5.0)},
    "deepseek": {"deepseek-chat": (0.14, 0.28), "deepseek-reasoner": (0.55, 2.19), "_default": (0.14, 0.28)},
    "mistral": {"mistral-large-latest": (2.0, 6.0), "mistral-medium-latest": (2.7, 8.1), "mistral-small-latest": (0.2, 0.6), "_default": (2.0, 6.0)},
    "groq": {"llama-3.3-70b-versatile": (0.59, 0.79), "mixtral-8x7b-32768": (0.24, 0.24), "_default": (0.59, 0.79)},
}


def _get_pricing(provider_type: str, model: str):
    """Get official pricing for a provider+model combo."""
    provider_prices = PROVIDER_PRICING.get(provider_type, {})
    if model in provider_prices:
        return provider_prices[model]
    return provider_prices.get("_default", (3.0, 15.0))


@router.get("/dev/ai-providers")
def list_ai_providers(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)
    providers = db.query(AIProvider).order_by(AIProvider.priority.asc()).all()
    return {
        "providers": [
            {
                "id": p.id,
                "name": p.name,
                "provider_type": p.provider_type,
                "api_key_preview": f"***{p.api_key[-4:]}" if p.api_key and len(p.api_key) > 4 else "***",
                "model": p.model,
                "priority": p.priority,
                "is_active": p.is_active,
                "is_primary": p.is_primary,
                "status": p.status,
                "last_health_check": p.last_health_check.isoformat() if p.last_health_check else None,
                "input_cost_per_mtok": p.input_cost_per_mtok,
                "output_cost_per_mtok": p.output_cost_per_mtok,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in providers
        ],
        "available_types": AI_PROVIDER_TYPES,
    }


@router.post("/dev/ai-providers")
def create_ai_provider(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    name = (data.get("name") or "").strip()
    provider_type = (data.get("provider_type") or "").strip()
    api_key = (data.get("api_key") or "").strip()
    model = (data.get("model") or "").strip()

    if not name or not provider_type or not api_key or not model:
        raise HTTPException(status_code=400, detail="Nombre, tipo, API key y modelo son requeridos")

    # If this is the first provider or marked as primary, set it
    existing_count = db.query(func.count(AIProvider.id)).scalar() or 0
    is_primary = data.get("is_primary", existing_count == 0)

    if is_primary:
        # Unset any existing primary
        db.query(AIProvider).filter(AIProvider.is_primary == True).update({"is_primary": False})

    provider = AIProvider(
        name=name,
        provider_type=provider_type,
        api_key=api_key,
        model=model,
        priority=data.get("priority", existing_count + 1),
        is_active=True,
        is_primary=is_primary,
        status="unknown",
        input_cost_per_mtok=_get_pricing(provider_type, model)[0],
        output_cost_per_mtok=_get_pricing(provider_type, model)[1],
        notes=data.get("notes"),
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)

    return {"ok": True, "id": provider.id, "name": provider.name, "is_primary": provider.is_primary}


@router.put("/dev/ai-providers/{provider_id}")
def update_ai_provider(provider_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    p = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    for field in ["name", "provider_type", "notes"]:
        if field in data:
            setattr(p, field, data[field])
    if "api_key" in data and data["api_key"]:
        p.api_key = data["api_key"]
    if "model" in data and data["model"]:
        p.model = data["model"]
        # Auto-update pricing when model changes
        inp, out = _get_pricing(p.provider_type, p.model)
        p.input_cost_per_mtok = inp
        p.output_cost_per_mtok = out
    if "is_active" in data:
        p.is_active = data["is_active"]
    if "priority" in data:
        p.priority = data["priority"]

    if data.get("is_primary"):
        db.query(AIProvider).filter(AIProvider.id != provider_id, AIProvider.is_primary == True).update({"is_primary": False})
        p.is_primary = True

    p.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "id": p.id}


@router.delete("/dev/ai-providers/{provider_id}")
def delete_ai_provider(provider_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    p = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if p.is_primary:
        raise HTTPException(status_code=400, detail="No puedes eliminar el proveedor primario. Asigna otro como primario primero.")

    db.delete(p)
    db.commit()
    return {"ok": True, "deleted": provider_id}


@router.post("/dev/ai-providers/{provider_id}/health-check")
def check_ai_provider_health(provider_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Quick health check — send a tiny prompt to verify the provider works."""
    _require_dev(user)

    p = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    try:
        if p.provider_type == "anthropic":
            resp = httpx.post(
                "https://api.anthropic.com/v1/messages",
                json={"model": p.model, "max_tokens": 10, "messages": [{"role": "user", "content": "ping"}]},
                headers={"x-api-key": p.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                timeout=15.0,
            )
            resp.raise_for_status()
            p.status = "healthy"

        elif p.provider_type == "openai":
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                json={"model": p.model, "max_tokens": 10, "messages": [{"role": "user", "content": "ping"}]},
                headers={"Authorization": f"Bearer {p.api_key}", "Content-Type": "application/json"},
                timeout=15.0,
            )
            resp.raise_for_status()
            p.status = "healthy"

        elif p.provider_type == "google":
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{p.model}:generateContent?key={p.api_key}",
                json={"contents": [{"parts": [{"text": "ping"}]}]},
                timeout=15.0,
            )
            resp.raise_for_status()
            p.status = "healthy"

        else:
            p.status = "unknown"

    except httpx.HTTPStatusError as e:
        p.status = "down"
        error_detail = e.response.text[:300]
        p.notes = f"HTTP {e.response.status_code}: {error_detail}"
        print(f"[HealthCheck] {p.name} FAILED: HTTP {e.response.status_code} — {error_detail}")
    except Exception as e:
        p.status = "down"
        p.notes = f"Error: {str(e)[:300]}"
        print(f"[HealthCheck] {p.name} FAILED: {e}")

    p.last_health_check = datetime.utcnow()
    db.commit()

    return {
        "id": p.id,
        "status": p.status,
        "checked_at": p.last_health_check.isoformat(),
        "error": p.notes if p.status == "down" else None,
    }


# ============================================================================
# 8. AI COST BREAKDOWN — Real-time desglose
# ============================================================================

@router.get("/dev/ai-cost-breakdown")
def ai_cost_breakdown(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    current_period = f"{now.year}-{now.month:02d}"

    # Get primary provider costs
    primary = db.query(AIProvider).filter(AIProvider.is_primary == True).first()
    input_rate = primary.input_cost_per_mtok if primary else 3.0
    output_rate = primary.output_cost_per_mtok if primary else 15.0
    # Fixed blended rate: $3 input × 80% + $15 output × 20% = $5.40/MTok
    # We don't track input/output separately, so this is the standard estimate
    blended_rate = 5.4

    # Per-tenant breakdown this month
    metrics = db.query(UsageMetrics).filter(UsageMetrics.period == current_period).all()
    tenants = {t.id: t.name for t in db.query(Tenant).all()}

    tenant_costs = []
    total_tokens_month = 0
    total_messages_month = 0

    for m in metrics:
        tokens = m.ai_tokens_used or 0
        msgs = (m.wa_messages_sent or 0) + (m.wa_messages_received or 0)
        campaigns = m.campaigns_sent or 0
        cost_usd = round((tokens / 1_000_000) * blended_rate, 4)
        total_tokens_month += tokens
        total_messages_month += msgs

        tenant_costs.append({
            "tenant_id": m.tenant_id,
            "tenant_name": tenants.get(m.tenant_id, f"Tenant {m.tenant_id}"),
            "tokens": tokens,
            "messages_sent": m.wa_messages_sent or 0,
            "messages_received": m.wa_messages_received or 0,
            "campaigns": campaigns,
            "cost_usd": cost_usd,
            "cost_cop": round(cost_usd * 4200),
        })

    # All-time totals
    all_time = db.query(
        func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0),
        func.coalesce(func.sum(UsageMetrics.wa_messages_sent), 0),
        func.coalesce(func.sum(UsageMetrics.campaigns_sent), 0),
    ).first()

    total_cost_month_usd = round((total_tokens_month / 1_000_000) * blended_rate, 4)
    total_cost_alltime_usd = round((all_time[0] / 1_000_000) * blended_rate, 4)

    # Historical by month (last 6 months)
    history = []
    for i in range(5, -1, -1):
        y = now.year
        mo = now.month - i
        while mo <= 0:
            mo += 12
            y -= 1
        period = f"{y}-{mo:02d}"
        period_tokens = db.query(func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0)).filter(
            UsageMetrics.period == period
        ).scalar() or 0
        period_cost = round((period_tokens / 1_000_000) * blended_rate, 4)
        history.append({"period": period, "tokens": period_tokens, "cost_usd": period_cost, "cost_cop": round(period_cost * 4200)})

    # Cost per action type (estimated)
    lina_msgs = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.sent_by == 'lina_ia',
        WhatsAppMessage.created_at >= now.replace(day=1, hour=0, minute=0, second=0, microsecond=0),
    ).scalar() or 0
    avg_tokens_per_lina = 800  # ~800 tokens avg per Lina response
    lina_cost_usd = round((lina_msgs * avg_tokens_per_lina / 1_000_000) * blended_rate, 4)

    return {
        "period": current_period,
        "provider": {
            "name": primary.name if primary else "Sin configurar",
            "model": primary.model if primary else "N/A",
            "input_rate": input_rate,
            "output_rate": output_rate,
            "blended_rate": round(blended_rate, 2),
        },
        "trm": 4200,
        "this_month": {
            "tokens": total_tokens_month,
            "cost_usd": total_cost_month_usd,
            "cost_cop": round(total_cost_month_usd * 4200),
            "messages": total_messages_month,
            "by_tenant": sorted(tenant_costs, key=lambda x: x["cost_usd"], reverse=True),
        },
        "all_time": {
            "tokens": all_time[0],
            "messages": all_time[1],
            "campaigns": all_time[2],
            "cost_usd": total_cost_alltime_usd,
            "cost_cop": round(total_cost_alltime_usd * 4200),
        },
        "estimated_by_action": {
            "lina_responses": {"count": lina_msgs, "est_tokens": lina_msgs * avg_tokens_per_lina, "cost_usd": lina_cost_usd, "cost_cop": round(lina_cost_usd * 4200)},
            "strategy_calls": {"note": "~4000 tokens per call, tracked in usage_metrics"},
            "prospector_calls": {"note": "~3000 tokens per call, tracked in usage_metrics"},
        },
        "history": history,
    }


# ============================================================================
# 9. ALLOWED ORIGINS — Editable from Dev Panel
# ============================================================================

@router.get("/dev/allowed-origins")
def get_allowed_origins(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)
    origins_str = os.environ.get("ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in origins_str.split(",") if o.strip()]
    return {"origins": origins, "raw": origins_str}


@router.put("/dev/allowed-origins")
def update_allowed_origins(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)
    origins = data.get("origins", [])
    if not isinstance(origins, list):
        raise HTTPException(status_code=400, detail="Origins debe ser una lista")
    new_val = ",".join(o.strip() for o in origins if o.strip())
    os.environ["ALLOWED_ORIGINS"] = new_val

    # Also save to PlatformConfig for persistence
    existing = db.query(PlatformConfig).filter(PlatformConfig.key == "ALLOWED_ORIGINS").first()
    if existing:
        existing.value = new_val
    else:
        db.add(PlatformConfig(key="ALLOWED_ORIGINS", value=new_val, is_secret=False))
    db.commit()

    return {"ok": True, "origins": origins}
