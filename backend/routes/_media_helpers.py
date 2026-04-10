"""Shared helpers for uploading media to Meta WhatsApp Business API."""

import base64
import httpx

WA_API_VERSION = "v22.0"


def upload_media_to_meta(data_uri: str, default_mime: str, wa_token: str, phone_id: str = None) -> str | None:
    """Upload base64 data URI to Meta. Returns handle (for template examples) or media_id (fallback)."""
    if not data_uri or not data_uri.startswith("data:"):
        return None

    header_part, encoded = data_uri.split(",", 1)
    mime = header_part.split(";")[0].split(":")[1] if ":" in header_part else default_mime
    file_bytes = base64.b64decode(encoded)
    file_len = len(file_bytes)

    print(f"[META UPLOAD] Uploading {file_len} bytes, mime={mime}")

    # Step 1: Create upload session (resumable upload)
    resp1 = httpx.post(
        f"https://graph.facebook.com/{WA_API_VERSION}/app/uploads",
        headers={"Authorization": f"Bearer {wa_token}"},
        params={"file_length": file_len, "file_type": mime},
        timeout=30,
    )
    data1 = resp1.json()
    print(f"[META UPLOAD] Session response: {data1}")

    session_id = data1.get("id")
    if not session_id:
        print("[META UPLOAD] No session ID, trying direct upload...")
        if phone_id:
            resp_direct = httpx.post(
                f"https://graph.facebook.com/{WA_API_VERSION}/{phone_id}/media",
                headers={"Authorization": f"Bearer {wa_token}"},
                files={"file": ("media", file_bytes, mime)},
                data={"messaging_product": "whatsapp", "type": mime},
                timeout=30,
            )
            data_direct = resp_direct.json()
            print(f"[META UPLOAD] Direct upload response: {data_direct}")
            return data_direct.get("id")
        return None

    # Step 2: Upload file bytes
    resp2 = httpx.post(
        f"https://graph.facebook.com/{WA_API_VERSION}/{session_id}",
        headers={"Authorization": f"OAuth {wa_token}", "file_offset": "0", "Content-Type": mime},
        content=file_bytes,
        timeout=60,
    )
    data2 = resp2.json()
    print(f"[META UPLOAD] Upload response: {data2}")

    return data2.get("h")


def upload_media_for_send(data_uri: str, default_mime: str, wa_token: str, phone_id: str) -> str | None:
    """Upload base64 data URI to Meta for sending (returns media_id, not handle)."""
    if not data_uri or not data_uri.startswith("data:"):
        return None

    header_part, encoded = data_uri.split(",", 1)
    mime = header_part.split(";")[0].split(":")[1] if ":" in header_part else default_mime
    file_bytes = base64.b64decode(encoded)

    print(f"[META SEND UPLOAD] Uploading {len(file_bytes)} bytes, mime={mime}")

    resp = httpx.post(
        f"https://graph.facebook.com/{WA_API_VERSION}/{phone_id}/media",
        headers={"Authorization": f"Bearer {wa_token}"},
        files={"file": ("media", file_bytes, mime)},
        data={"messaging_product": "whatsapp", "type": mime},
        timeout=30,
    )
    data = resp.json()
    print(f"[META SEND UPLOAD] Response: {data}")
    return data.get("id")
