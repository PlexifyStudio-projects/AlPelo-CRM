import os
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime

from database.connection import get_db
from database.models import Admin
from typing import List
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
    "secure": IS_PRODUCTION,
    "samesite": "strict" if IS_PRODUCTION else "lax",
    "max_age": 3600,
    "path": "/",
}

CORS_HEADERS = {
    "Access-Control-Allow-Credentials": "true",
}


# ============================================================================
# INITIAL SETUP (one-time only)
# ============================================================================

@router.post("/setup", response_model=AdminResponse)
def initial_setup(data: AdminSetupRequest, db: Session = Depends(get_db)):
    """Create the admin account. Only works if no admin exists yet."""
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


# ============================================================================
# ADMIN LISTING
# ============================================================================

@router.get("/users", response_model=List[AdminResponse])
def list_users(db: Session = Depends(get_db)):
    """List all admin users with their IDs."""
    return [AdminResponse.model_validate(a) for a in db.query(Admin).all()]


@router.get("/users/{user_id}", response_model=AdminResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get a specific admin user by ID."""
    user = db.query(Admin).filter(Admin.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return AdminResponse.model_validate(user)


# ============================================================================
# AUTHENTICATION
# ============================================================================

@router.post("/verify-credentials")
def verify_credentials(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Verify username + password, return user info."""
    user = db.query(Admin).filter(Admin.username == login_data.username).first()

    if not user or not verify_password(login_data.password, user.password):
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid username or password"},
            headers=CORS_HEADERS
        )

    return UserCredentials(
        user_id=user.id,
        username=user.username,
        role=user.role
    )


@router.post("/create-token")
def create_token(request: TokenRequest):
    """Create JWT and set it as HttpOnly cookie."""
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
    """Silent token rotation — issue new JWT if current one is valid."""
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
    """Clear the HttpOnly cookie."""
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


# ============================================================================
# PROFILE MANAGEMENT
# ============================================================================

@router.get("/me", response_model=AdminResponse)
def get_profile(current_user: Admin = Depends(get_current_user)):
    """Get current admin profile."""
    return AdminResponse.model_validate(current_user)


@router.put("/me", response_model=AdminResponse)
def update_profile(
    data: AdminProfileUpdate,
    db: Session = Depends(get_db),
    current_user: Admin = Depends(get_current_user)
):
    """Update admin profile (name, email, phone, username)."""
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
):
    """Change password by user ID. Check GET /users to find the ID."""
    user = db.query(Admin).filter(Admin.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user.password = hash_password(data.new_password)
    db.commit()

    return {"success": True, "message": f"Password updated for '{user.username}'"}
