"""Admin settings endpoints — Meta token management, OAuth, and template syncing."""

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
    """Read Meta App credentials from PlatformConfig (DB)."""
    creds = {"META_APP_ID": "", "META_APP_SECRET": "", "META_REDIRECT_URI": ""}

    configs = db.query(PlatformConfig).filter(
        PlatformConfig.key.in_(list(creds.keys()))
    ).all()
    for c in configs:
        if c.value:
            creds[c.key] = c.value

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

    scopes = "whatsapp_business_management,whatsapp_business_messaging"

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
        headers = {"Authorization": f"Bearer {long_token}"}

        # Strategy: Use debug_token to find the WABA ID associated with the app,
        # then query that WABA directly for phone numbers.
        # This works because WhatsApp OAuth tokens have whatsapp_business_management scope
        # which grants access to the WABA linked to the app.

        creds = get_meta_credentials(db)

        # Step 1: Get WABA ID — try debug_token first (shows granular_scopes with WABA targets)
        if creds.get("META_APP_ID") and creds.get("META_APP_SECRET"):
            dt_resp = httpx.get(
                f"https://graph.facebook.com/{META_GRAPH_VERSION}/debug_token",
                params={"input_token": long_token, "access_token": f"{creds['META_APP_ID']}|{creds['META_APP_SECRET']}"},
                timeout=10,
            )
            if dt_resp.status_code == 200:
                dt_data = dt_resp.json().get("data", {})
                granular = dt_data.get("granular_scopes", [])
                for scope in granular:
                    if scope.get("scope") == "whatsapp_business_management":
                        targets = scope.get("target_ids", [])
                        if targets:
                            business_account_id = targets[0]
                            tenant.wa_business_account_id = business_account_id
                            print(f"[META OAUTH] Found WABA {business_account_id} from debug_token granular_scopes")

        # Step 2: If we have WABA, get phone numbers
        if business_account_id:
            phone_resp = httpx.get(
                f"https://graph.facebook.com/{META_GRAPH_VERSION}/{business_account_id}/phone_numbers",
                headers=headers, timeout=10,
            )
            if phone_resp.status_code == 200:
                phones = phone_resp.json().get("data", [])
                if phones:
                    phone_number_id = phones[0].get("id")
                    phone_display = phones[0].get("display_phone_number")
                    tenant.wa_phone_number_id = phone_number_id
                    if phone_display:
                        tenant.wa_phone_display = phone_display
                    print(f"[META OAUTH] Found phone {phone_number_id} ({phone_display})")

        db.commit()
        if business_account_id and phone_number_id:
            print(f"[META OAUTH] Auto-detect SUCCESS for tenant {tid}: WABA={business_account_id}, phone={phone_number_id}")
        else:
            print(f"[META OAUTH] Auto-detect PARTIAL for tenant {tid}: WABA={business_account_id}, phone={phone_number_id}")
    except Exception as e:
        print(f"[META OAUTH] Auto-detect error for tenant {tid}: {e}")

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


@router.post("/settings/meta/disconnect")
def disconnect_meta(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Disconnect Meta/WhatsApp — clears token and all WA config for this tenant."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    tenant.wa_access_token = None
    tenant.wa_token_expires_at = None
    tenant.wa_phone_number_id = None
    tenant.wa_business_account_id = None
    tenant.wa_phone_display = None
    db.commit()

    return {"success": True, "message": "Cuenta de Meta desconectada exitosamente"}


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

    # If WABA or phone missing, try to recover from available data
    if not tenant.wa_phone_number_id or not tenant.wa_business_account_id:
        try:
            # Use WhatsApp-specific endpoints (don't need business_management scope)
            user_resp = httpx.get(
                f"https://graph.facebook.com/{META_GRAPH_VERSION}/me",
                headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
                params={"fields": "id"},
                timeout=10,
            )
            if user_resp.status_code == 200:
                user_id = user_resp.json().get("id")
                if user_id:
                    waba_resp = httpx.get(
                        f"https://graph.facebook.com/{META_GRAPH_VERSION}/{user_id}/whatsapp_business_accounts",
                        headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
                        timeout=10,
                    )
                    if waba_resp.status_code == 200:
                        wabas = waba_resp.json().get("data", [])
                        if wabas and not tenant.wa_business_account_id:
                            tenant.wa_business_account_id = wabas[0].get("id")

                        if tenant.wa_business_account_id and not tenant.wa_phone_number_id:
                            phone_resp = httpx.get(
                                f"https://graph.facebook.com/{META_GRAPH_VERSION}/{tenant.wa_business_account_id}/phone_numbers",
                                headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
                                timeout=10,
                            )
                            if phone_resp.status_code == 200:
                                phones = phone_resp.json().get("data", [])
                                if phones:
                                    tenant.wa_phone_number_id = phones[0].get("id")
                                    tenant.wa_phone_display = phones[0].get("display_phone_number", "")

                        if tenant.wa_business_account_id or tenant.wa_phone_number_id:
                            db.commit()
                            print(f"[META STATUS] Auto-recovered: WABA={tenant.wa_business_account_id}, phone={tenant.wa_phone_number_id}")
        except Exception as e:
            print(f"[META STATUS] Auto-detect retry failed for tenant {tid}: {e}")

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
        else:
            # Token exists but no phone — try to validate token at least
            resp = httpx.get(
                f"https://graph.facebook.com/{META_GRAPH_VERSION}/me",
                headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return {
                    "connected": True,
                    "phone_display": "Token valido (configura WhatsApp Business en Meta)",
                    "phone_number_id": None,
                    "business_account_id": tenant.wa_business_account_id,
                    "expires_at": expires_at,
                    "days_until_expiry": days_until_expiry,
                    "needs_phone_setup": True,
                }
            else:
                return {"connected": False, "message": "Token invalido o expirado", "expires_at": expires_at}
    except Exception as e:
        return {"connected": False, "message": str(e)[:100]}


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


# ============================================================================
# WHATSAPP BUSINESS PROFILE (name + photo visible to clients)
# ============================================================================

@router.get("/settings/whatsapp-profile")
def get_whatsapp_profile(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Fetch current WhatsApp Business Profile from Meta API."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant or not tenant.wa_access_token or not tenant.wa_phone_number_id:
        return {"profile": None, "error": "WhatsApp no configurado"}

    try:
        resp = httpx.get(
            f"https://graph.facebook.com/{META_GRAPH_VERSION}/{tenant.wa_phone_number_id}/whatsapp_business_profile",
            headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
            params={"fields": "about,address,description,email,profile_picture_url,websites,vertical"},
            timeout=10,
        )
        if resp.status_code != 200:
            return {"profile": None, "error": f"Error {resp.status_code}"}

        data = resp.json().get("data", [{}])
        profile = data[0] if data else {}
        return {"profile": profile}
    except Exception as e:
        return {"profile": None, "error": str(e)[:200]}


@router.put("/settings/whatsapp-profile")
async def update_whatsapp_profile(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Update WhatsApp Business Profile on Meta (about, description, address, etc)."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant or not tenant.wa_access_token or not tenant.wa_phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp no configurado — conecta Meta primero")

    # Build payload with only allowed fields
    payload = {}
    allowed = ["about", "address", "description", "email", "websites", "vertical"]
    for field in allowed:
        if field in data:
            payload[field] = data[field]

    payload["messaging_product"] = "whatsapp"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"https://graph.facebook.com/{META_GRAPH_VERSION}/{tenant.wa_phone_number_id}/whatsapp_business_profile",
                headers={
                    "Authorization": f"Bearer {tenant.wa_access_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            print(f"[WA PROFILE UPDATE] status={resp.status_code} body={resp.text[:300]}")

            if resp.status_code == 200:
                return {"success": True, "message": "Perfil de WhatsApp actualizado"}
            else:
                error = resp.json().get("error", {}).get("message", resp.text[:200])
                raise HTTPException(status_code=400, detail=f"Meta API: {error}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:200])


@router.put("/settings/whatsapp-profile-photo")
async def update_whatsapp_profile_photo(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Update WhatsApp Business Profile photo via Meta API.
    Accepts { "image_url": "https://..." } — Meta downloads the image from this URL.
    Image must be JPEG/PNG, max 5MB, square recommended.
    """
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant or not tenant.wa_access_token or not tenant.wa_phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp no configurado")

    image_url = (data.get("image_url") or "").strip()
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url es requerido")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://graph.facebook.com/{META_GRAPH_VERSION}/{tenant.wa_phone_number_id}/whatsapp_business_profile",
                headers={
                    "Authorization": f"Bearer {tenant.wa_access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "messaging_product": "whatsapp",
                    "profile_picture_url": image_url,
                },
            )
            print(f"[WA PROFILE PHOTO] status={resp.status_code} body={resp.text[:300]}")

            if resp.status_code == 200:
                return {"success": True, "message": "Foto de perfil actualizada"}
            else:
                error = resp.json().get("error", {}).get("message", resp.text[:200])
                raise HTTPException(status_code=400, detail=f"Meta API: {error}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)[:200])
