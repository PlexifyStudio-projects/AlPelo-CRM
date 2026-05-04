"""
WhatsApp Template Sender — Sends approved Meta templates synchronously.
Extracted from workflow_engine.py during Phase 5 refactor.
"""
import os
import json
import httpx
from routes._helpers import normalize_phone


def send_template_sync(phone, template_name, language_code="es", parameters=None, db=None):
    """Send an approved WhatsApp template message synchronously.
    Parameters is a list of strings for the template body variables.

    In Web (Baileys) mode, falls back to inline text since templates don't exist there.
    """
    from routes._helpers import get_wa_token, get_wa_phone_id
    from database.models import Tenant

    _tid = None
    if db:
        try:
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
            _tid = tenant.id if tenant else None
            # Short-circuit to Web mode if active
            if tenant and (tenant.wa_mode or "meta").lower() == "web":
                from services.whatsapp.sender import get_sender
                sender = get_sender(db, tenant.id, sync=True)
                result = sender.send_template(phone, template_name, language_code, parameters)
                return result.ok
        except Exception:
            pass
    token = get_wa_token(db, _tid) if db else os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = get_wa_phone_id(db, _tid) if db else os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
    api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")

    if not token or not phone_id:
        print(f"[WA-TEMPLATE] No credentials for template send")
        return False

    # Check token pause
    try:
        from routes.whatsapp_endpoints import _wa_token_paused
        if _wa_token_paused:
            return False
    except ImportError:
        pass

    # Build template payload
    template_obj = {
        "name": template_name,
        "language": {"code": language_code},
    }

    if parameters and len(parameters) > 0:
        clean_params = [p for p in parameters if p and str(p).strip()]
        if clean_params:
            components = [{
                "type": "body",
                "parameters": [{"type": "text", "text": str(p)} for p in clean_params],
            }]
            template_obj["components"] = components

    try:
        full_payload = {
            "messaging_product": "whatsapp",
            "to": normalize_phone(phone),
            "type": "template",
            "template": template_obj,
        }
        with httpx.Client(timeout=15) as client:
            resp = client.post(
                f"https://graph.facebook.com/{api_version}/{phone_id}/messages",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=full_payload,
            )
            data = resp.json()
            if resp.status_code == 200 and "messages" in data:
                # Increment tenant messages_used
                try:
                    if db:
                        tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
                        if tenant:
                            tenant.messages_used = (tenant.messages_used or 0) + 1
                            db.commit()
                except Exception:
                    pass
                return True
            else:
                error_msg = data.get("error", {}).get("message", str(data)[:100])
                print(f"[WA-TEMPLATE] Send failed: {error_msg}")
                return False
    except Exception as e:
        print(f"[WA-TEMPLATE] Send error: {e}")
        return False
