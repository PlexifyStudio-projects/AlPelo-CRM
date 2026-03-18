"""Admin settings endpoints — Meta token management and template syncing."""

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Tenant
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter()


# ============================================================================
# META TOKEN MANAGEMENT
# ============================================================================

@router.put("/settings/meta-token")
def update_meta_token(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Admin updates their Meta/WhatsApp access token directly from Settings."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    token = (data.get("wa_access_token") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="El token es obligatorio")

    # Optional: also update phone_number_id and business_account_id
    phone_id = (data.get("wa_phone_number_id") or "").strip()
    biz_id = (data.get("wa_business_account_id") or "").strip()

    tenant.wa_access_token = token
    if phone_id:
        tenant.wa_phone_number_id = phone_id
    if biz_id:
        tenant.wa_business_account_id = biz_id

    db.commit()

    # Verify token by making a test call to Meta API
    verified = False
    phone_display = None
    try:
        if tenant.wa_phone_number_id:
            resp = httpx.get(
                f"https://graph.facebook.com/v21.0/{tenant.wa_phone_number_id}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                info = resp.json()
                verified = True
                phone_display = info.get("display_phone_number", None)
                if phone_display:
                    tenant.wa_phone_display = phone_display
                    db.commit()
    except Exception:
        pass

    return {
        "success": True,
        "verified": verified,
        "phone_display": phone_display or tenant.wa_phone_display,
        "message": "Token actualizado" + (" y verificado" if verified else " (no se pudo verificar)")
    }


@router.get("/settings/meta-token-status")
def meta_token_status(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Check if the current Meta token is valid."""
    tid = safe_tid(user, db)
    if not tid:
        return {"connected": False, "message": "Sin tenant"}

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant or not tenant.wa_access_token:
        return {"connected": False, "message": "Sin token configurado"}

    # Test the token
    try:
        if tenant.wa_phone_number_id:
            resp = httpx.get(
                f"https://graph.facebook.com/v21.0/{tenant.wa_phone_number_id}",
                headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return {
                    "connected": True,
                    "phone_display": tenant.wa_phone_display,
                    "phone_number_id": tenant.wa_phone_number_id,
                    "business_account_id": tenant.wa_business_account_id,
                }
            else:
                error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                return {
                    "connected": False,
                    "message": error_data.get("error", {}).get("message", f"Error {resp.status_code}"),
                }
    except Exception as e:
        return {"connected": False, "message": str(e)[:100]}

    return {"connected": False, "message": "Sin phone_number_id configurado"}


# ============================================================================
# META APPROVED TEMPLATES (from Meta API, not our DB)
# ============================================================================

@router.get("/settings/meta-templates")
def get_meta_templates(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Fetch approved message templates directly from Meta Business API."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant or not tenant.wa_access_token or not tenant.wa_business_account_id:
        return {"templates": [], "error": "Token o Business Account ID no configurado"}

    try:
        resp = httpx.get(
            f"https://graph.facebook.com/v21.0/{tenant.wa_business_account_id}/message_templates",
            headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
            params={"limit": 100},
            timeout=15,
        )

        if resp.status_code != 200:
            error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            return {
                "templates": [],
                "error": error_data.get("error", {}).get("message", f"Error {resp.status_code}")
            }

        data = resp.json()
        meta_templates = data.get("data", [])

        # Parse and return relevant fields
        result = []
        for t in meta_templates:
            # Extract body text from components
            body = ""
            for comp in t.get("components", []):
                if comp.get("type") == "BODY":
                    body = comp.get("text", "")
                    break

            result.append({
                "id": t.get("id"),
                "name": t.get("name"),
                "status": t.get("status", "").lower(),  # APPROVED, PENDING, REJECTED
                "category": t.get("category", "").lower(),  # MARKETING, UTILITY, AUTHENTICATION
                "language": t.get("language", "es"),
                "body": body,
                "components": t.get("components", []),
            })

        # Sort: approved first, then by name
        result.sort(key=lambda x: (0 if x["status"] == "approved" else 1, x["name"]))

        return {
            "templates": result,
            "total": len(result),
            "approved": len([t for t in result if t["status"] == "approved"]),
            "pending": len([t for t in result if t["status"] == "pending"]),
            "rejected": len([t for t in result if t["status"] == "rejected"]),
        }

    except httpx.TimeoutException:
        return {"templates": [], "error": "Timeout al conectar con Meta API"}
    except Exception as e:
        return {"templates": [], "error": str(e)[:200]}
