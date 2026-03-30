"""
AI Client — Functions to call Claude (Anthropic) API.
Extracted from ai_endpoints.py during Phase 6 refactor.
"""
import os
import httpx
from database.connection import SessionLocal
from database.models import AIConfig, AIProvider


async def call_anthropic(api_key: str, model: str, system_prompt: str, messages: list, temperature: float, max_tokens: int):
    """Call Claude API with prompt caching. System prompt cached for 5 min (90% cheaper on hits)."""
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        "messages": messages,
        "temperature": temperature,
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
        response.raise_for_status()

    result = response.json()
    text = ""
    for block in result.get("content", []):
        if block.get("type") == "text":
            text += block.get("text", "")
    tokens = result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0)
    return text, tokens


def _get_anthropic_credentials(model_override=None):
    """Resolve API key and model from AIProvider DB, fallback to env var."""
    anthropic_key = None
    model = model_override
    db_temp = SessionLocal()
    try:
        provider = db_temp.query(AIProvider).filter(
            AIProvider.provider_type == "anthropic",
            AIProvider.is_active == True,
        ).order_by(AIProvider.is_primary.desc(), AIProvider.priority.asc()).first()
        if provider and provider.api_key:
            anthropic_key = provider.api_key
            if not model:
                model = provider.model or "claude-sonnet-4-20250514"
        if not model:
            config = db_temp.query(AIConfig).filter(AIConfig.is_active == True).first()
            model = config.model if config and config.model and "claude" in (config.model or "") else "claude-sonnet-4-20250514"
    finally:
        db_temp.close()

    if not anthropic_key:
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    return anthropic_key, model or "claude-sonnet-4-20250514"


async def call_ai(system_prompt: str, history: list, user_message: str, image_b64: str = None, image_mime: str = None, model_override: str = None, tenant_id: int = 1, max_tokens: int = 2048) -> str:
    """Standalone AI call for WhatsApp auto-reply. Uses Claude only. Supports image vision."""
    anthropic_key, model = _get_anthropic_credentials(model_override)
    if not anthropic_key:
        return "Disculpa, no puedo responder en este momento. Intenta de nuevo mas tarde."

    # Build the user message — with image if provided (Claude Vision)
    if image_b64 and image_mime:
        user_content = [
            {
                "type": "image",
                "source": {"type": "base64", "media_type": image_mime, "data": image_b64},
            },
            {"type": "text", "text": user_message or "El cliente envio esta imagen. Describe lo que ves y responde."},
        ]
    else:
        user_content = user_message

    messages = list(history) + [{"role": "user", "content": user_content}]

    try:
        text, tokens = await call_anthropic(anthropic_key, model, system_prompt, messages, 0.4, max_tokens)
        try:
            from routes._usage_tracker import track_ai_usage
            track_ai_usage(tokens, tenant_id=tenant_id)
        except Exception:
            pass
        return text.strip()
    except Exception as e:
        error_str = str(e)[:200]
        print(f"[AI WhatsApp] Claude ({model}) failed: {error_str}")
        from activity_log import log_event
        log_event("error", f"Fallo llamada a Claude: {error_str}", detail=f"Modelo: {model}. Verificar API key y creditos.", status="error", tenant_id=tenant_id)
        return None


def call_ai_sync(system_prompt: str, history: list, user_message: str) -> str:
    """Synchronous AI call for scheduler morning review (runs in background thread)."""
    anthropic_key, model = _get_anthropic_credentials()
    if not anthropic_key:
        return None

    messages = list(history) + [{"role": "user", "content": user_message}]

    payload = {
        "model": model,
        "max_tokens": 2048,
        "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        "messages": messages,
        "temperature": 0.4,
    }
    headers = {"x-api-key": anthropic_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
            response.raise_for_status()

        result = response.json()
        text = ""
        for block in result.get("content", []):
            if block.get("type") == "text":
                text += block.get("text", "")
        tokens = result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0)
        try:
            from routes._usage_tracker import track_ai_usage
            track_ai_usage(tokens, tenant_id=1)
        except Exception:
            pass
        return text.strip() if text else None
    except Exception as e:
        print(f"[AI Sync] Claude failed: {e}")
        return None
