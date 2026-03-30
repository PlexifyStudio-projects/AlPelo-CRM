import os
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from database.connection import get_db
from database.models import Admin, Staff
from schemas import (
    LoginRequest, UserCredentials, TokenRequest,
    AdminResponse, AdminProfileUpdate, ChangePasswordRequest,
    AdminSetupRequest
)
from .jwt_handler import create_access_token, verify_token
from .security import verify_password, hash_password
from middleware.auth_middleware import get_current_user

router = APIRouter()

IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

COOKIE_CONFIG = {
    "key": "access_token",
    "httponly": True,
    "secure": True,
    "samesite": "none",
    "max_age": 3600,
    "path": "/",
}

CORS_HEADERS = {
    "Access-Control-Allow-Credentials": "true",
}


@router.post("/setup", response_model=AdminResponse)
def initial_setup(data: AdminSetupRequest, db: Session = Depends(get_db)):
    existing = db.query(Admin).first()
    if existing:
        raise HTTPException(status_code=403, detail="Admin already configured")

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    admin = Admin(
        name=data.name,
        email=data.email,
        phone=data.phone,
        username=data.username,
        password=hash_password(data.password),
        role="admin",
        is_active=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return AdminResponse.model_validate(admin)


@router.post("/users", response_model=AdminResponse)
def create_admin(data: AdminSetupRequest, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Create an additional admin user for the same tenant.
    Only admins and devs can create new admins."""
    from routes._helpers import safe_tid

    # Only admin or dev can create admins
    if current_user.role not in ("admin", "dev", "super_admin"):
        raise HTTPException(status_code=403, detail="No tienes permiso para crear administradores")

    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")

    # Check username uniqueness
    if db.query(Admin).filter(Admin.username == data.username).first():
        raise HTTPException(status_code=400, detail="Este nombre de usuario ya existe")

    # Check email uniqueness
    if db.query(Admin).filter(Admin.email == data.email).first():
        raise HTTPException(status_code=400, detail="Este correo ya está registrado")

    # Assign to same tenant as creator
    tid = safe_tid(current_user, db) or getattr(current_user, 'tenant_id', None)

    admin = Admin(
        name=data.name,
        email=data.email,
        phone=getattr(data, 'phone', None),
        username=data.username,
        password=hash_password(data.password),
        role="admin",
        is_active=True,
        tenant_id=tid,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return AdminResponse.model_validate(admin)


@router.delete("/users/{user_id}")
def delete_admin(user_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Deactivate an admin user. Cannot delete yourself."""
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    admin = db.query(Admin).filter(Admin.id == user_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Administrador no encontrado")

    # Check same tenant
    from routes._helpers import safe_tid
    tid = safe_tid(current_user, db)
    if tid and admin.tenant_id != tid and current_user.role != "dev":
        raise HTTPException(status_code=403, detail="No tienes acceso a este administrador")

    admin.is_active = False
    db.commit()
    return {"ok": True, "message": f"Administrador {admin.name} desactivado"}


@router.get("/users", response_model=List[AdminResponse])
def list_users(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """List admin users. Admins see only their tenant's admins, devs see all."""
    from routes._helpers import safe_tid
    tid = safe_tid(current_user, db)
    if tid and current_user.role != "dev":
        return [AdminResponse.model_validate(a) for a in db.query(Admin).filter(Admin.tenant_id == tid, Admin.is_active == True).all()]
    return [AdminResponse.model_validate(a) for a in db.query(Admin).filter(Admin.is_active == True).all()]


@router.get("/users/{user_id}", response_model=AdminResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(Admin).filter(Admin.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminResponse.model_validate(user)


@router.post("/verify-credentials")
def verify_credentials(login_data: LoginRequest, db: Session = Depends(get_db)):
    from database.models import Staff, Tenant

    # 1) Try Admin table first
    user = db.query(Admin).filter(Admin.username == login_data.username).first()
    is_staff = False

    # 2) If no admin found, try Staff table
    if not user:
        staff = db.query(Staff).filter(
            Staff.username == login_data.username,
            Staff.username.isnot(None),
            Staff.password.isnot(None),
        ).first()
        if staff and verify_password(login_data.password, staff.password):
            user = staff
            is_staff = True
        else:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid username or password"},
                headers=CORS_HEADERS
            )
    elif not verify_password(login_data.password, user.password):
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid username or password"},
            headers=CORS_HEADERS
        )

    # 3) Staff-specific checks
    if is_staff:
        if not user.is_active:
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "staff_deactivated",
                    "message": "Tu cuenta esta desactivada. Comunicate con tu empleador."
                },
                headers=CORS_HEADERS
            )
        # Check tenant suspension for staff
        if getattr(user, "tenant_id", None):
            tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
            if tenant and not tenant.is_active:
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": "suspended",
                        "message": "El negocio ha sido suspendido. Comunicate con tu empleador."
                    },
                    headers=CORS_HEADERS
                )
        return UserCredentials(
            user_id=user.id,
            username=user.username,
            role="staff"
        )

    # 4) Admin checks — deactivated account
    if not user.is_active:
        return JSONResponse(
            status_code=403,
            content={
                "detail": "account_deactivated",
                "message": "Su cuenta ha sido desactivada. Contacte a soporte para más información."
            },
            headers=CORS_HEADERS
        )

    # 5) Admin checks — tenant suspension (only for non-dev users)
    if user.role != "dev" and getattr(user, "tenant_id", None):
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant and not tenant.is_active:
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "suspended",
                    "message": "Tu cuenta ha sido suspendida por falta de pago. Contacta a soporte para reactivarla."
                },
                headers=CORS_HEADERS
            )

    # 5) Check for active session on another device
    has_active_session = False
    if getattr(user, 'active_session_token', None):
        # Verify the existing token is still valid (not expired)
        existing_payload = verify_token(user.active_session_token)
        if existing_payload:
            has_active_session = True

    return JSONResponse(
        content={
            "user_id": user.id,
            "username": user.username,
            "role": user.role,
            "has_active_session": has_active_session,
        },
        headers=CORS_HEADERS
    )


@router.post("/create-token")
def create_token(request: TokenRequest, db: Session = Depends(get_db)):
    token = create_access_token(data={
        "sub": request.username,
        "user_id": request.user_id,
        "role": request.role
    })

    # Save active session token for single-device enforcement
    try:
        from database.models import Staff
        if request.role == "staff":
            staff = db.query(Staff).filter(Staff.id == request.user_id).first()
            if staff:
                staff.active_session_token = token
                staff.session_started_at = datetime.utcnow()
                db.commit()
        else:
            admin = db.query(Admin).filter(Admin.id == request.user_id).first()
            if admin:
                admin.active_session_token = token
                admin.session_started_at = datetime.utcnow()
                db.commit()
    except Exception:
        pass

    response = JSONResponse(
        content={
            "success": True,
            "message": "Token created successfully",
            "access_token": token,
            "user": {
                "username": request.username,
                "user_id": request.user_id,
                "role": request.role
            }
        },
        headers=CORS_HEADERS
    )

    response.set_cookie(value=token, **COOKIE_CONFIG)
    return response


@router.post("/refresh-token")
def refresh_token(request: Request, db: Session = Depends(get_db)):
    # Read token from header or cookie
    token = None
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        return JSONResponse(status_code=401, content={"refreshed": False}, headers=CORS_HEADERS)

    payload = verify_token(token)
    if not payload:
        return JSONResponse(status_code=401, content={"refreshed": False}, headers=CORS_HEADERS)

    username = payload.get("sub")
    user_id = payload.get("user_id")
    role = payload.get("role")

    new_token = create_access_token(data={"sub": username, "user_id": user_id, "role": role})

    # Update active_session_token in DB so single-device check doesn't reject the refreshed token
    try:
        if role == "staff":
            user = db.query(Staff).filter(Staff.id == user_id).first()
        else:
            user = db.query(Admin).filter(Admin.id == user_id).first()
        if user:
            user.active_session_token = new_token
            db.commit()
    except Exception:
        pass

    response = JSONResponse(
        content={"refreshed": True, "username": username, "access_token": new_token},
        headers=CORS_HEADERS
    )
    response.set_cookie(value=new_token, **COOKIE_CONFIG)
    return response


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not token and auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()

    username = "unknown"

    if token:
        payload = verify_token(token)
        if payload:
            username = payload.get("sub", "unknown")
            user_id = payload.get("user_id")
            role = payload.get("role")
            # Clear active session
            try:
                if role == "staff":
                    from database.models import Staff
                    staff = db.query(Staff).filter(Staff.id == user_id).first()
                    if staff:
                        staff.active_session_token = None
                        staff.session_started_at = None
                        db.commit()
                else:
                    admin = db.query(Admin).filter(Admin.id == user_id).first()
                    if admin:
                        admin.active_session_token = None
                        admin.session_started_at = None
                        db.commit()
            except Exception:
                pass

    response = JSONResponse(
        content={
            "success": True,
            "username": username,
            "message": f"Session closed for '{username}'",
            "timestamp": datetime.utcnow().isoformat()
        },
        headers=CORS_HEADERS
    )

    response.delete_cookie(key="access_token", path="/")
    return response


@router.post("/force-logout")
def force_logout_user(data: dict, db: Session = Depends(get_db)):
    """Force close another user's session so the new login can proceed."""
    user_id = data.get("user_id")
    role = data.get("role", "admin")

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id requerido")

    try:
        if role == "staff":
            from database.models import Staff
            staff = db.query(Staff).filter(Staff.id == user_id).first()
            if staff:
                staff.active_session_token = None
                staff.session_started_at = None
                db.commit()
        else:
            admin = db.query(Admin).filter(Admin.id == user_id).first()
            if admin:
                admin.active_session_token = None
                admin.session_started_at = None
                db.commit()
    except Exception:
        pass

    return JSONResponse(content={"ok": True, "message": "Session forced closed"}, headers=CORS_HEADERS)


@router.get("/me")
def get_profile(request: Request, db: Session = Depends(get_db)):
    """Returns profile for current user (admin or staff)."""
    from database.models import Staff
    from auth.jwt_handler import verify_token as _verify

    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = _verify(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    role = payload.get("role")
    username = payload.get("sub")

    if role == "staff":
        staff = db.query(Staff).filter(Staff.username == username).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff not found")
        return {
            "id": staff.id,
            "name": staff.name,
            "email": staff.email,
            "phone": staff.phone,
            "username": staff.username,
            "role": "staff",
            "staff_role": staff.role,
            "specialty": staff.specialty,
            "is_active": staff.is_active,
            "tenant_id": staff.tenant_id,
        }

    admin = db.query(Admin).filter(Admin.username == username).first()
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminResponse.model_validate(admin)


@router.put("/me", response_model=AdminResponse)
def update_profile(
    data: AdminProfileUpdate,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] != current_user.email:
        existing = db.query(Admin).filter(Admin.email == update_data["email"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")

    if "username" in update_data and update_data["username"] != current_user.username:
        existing = db.query(Admin).filter(Admin.username == update_data["username"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already in use")

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)
    return AdminResponse.model_validate(current_user)


@router.put("/users/{user_id}/password")
def change_password(
    user_id: int,
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user),
):
    user = db.query(Admin).filter(Admin.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Only allow changing own password (unless dev role)
    if current_user.id != user_id and current_user.role != "dev":
        raise HTTPException(status_code=403, detail="No autorizado")

    # Validate current password if provided (required for self-change)
    if current_user.id == user_id:
        if not data.current_password:
            raise HTTPException(status_code=400, detail="Contrasena actual requerida")
        if not verify_password(data.current_password, user.password):
            raise HTTPException(status_code=400, detail="Contrasena actual incorrecta")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.password = hash_password(data.new_password)
    db.commit()

    return {"success": True, "message": f"Password updated for '{user.username}'"}
