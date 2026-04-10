"""
AI Client — Functions to call Claude (Anthropic) API.
Extracted from ai_endpoints.py during Phase 6 refactor.
Includes smart model routing: Haiku for simple queries, Sonnet for complex ones.
"""
import os
import re
import httpx
from database.connection import SessionLocal
from database.models import AIConfig, AIProvider


# ── MODEL ROUTING: Classify message complexity ──────────────────────────
# Simple messages go to Haiku (~10x cheaper), complex to Sonnet

_COMPLEX_KEYWORDS = re.compile(
    r"(agend|cancel|reagend|program|cambi.*(cita|hora)|mover?.*cita"
    r"|crea.*client|registr|elimina|actualiz"
    r"|para mi (primo|esposa|amigo|hermano|mama|papa)"
    r"|quiero.*cita|necesito.*cita|me puedes.*agendar"
    r"|cambiar.*hora|mover.*hora"
    r"|PENDIENTE|APRENDIZAJE|FEEDBACK"
    r"|queue_bulk_task"
    r"|cuanto cuesta.*y.*agend"  # price + booking combined
    r")",
    re.IGNORECASE,
)

_SIMPLE_PATTERNS = re.compile(
    r"^(gracias|ok|listo|dale|perfecto"
    r"|si|no|bueno|vale|bien|genial|excelente"
    r"|estas ahi"
    r"|cuanto (cuesta|sale|vale|es)"
    r"|que servicios|que horario|a que hora|cuando abren|cuando cierran"
    r"|tienen.*disponib|hay.*espacio"
    r"|mi cita|a que hora es|cuando es"
    r"|chao|adios|hasta luego|nos vemos|bye)[\s?!.]*$",
    re.IGNORECASE,
)

HAIKU_MODEL = "claude-haiku-4-5-20251001"


_GREETING_OPENER = re.compile(
    r"^(hola|buenos?\s*(dias|tardes|noches)|buenas\s*(tardes|noches)?|hi|hey|que tal|como estas)",
    re.IGNORECASE,
)

def classify_message_complexity(user_message: str, history: list = None) -> str:
    """Classify whether a message needs Sonnet (complex) or Haiku (simple).
    Returns 'sonnet' or 'haiku'.

    Sonnet: actions, greetings (need warmth/personality), images, long/complex msgs.
    Haiku: short replies (ok, si, gracias, dale), confirmations, one-word answers."""
    if not user_message:
        return "haiku"

    msg = user_message.strip()

    # Images always need Sonnet (vision)
    if isinstance(msg, list):  # multimodal content
        return "sonnet"

    # If message contains action keywords → Sonnet
    if _COMPLEX_KEYWORDS.search(msg):
        return "sonnet"

    # If history has recent action results, conflicts, or scheduling context → Sonnet
    if history:
        last_assistant = None
        for entry in reversed(history):
            if entry.get("role") == "assistant":
                last_assistant = entry.get("content", "")
                break
        if last_assistant:
            if "```action" in last_assistant or "CONFLICTO" in last_assistant or "PENDIENTE" in last_assistant:
                return "sonnet"
            la = last_assistant.lower()
            if any(kw in la for kw in ("agendar", "agendo", "agendarte", "cita", "horario", "disponib", "te puedo ofrecer", "qué hora", "a las")):
                return "sonnet"

    # Greeting openers → Sonnet (need warmth, personality, proper saludo)
    # "Hola, están abiertos?" needs Sonnet for proper greeting + answer
    if _GREETING_OPENER.match(msg):
        return "sonnet"

    # Short simple replies (no greeting) → Haiku
    # These are mid-conversation confirmations: "ok", "si", "gracias", "dale"
    if _SIMPLE_PATTERNS.match(msg):
        return "haiku"

    # Messages with multiple questions or long text → Sonnet
    question_marks = msg.count("?")
    if question_marks >= 3:
        return "sonnet"
    if len(msg) > 300:
        return "sonnet"

    # Default: Haiku for mid-conversation info queries without greeting
    return "haiku"


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
    """Standalone AI call for WhatsApp auto-reply. Uses smart routing: Haiku for simple, Sonnet for complex."""
    anthropic_key, sonnet_model = _get_anthropic_credentials(model_override)
    if not anthropic_key:
        return "Disculpa, no puedo responder en este momento. Intenta de nuevo mas tarde."

    # Smart model routing — save tokens on simple queries
    if model_override:
        model = model_override  # Explicit override (retries, continuations)
    elif image_b64:
        model = sonnet_model  # Vision needs Sonnet
    else:
        complexity = classify_message_complexity(user_message, history)
        model = HAIKU_MODEL if complexity == "haiku" else sonnet_model
        if complexity == "haiku":
            print(f"[AI Router] HAIKU — simple message: {(user_message or '')[:60]}")

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

        # SAFETY: If Haiku returned action blocks, that's fine — it can handle simple actions.
        # But if Haiku response seems confused or empty, fallback to Sonnet.
        if model == HAIKU_MODEL and text and ("no puedo" in text.lower() or "no tengo acceso" in text.lower()):
            print(f"[AI Router] Haiku confused — escalating to Sonnet")
            text, tokens = await call_anthropic(anthropic_key, sonnet_model, system_prompt, messages, 0.4, max_tokens)
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


def call_ai_sync(system_prompt: str, history: list, user_message: str, use_haiku: bool = False, max_tokens: int = 800) -> str:
    """Synchronous AI call for scheduler morning review (runs in background thread).
    use_haiku=True for follow-up/sweep messages (10x cheaper, quality sufficient)."""
    anthropic_key, sonnet_model = _get_anthropic_credentials()
    if not anthropic_key:
        return None

    model = HAIKU_MODEL if use_haiku else sonnet_model
    messages = list(history) + [{"role": "user", "content": user_message}]

    payload = {
        "model": model,
        "max_tokens": max_tokens,
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
