"""
Plexify Studio — Developer/Super Admin endpoints
Manage tenants, billing, usage, and platform-level operations.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import sys, platform

from auth.security import hash_password

from database.connection import get_db
from database.models import (
    Admin, Tenant, UsageMetrics,
    Client, Staff, WhatsAppMessage, WhatsAppConversation,
    Appointment, Service, VisitHistory, ClientNote
)
from middleware.auth_middleware import get_current_user

router = APIRouter()

DEV_ROLES = ["dev", "super_admin"]


def _require_dev(current_user: Admin):
    """Ensure the current user is a developer/super admin."""
    if current_user.role not in DEV_ROLES:
        raise HTTPException(status_code=403, detail="Developer access required")
    return current_user


def _safe_tenant_dict(t, db=None):
    """Build a tenant dict safely. All queries scoped to this tenant only."""
    client_count = 0
    staff_count = 0
    real_messages_used = 0
    admin_user = None

    if db:
        # TODO: When multi-tenant data isolation is implemented (client.tenant_id, etc.),
        # these queries should filter by tenant_id. For now, counts are global.
        try:
            client_count = db.query(func.count(Client.id)).scalar() or 0
        except Exception:
            pass
        try:
            staff_count = db.query(func.count(Staff.id)).scalar() or 0
        except Exception:
            pass
        try:
            real_messages_used = db.query(func.count(WhatsAppMessage.id)).filter(
                WhatsAppMessage.direction == 'outbound',
            ).scalar() or 0
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

    # Use real count if available, fallback to stored value
    messages_used = real_messages_used if real_messages_used > 0 else getattr(t, 'messages_used', 0)

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
        "messages_limit": getattr(t, 'messages_limit', 5000),
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

    # Cost estimate (Sonnet 4.5 blended rate $5.4/MTok)
    cost_estimate = round((total_tokens / 1_000_000) * 5.4, 2)

    return {
        "total_tenants": len(tenants),
        "active_tenants": len(active_tenants),
        "total_messages_sent": total_messages,
        "total_ai_tokens": total_tokens,
        "mrr": mrr,
        "total_clients": total_clients,
        "total_staff": total_staff,
        "total_conversations": total_conversations,
        "total_appointments": total_appointments,
        "messages_today": msgs_today,
        "lina_messages_today": lina_msgs_today,
        "cost_estimate_usd": cost_estimate,
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

    tenant = Tenant(
        slug=slug,
        name=name,
        business_type=data.get("business_type", "peluqueria"),
        owner_name=data.get("owner_name"),
        owner_phone=data.get("owner_phone"),
        owner_email=data.get("owner_email"),
        ai_name=data.get("ai_name", "Lina"),
        plan="standard",
        monthly_price=int(data.get("monthly_price", 0)),
        messages_limit=int(data.get("messages_limit", 5000)),
        messages_used=0,
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
        "monthly_price", "messages_limit", "plan",
    ]

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

    # Count REAL messages from DB (not the static tenant.messages_used field)
    real_used = 0
    try:
        real_used = db.query(func.count(WhatsAppMessage.id)).filter(
            WhatsAppMessage.direction == "outbound"
        ).scalar() or 0
    except Exception:
        real_used = getattr(tenant, 'messages_used', 0)

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
        "primary_color": "#2D5A3D",
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
def dev_whatsapp_health(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    total_conversations = db.query(func.count(WhatsAppConversation.id)).scalar()
    active_conversations = db.query(func.count(WhatsAppConversation.id)).filter(
        WhatsAppConversation.last_message_at >= week_ago
    ).scalar()
    ai_active_convos = db.query(func.count(WhatsAppConversation.id)).filter(
        WhatsAppConversation.is_ai_active == True
    ).scalar()
    total_unread = db.query(func.coalesce(func.sum(WhatsAppConversation.unread_count), 0)).scalar()

    # Message stats
    total_messages = db.query(func.count(WhatsAppMessage.id)).scalar()
    msgs_today = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.created_at >= today_start
    ).scalar()
    inbound_today = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.created_at >= today_start,
        WhatsAppMessage.direction == 'inbound'
    ).scalar()
    outbound_today = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.created_at >= today_start,
        WhatsAppMessage.direction == 'outbound'
    ).scalar()
    lina_msgs_today = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.created_at >= today_start,
        WhatsAppMessage.sent_by == 'lina_ia'
    ).scalar()
    failed_msgs = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.status == 'failed'
    ).scalar()

    # Message types breakdown
    template_count = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.message_type == 'template'
    ).scalar()
    media_count = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.message_type.in_(['image', 'audio', 'video', 'sticker'])
    ).scalar()

    # Daily breakdown (last 7 days)
    daily_msgs = []
    for i in range(7):
        day = today_start - timedelta(days=i)
        day_end = day + timedelta(days=1)
        count = db.query(func.count(WhatsAppMessage.id)).filter(
            WhatsAppMessage.created_at >= day,
            WhatsAppMessage.created_at < day_end
        ).scalar()
        daily_msgs.append({"date": day.strftime("%Y-%m-%d"), "count": count})

    # Check WA token status from tenant
    # Dev endpoint — use first active tenant for WA health check (dev users don't have tenant_id)
    if user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    else:
        tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
    has_token = bool(tenant and getattr(tenant, 'wa_access_token', None))

    return {
        "total_conversations": total_conversations,
        "active_conversations_7d": active_conversations,
        "ai_active_conversations": ai_active_convos,
        "total_unread": total_unread,
        "total_messages": total_messages,
        "messages_today": msgs_today,
        "inbound_today": inbound_today,
        "outbound_today": outbound_today,
        "lina_responses_today": lina_msgs_today,
        "failed_messages": failed_msgs,
        "template_messages": template_count,
        "media_messages": media_count,
        "daily_messages": daily_msgs,
        "has_wa_token": has_token,
        "wa_phone_display": getattr(tenant, 'wa_phone_display', None) if tenant else None,
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
    completed_appts = db.query(func.count(Appointment.id)).filter(Appointment.status == 'completed').scalar()
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
