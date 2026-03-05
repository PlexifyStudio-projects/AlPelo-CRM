from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Admin
from auth.jwt_handler import verify_token


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Admin:
    """Extract and validate user from HttpOnly JWT cookie."""
    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(Admin).filter(Admin.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is deactivated")

    return user
