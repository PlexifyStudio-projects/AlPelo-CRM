"""Admin settings endpoints — Meta token management, OAuth, and template syncing."""

import os
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Tenant, PlatformConfig
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter()

META_GRAPH_VERSION = "v22.0"


def get_meta_credentials(db: Session) -> dict:
    """Read Meta App credentials from PlatformConfig (DB), fallback to env vars."""
    creds = {"META_APP_ID": "", "META_APP_SECRET": "", "META_REDIRECT_URI": ""}

    # Try DB first
    configs = db.query(PlatformConfig).filter(
        PlatformConfig.key.in_(list(creds.keys()))
    ).all()
    for c in configs:
        if c.value:
            creds[c.key] = c.value

    # Fallback to env vars for any missing
    for key in creds:
        if not creds[key]:
            creds[key] = os.getenv(key, "")

    return creds


# ============================================================================
# META OAUTH FLOW
# ============================================================================

@router.get("/settings/meta/auth-url")
def get_meta_auth_url(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return the Facebook OAuth URL the frontend should redirect to."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    creds = get_meta_credentials(db)
    app_id = creds["META_APP_ID"]
    redirect_uri = creds["META_REDIRECT_URI"]

    if not app_id:
        raise HTTPException(status_code=500, detail="META_APP_ID no configurado. Configuralo desde el Dev Panel > Sistema.")
    if not redirect_uri:
        raise HTTPException(status_code=500, detail="META_REDIRECT_URI no configurado. Configuralo desde el Dev Panel > Sistema.")

    scopes = "whatsapp_business_management,whatsapp_business_messaging,business_management"

    url = (
        f"https://www.facebook.com/{META_GRAPH_VERSION}/dialog/oauth?"
        f"client_id={app_id}&"
        f"redirect_uri={redirect_uri}&"
        f"scope={scopes}&"
        f"response_type=code&"
        f"state={tid}"
    )

    return {"url": url, "redirect_uri": redirect_uri}


@router.post("/settings/meta/exchange-token")
def exchange_meta_token(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Exchange OAuth code for a long-lived token. Auto-detects phone_number_id and business_account_id."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    code = (data.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="El codigo OAuth es obligatorio")

    creds = get_meta_credentials(db)
    app_id = creds["META_APP_ID"]
    app_secret = creds["META_APP_SECRET"]
    redirect_uri = creds["META_REDIRECT_URI"]

    if not app_id or not app_secret:
        raise HTTPException(status_code=500, detail="META_APP_ID o META_APP_SECRET no configurados. Configuralo desde el Dev Panel > Sistema.")

    # Step 1: Exchange code for short-lived token
    try:
        resp = httpx.get(
            f"https://graph.facebook.com/{META_GRAPH_VERSION}/oauth/access_token",
            params={
                "client_id": app_id,
                "redirect_uri": redirect_uri,
                "client_secret": app_secret,
                "code": code,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            error_data = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
            msg = error_data.get("error", {}).get("message", f"Error {resp.status_code}")
            raise HTTPException(status_code=400, detail=f"Error al intercambiar codigo: {msg}")

        short_token = resp.json().get("access_token")
        if not short_token:
            raise HTTPException(status_code=400, detail="No se recibio token de Meta")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al conectar con Meta: {str(e)[:200]}")

    # Step 2: Exchange short-lived for long-lived token (60 days)
    try:
        resp = httpx.get(
            f"https://graph.facebook.com/{META_GRAPH_VERSION}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": app_secret,
                "fb_exchange_token": short_token,
            },
            timeout=15,
        )
        if resp.status_code != 200:
            error_data = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
            msg = error_data.get("error", {}).get("message", f"Error {resp.status_code}")
            raise HTTPException(status_code=400, detail=f"Error al obtener token de larga duracion: {msg}")

        token_data = resp.json()
        long_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in", 5184000)  # default 60 days in seconds
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener long-lived token: {str(e)[:200]}")

    # Step 3: Save token to tenant
    tenant.wa_access_token = long_token
    tenant.wa_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
    db.commit()

    # Step 4: Auto-detect phone_number_id and business_account_id
    phone_number_id = None
    business_account_id = None
    phone_display = None

    try:
        # Get WABA (WhatsApp Business Account) info
        resp = httpx.get(
            f"https://graph.facebook.com/{META_GRAPH_VERSION}/me/businesses",
            headers={"Authorization": f"Bearer {long_token}"},
            timeout=15,
        )
        if resp.status_code == 200:
            businesses = resp.json().get("data", [])
            if businesses:
                biz_id = businesses[0].get("id")
                # Get WhatsApp Business Account from the business
                waba_resp = httpx.get(
                    f"https://graph.facebook.com/{META_GRAPH_VERSION}/{biz_id}/owned_whatsapp_business_accounts",
                    headers={"Authorization": f"Bearer {long_token}"},
                    timeout=15,
                )
                if waba_resp.status_code == 200:
                    wabas = waba_resp.json().get("data", [])
                    if wabas:
                        business_account_id = wabas[0].get("id")
                        tenant.wa_business_account_id = business_account_id

                        # Get phone numbers from WABA
                        phone_resp = httpx.get(
                            f"https://graph.facebook.com/{META_GRAPH_VERSION}/{business_account_id}/phone_numbers",
                            headers={"Authorization": f"Bearer {long_token}"},
                            timeout=15,
                        )
                        if phone_resp.status_code == 200:
                            phones = phone_resp.json().get("data", [])
                            if phones:
                                phone_number_id = phones[0].get("id")
                                phone_display = phones[0].get("display_phone_number")
                                tenant.wa_phone_number_id = phone_number_id
                                if phone_display:
                                    tenant.wa_phone_display = phone_display

                        db.commit()
    except Exception:
        pass  # Auto-detect is best-effort; token is already saved

    token_preview = f"{long_token[:12]}...{long_token[-8:]}" if long_token and len(long_token) > 20 else "***"

    return {
        "success": True,
        "token_preview": token_preview,
        "expires_in": expires_in,
        "expires_at": tenant.wa_token_expires_at.isoformat() if tenant.wa_token_expires_at else None,
        "phone_number_id": phone_number_id,
        "business_account_id": business_account_id,
        "phone_display": phone_display,
    }


@router.post("/settings/meta/refresh-token")
def refresh_meta_token(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Refresh an expiring long-lived Meta token. Only works if the token hasn't fully expired."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant or not tenant.wa_access_token:
        raise HTTPException(status_code=400, detail="No hay token para renovar")

    creds = get_meta_credentials(db)
    app_id = creds["META_APP_ID"]
    app_secret = creds["META_APP_SECRET"]

    if not app_id or not app_secret:
        raise HTTPException(status_code=500, detail="META_APP_ID o META_APP_SECRET no configurados. Configuralo desde el Dev Panel > Sistema.")

    try:
        resp = httpx.get(
            f"https://graph.facebook.com/{META_GRAPH_VERSION}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": app_secret,
                "fb_exchange_token": tenant.wa_access_token,
            },
            timeout=15,
        )

        if resp.status_code != 200:
            error_data = resp.json() if "application/json" in resp.headers.get("content-type", "") else {}
            msg = error_data.get("error", {}).get("message", f"Error {resp.status_code}")
            raise HTTPException(status_code=400, detail=f"Error al renovar token: {msg}")

        token_data = resp.json()
        new_token = token_data.get("access_token")
        expires_in = token_data.get("expires_in", 5184000)

        tenant.wa_access_token = new_token
        tenant.wa_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
        db.commit()

        token_preview = f"{new_token[:12]}...{new_token[-8:]}" if new_token and len(new_token) > 20 else "***"

        return {
            "success": True,
            "token_preview": token_preview,
            "expires_in": expires_in,
            "expires_at": tenant.wa_token_expires_at.isoformat() if tenant.wa_token_expires_at else None,
            "message": "Token renovado exitosamente",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al renovar: {str(e)[:200]}")


# ============================================================================
# META TOKEN MANAGEMENT (manual)
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
                f"https://graph.facebook.com/{META_GRAPH_VERSION}/{tenant.wa_phone_number_id}",
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

    # Calculate expiration info
    expires_at = None
    days_until_expiry = None
    if tenant.wa_token_expires_at:
        expires_at = tenant.wa_token_expires_at.isoformat()
        days_until_expiry = (tenant.wa_token_expires_at - datetime.utcnow()).days

    # Test the token
    try:
        if tenant.wa_phone_number_id:
            resp = httpx.get(
                f"https://graph.facebook.com/{META_GRAPH_VERSION}/{tenant.wa_phone_number_id}",
                headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return {
                    "connected": True,
                    "phone_display": tenant.wa_phone_display,
                    "phone_number_id": tenant.wa_phone_number_id,
                    "business_account_id": tenant.wa_business_account_id,
                    "expires_at": expires_at,
                    "days_until_expiry": days_until_expiry,
                }
            else:
                error_data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                return {
                    "connected": False,
                    "message": error_data.get("error", {}).get("message", f"Error {resp.status_code}"),
                    "expires_at": expires_at,
                    "days_until_expiry": days_until_expiry,
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
            f"https://graph.facebook.com/{META_GRAPH_VERSION}/{tenant.wa_business_account_id}/message_templates",
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
