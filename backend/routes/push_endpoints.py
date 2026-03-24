"""Web Push Notification endpoints — subscribe/unsubscribe devices + VAPID key."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import PushSubscription, PlatformConfig
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter(prefix="/push", tags=["Push Notifications"])


@router.get("/vapid-key")
def get_vapid_key(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return the VAPID public key for the frontend to subscribe."""
    config = db.query(PlatformConfig).filter(PlatformConfig.key == "VAPID_PUBLIC_KEY").first()
    if not config or not config.value:
        raise HTTPException(status_code=404, detail="VAPID keys not configured")
    return {"public_key": config.value}


@router.post("/subscribe")
def subscribe_push(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Register a push subscription for the current user's device."""
    endpoint = (data.get("endpoint") or "").strip()
    keys = data.get("keys") or {}
    p256dh = (keys.get("p256dh") or "").strip()
    auth_key = (keys.get("auth") or "").strip()

    if not endpoint or not p256dh or not auth_key:
        raise HTTPException(status_code=400, detail="endpoint, keys.p256dh, and keys.auth are required")

    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    # Determine user type and id
    user_type = getattr(user, '_auth_role', None) or getattr(user, 'role', 'admin')
    user_id = user.id

    # Upsert: if endpoint already exists, update keys
    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if existing:
        existing.p256dh = p256dh
        existing.auth_key = auth_key
        existing.tenant_id = tid
        existing.user_type = user_type
        existing.user_id = user_id
        existing.is_active = True
        existing.user_agent = data.get("user_agent", "")
        db.commit()
        return {"ok": True, "action": "updated", "id": existing.id}

    sub = PushSubscription(
        tenant_id=tid,
        user_type=user_type,
        user_id=user_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth_key=auth_key,
        user_agent=data.get("user_agent", ""),
    )
    db.add(sub)
    db.commit()
    return {"ok": True, "action": "created", "id": sub.id}


@router.delete("/unsubscribe")
def unsubscribe_push(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Remove a push subscription."""
    endpoint = (data.get("endpoint") or "").strip()
    if not endpoint:
        raise HTTPException(status_code=400, detail="endpoint is required")

    sub = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if sub:
        sub.is_active = False
        db.commit()
    return {"ok": True}


@router.post("/generate-vapid-keys")
def generate_vapid_keys(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Generate VAPID keys (dev only). Only works if keys don't exist yet."""
    role = getattr(user, 'role', '')
    if role != 'dev':
        raise HTTPException(status_code=403, detail="Solo dev puede generar VAPID keys")

    existing = db.query(PlatformConfig).filter(PlatformConfig.key == "VAPID_PRIVATE_KEY").first()
    if existing and existing.value:
        return {"message": "VAPID keys already exist", "public_key": db.query(PlatformConfig).filter(PlatformConfig.key == "VAPID_PUBLIC_KEY").first().value}

    try:
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.hazmat.primitives import serialization
        import base64

        priv = ec.generate_private_key(ec.SECP256R1())
        pub_bytes = priv.public_key().public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint
        )
        public_key = base64.urlsafe_b64encode(pub_bytes).decode('utf-8').rstrip('=')
        pem_bytes = priv.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption()
        )
        private_key = pem_bytes.decode('utf-8')

        # Store in PlatformConfig
        for key, value, secret in [
            ("VAPID_PRIVATE_KEY", private_key, True),
            ("VAPID_PUBLIC_KEY", public_key, False),
            ("VAPID_CONTACT_EMAIL", "mailto:dev@plexifystudio.com", False),
        ]:
            cfg = db.query(PlatformConfig).filter(PlatformConfig.key == key).first()
            if cfg:
                cfg.value = value
                cfg.is_secret = secret
            else:
                db.add(PlatformConfig(key=key, value=value, is_secret=secret))

        db.commit()
        return {"message": "VAPID keys generated", "public_key": public_key}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
