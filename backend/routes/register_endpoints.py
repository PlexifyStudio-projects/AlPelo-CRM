# ============================================================================
# PUBLIC REGISTER — Self-service tenant creation
# No auth required. Creates: Tenant + Admin + Services + Staff + Automations
# ============================================================================

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timedelta

from database.connection import get_db
from database.models import Tenant, Admin, Service, Staff
from auth.security import hash_password
from auth.jwt_handler import create_access_token

router = APIRouter()


# --- Schemas ---

class RegisterService(BaseModel):
    name: str
    price: int  # COP sin decimales
    duration_minutes: int = 30
    category: str = "General"

class RegisterStaff(BaseModel):
    name: str
    specialty: str = ""

class RegisterRequest(BaseModel):
    # Business
    business_name: str
    business_type: str = "peluqueria"
    country: str = "CO"
    city: str = ""
    address: str = ""
    phone: str = ""

    # Admin account
    owner_name: str
    email: str
    username: str
    password: str

    # Plan
    plan: str = "standard"  # standard, professional, enterprise
    monthly_price: int = 0

    # Services & Staff
    services: List[RegisterService] = []
    staff: List[RegisterStaff] = []

    # Automations (IDs of selected workflows)
    automation_ids: List[int] = []

    # Payment (simulated for now)
    payment_ref: Optional[str] = None


# --- Plan config ---

PLAN_CONFIG = {
    "starter": {
        "monthly_price": 190000,
        "messages_limit": 1500,
        "max_automations": 5,
        "label": "Starter",
    },
    "pro": {
        "monthly_price": 390000,
        "messages_limit": 4000,
        "max_automations": 12,
        "label": "Pro",
    },
    "business": {
        "monthly_price": 590000,
        "messages_limit": 7000,
        "max_automations": 20,
        "label": "Business",
    },
}


@router.post("/public/register")
def register_business(data: RegisterRequest, db: Session = Depends(get_db)):
    """Public endpoint: create a new business (tenant + admin + services + staff)."""

    # --- Validation ---
    if not data.business_name or not data.business_name.strip():
        raise HTTPException(400, "El nombre del negocio es obligatorio")
    if not data.username or len(data.username.strip()) < 3:
        raise HTTPException(400, "El usuario debe tener al menos 3 caracteres")
    if not data.password or len(data.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")
    if not data.email or "@" not in data.email:
        raise HTTPException(400, "Email inválido")

    # Check unique username
    existing_user = db.query(Admin).filter(Admin.username == data.username.strip().lower()).first()
    if existing_user:
        raise HTTPException(409, "Ese nombre de usuario ya está en uso")

    # Check unique email
    existing_email = db.query(Admin).filter(Admin.email == data.email.strip().lower()).first()
    if existing_email:
        raise HTTPException(409, "Ese correo electrónico ya está registrado")

    # --- Generate slug ---
    import re
    raw_slug = re.sub(r'[^a-z0-9]+', '-', data.business_name.lower().strip()).strip('-')[:30]
    slug = raw_slug
    counter = 1
    while db.query(Tenant).filter(Tenant.slug == slug).first():
        slug = f"{raw_slug}-{counter}"
        counter += 1

    # --- Plan ---
    plan_info = PLAN_CONFIG.get(data.plan, PLAN_CONFIG["starter"])

    # --- Create Tenant ---
    tenant = Tenant(
        slug=slug,
        name=data.business_name.strip(),
        business_type=data.business_type,
        owner_name=data.owner_name.strip(),
        owner_phone=data.phone,
        owner_email=data.email.strip().lower(),
        city=data.city,
        country=data.country,
        address=data.address,
        plan=data.plan,
        monthly_price=plan_info["monthly_price"],
        paid_until=date.today() + timedelta(days=30),  # 30 days from payment
        is_active=True,
        ai_is_paused=False,
        messages_used=0,
        messages_limit=plan_info["messages_limit"],
        ai_name="Lina",
    )
    db.add(tenant)
    db.flush()  # Get tenant.id

    # --- Create Admin User ---
    admin = Admin(
        name=data.owner_name.strip(),
        email=data.email.strip().lower(),
        username=data.username.strip().lower(),
        password=hash_password(data.password),
        role="admin",
        is_active=True,
        tenant_id=tenant.id,
    )
    db.add(admin)
    db.flush()  # Get admin.id

    # --- Create Services ---
    for svc in data.services:
        service = Service(
            tenant_id=tenant.id,
            name=svc.name,
            category=svc.category,
            price=svc.price,
            duration_minutes=svc.duration_minutes,
            is_active=True,
        )
        db.add(service)

    # --- Create Staff ---
    for member in data.staff:
        if not member.name.strip():
            continue
        staff = Staff(
            tenant_id=tenant.id,
            name=member.name.strip(),
            specialty=member.specialty or data.business_type,
            role=member.specialty or "Profesional",
            is_active=True,
        )
        db.add(staff)

    # --- Commit ---
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[REGISTER] Error: {e}")
        raise HTTPException(500, "Error al crear el negocio. Intenta de nuevo.")

    # --- Generate JWT ---
    token = create_access_token(data={
        "sub": admin.username,
        "user_id": admin.id,
        "role": "admin",
    })

    # Update active_session_token
    admin.active_session_token = token
    admin.session_started_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": f"Negocio '{tenant.name}' creado exitosamente",
        "access_token": token,
        "tenant": {
            "id": tenant.id,
            "slug": tenant.slug,
            "name": tenant.name,
            "plan": tenant.plan,
        },
        "admin": {
            "id": admin.id,
            "username": admin.username,
            "name": admin.name,
        },
        "booking_url": f"/book/{tenant.slug}",
    }
