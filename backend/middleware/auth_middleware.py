from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Optional
from jose import JWTError, jwt

from database.connection import get_db
from database.models import Admin, Staff
from auth.jwt_handler import SECRET_KEY, ALGORITHM


def _get_token(request: Request) -> Optional[str]:
    """Get token from Authorization header (Bearer) or cookie — mobile-safe."""
    # 1. Try Authorization header first (works cross-origin on mobile)
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    # 2. Fallback to cookie (works on desktop)
    return request.cookies.get("access_token")


def get_current_user(request: Request, db: Session = Depends(get_db)):
    """Returns Admin or Staff depending on the JWT role.
    Both have: id, username, tenant_id, is_active, role."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
    )

    token = _get_token(request)
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Staff login — look up in Staff table
    if role == "staff":
        user = db.query(Staff).filter(Staff.username == username).first()
        if user is None:
            raise credentials_exception
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tu cuenta esta desactivada. Comunicate con tu empleador.")
        # Attach auth role so role_required works
        user._auth_role = "staff"
        return user

    # Admin/dev — look up in Admin table
    user = db.query(Admin).filter(Admin.username == username).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is deactivated")

    user._auth_role = user.role
    return user


def get_current_user_optional(request: Request, db: Session = Depends(get_db)):
    token = _get_token(request)
    if not token:
        return None

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None:
            return None

        if role == "staff":
            user = db.query(Staff).filter(Staff.username == username).first()
            if user:
                user._auth_role = "staff"
            return user

        user = db.query(Admin).filter(Admin.username == username).first()
        if user:
            user._auth_role = user.role
        return user
    except JWTError:
        return None


def role_required(allowed_roles: list[str]):
    def dependency(current_user=Depends(get_current_user)):
        auth_role = getattr(current_user, '_auth_role', getattr(current_user, 'role', ''))
        if auth_role.lower() not in [r.lower() for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return dependency
