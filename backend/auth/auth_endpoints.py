import os
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from database.connection import get_db
from database.models import Admin
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


@router.get("/users", response_model=List[AdminResponse])
def list_users(db: Session = Depends(get_db)):
    return [AdminResponse.model_validate(a) for a in db.query(Admin).all()]


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

    # 4) Admin checks — tenant suspension (only for non-dev users)
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

    return UserCredentials(
        user_id=user.id,
        username=user.username,
        role=user.role
    )


@router.post("/create-token")
def create_token(request: TokenRequest):
    token = create_access_token(data={
        "sub": request.username,
        "user_id": request.user_id,
        "role": request.role
    })

    response = JSONResponse(
        content={
            "success": True,
            "message": "Token created successfully",
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
def refresh_token(request: Request):
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

    response = JSONResponse(
        content={"refreshed": True, "username": username},
        headers=CORS_HEADERS
    )
    response.set_cookie(value=new_token, **COOKIE_CONFIG)
    return response


@router.post("/logout")
def logout(request: Request):
    token = request.cookies.get("access_token")
    username = "unknown"

    if token:
        payload = verify_token(token)
        if payload:
            username = payload.get("sub", "unknown")

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
