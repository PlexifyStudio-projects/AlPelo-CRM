import os
import re
import json
import httpx

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta

from database.connection import get_db, SessionLocal
from database.models import AIConfig, Staff, Client, VisitHistory, ClientNote, WhatsAppConversation, WhatsAppMessage, Service, Appointment, Tenant, Admin
from middleware.auth_middleware import get_current_user
from schemas import (
    AIConfigCreate, AIConfigUpdate, AIConfigResponse,
    AIChatRequest, AIChatResponse,
)
from routes._helpers import compute_client_list_item, compute_client_fields, find_client, find_conversation, normalize_phone, get_wa_token, get_wa_phone_id, safe_tid

# Timezone offsets for supported regions (UTC offset in hours)
_TIMEZONE_OFFSETS = {
    "America/Bogota": -5,       # Colombia
    "America/Lima": -5,         # Peru
    "America/Caracas": -4,      # Venezuela
    "America/Guayaquil": -5,    # Ecuador
    "America/Mexico_City": -6,  # Mexico
    "America/Santiago": -4,     # Chile
    "America/Buenos_Aires": -3, # Argentina
    "America/Sao_Paulo": -3,    # Brazil
    "America/Panama": -5,       # Panama
    "America/Costa_Rica": -6,   # Costa Rica
    "America/New_York": -5,     # US East (EST, no DST calc)
    "America/Los_Angeles": -8,  # US West (PST, no DST calc)
    "Europe/Madrid": 1,         # Spain
}

# Default offset (Colombia) — used when no tenant loaded
_DEFAULT_OFFSET = timedelta(hours=-5)

def _get_tenant_offset(db=None, tenant_id=None) -> timedelta:
    """Get timezone offset. Uses Colombia (UTC-5) as default.
    IMPORTANT: Always returns -5 for Colombia. The tenant lookup was unreliable
    (grabbed wrong tenant, caused Lina to think Saturday was Sunday)."""
    if db and tenant_id:
        try:
            from database.models import Tenant
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if tenant and tenant.timezone:
                offset_hours = _TIMEZONE_OFFSETS.get(tenant.timezone, -5)
                return timedelta(hours=offset_hours)
        except Exception:
            pass
    # ALWAYS Colombia UTC-5 as safe default
    return _DEFAULT_OFFSET

def _now_colombia(db=None) -> datetime:
    """Current datetime in Colombia (UTC-5). ALWAYS uses -5 offset."""
    return datetime.utcnow() + _DEFAULT_OFFSET

def _today_colombia(db=None) -> date:
    """Current date in the tenant's timezone."""
    return _now_colombia(db).date()

_DIAS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
_MESES_ES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

def _fecha_colombia_str(db=None) -> str:
    """'lunes 10 de marzo de 2026' in Spanish, using tenant's timezone."""
    now = _now_colombia(db)
    dia_sem = _DIAS_ES[now.weekday()]
    mes = _MESES_ES[now.month]
    return f"{dia_sem} {now.day} de {mes} de {now.year}"

router = APIRouter()


# ============================================================================
# AI CONFIG — CRUD
# ============================================================================

@router.get("/ai/config", response_model=AIConfigResponse)
def get_active_ai_config(db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    q = db.query(AIConfig).filter(AIConfig.is_active == True)
    if tid:
        q = q.filter(AIConfig.tenant_id == tid)
    config = q.first()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuracion de IA activa")
    return AIConfigResponse.model_validate(config)


@router.post("/ai/config", response_model=AIConfigResponse)
def create_ai_config(data: AIConfigCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    q_deactivate = db.query(AIConfig).filter(AIConfig.is_active == True)
    if tid:
        q_deactivate = q_deactivate.filter(AIConfig.tenant_id == tid)
    q_deactivate.update({"is_active": False})
    config = AIConfig(**data.model_dump(), tenant_id=tid)
    db.add(config)
    db.commit()
    db.refresh(config)
    return AIConfigResponse.model_validate(config)


@router.put("/ai/config/{config_id}", response_model=AIConfigResponse)
def update_ai_config(config_id: int, data: AIConfigUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    config = db.query(AIConfig).filter(AIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuracion no encontrada")
    if tid and config.tenant_id != tid:
        raise HTTPException(status_code=403, detail="No autorizado")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return AIConfigResponse.model_validate(config)


@router.get("/ai/status")
def ai_provider_status():
    """Check AI provider status."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    return {
        "anthropic": {"configured": bool(anthropic_key), "key_prefix": anthropic_key[:12] + "..." if anthropic_key else None},
    }


# ============================================================================
# BUSINESS CONTEXT BUILDER — Feeds real DB data to the AI
# ============================================================================

# Context builders moved to services/ai/context.py (Phase 6 refactor)
from services.ai.context import _build_business_context, _build_inbox_context

# ============================================================================
# AUTO-CREATE CLIENT — When Lina needs a client that doesn't exist yet
# ============================================================================

# Actions moved to services/ai/actions.py (Phase 6 refactor)
from services.ai.actions import _auto_create_client, _execute_action

# System prompt + WA context moved to services/ai/prompts.py (Phase 6 refactor)
from services.ai.prompts import _build_whatsapp_context, _build_system_prompt

# PROVIDER CALL — Claude (Anthropic) only
# ============================================================================

# _call_anthropic moved to services/ai/client.py (Phase 6 refactor)
from services.ai.client import call_anthropic as _call_anthropic

# ============================================================================
# AI CHAT — Main endpoint with context + action execution
# ============================================================================

ACTION_PATTERN = re.compile(r'```action\s*(.*?)```', re.DOTALL)

@router.post("/ai/chat", response_model=AIChatResponse)
async def ai_chat(data: AIChatRequest, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    # Check tenant-level AI pause — block all AI when paused
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first() if user.tenant_id else db.query(Tenant).filter(Tenant.is_active == True).first()
    if tenant and tenant.ai_is_paused:
        raise HTTPException(status_code=403, detail="La IA está pausada para esta agencia. Reactívala desde el panel de desarrollo.")

    # Read API key from AIProvider DB first (Dev Panel), fallback to env var
    from database.models import AIProvider
    _provider = db.query(AIProvider).filter(
        AIProvider.provider_type == "anthropic",
        AIProvider.is_active == True,
    ).order_by(AIProvider.is_primary.desc(), AIProvider.priority.asc()).first()
    anthropic_key = (_provider.api_key if _provider and _provider.api_key else None) or os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY no configurada. Configúrala en Dev Panel > Configuración > AI Providers.")

    _tid = user.tenant_id if user.tenant_id else (tenant.id if tenant else None)
    if _tid:
        config = db.query(AIConfig).filter(AIConfig.tenant_id == _tid, AIConfig.is_active == True).first()
    else:
        config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    sonnet_model = (config.model if config and config.model and "claude" in (config.model or "") else "claude-sonnet-4-20250514")
    temperature = config.temperature if config else 0.4

    # Build system prompt with live business data — scoped to tenant
    system_prompt = _build_system_prompt(db, tenant_id=_tid)

    # Build messages
    messages = []
    for msg in data.conversation_history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

    # Build the user message — with image if provided (Claude Vision)
    if data.image_base64 and data.image_mime:
        user_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": data.image_mime,
                    "data": data.image_base64,
                },
            },
            {"type": "text", "text": data.message or "El admin envio esta imagen. Describe lo que ves."},
        ]
        messages.append({"role": "user", "content": user_content})
        model = sonnet_model  # Vision always needs Sonnet
        max_tokens = max(config.max_tokens if config else 4096, 4096)
    else:
        messages.append({"role": "user", "content": data.message})
        # Smart routing for admin chat — Haiku for simple queries, Sonnet for actions/bulk ops
        from services.ai.client import classify_message_complexity, HAIKU_MODEL
        complexity = classify_message_complexity(data.message, [m for m in messages[:-1]])
        if complexity == "haiku":
            model = HAIKU_MODEL
            max_tokens = 2048  # Haiku doesn't need 4096
        else:
            model = sonnet_model
            max_tokens = max(config.max_tokens if config else 4096, 4096)  # Full power for bulk/complex ops

    # Call Claude
    try:
        print(f"[AI] Calling {model}")
        text, tokens = await _call_anthropic(anthropic_key, model, system_prompt, messages, temperature, max_tokens)
        print(f"[AI] Success ({tokens} tokens)")
    except httpx.HTTPStatusError as e:
        error_body = e.response.text[:200]
        print(f"[AI] Claude failed ({e.response.status_code}): {error_body}")
        raise HTTPException(status_code=502, detail=f"Error de IA: {error_body}")
    except httpx.RequestError as e:
        print(f"[AI] Connection error: {e}")
        raise HTTPException(status_code=502, detail="No se pudo conectar con el servicio de IA.")

    # Parse and execute any action blocks
    action_matches = ACTION_PATTERN.findall(text)

    action_results = []
    for action_json in action_matches:
        try:
            action = json.loads(action_json.strip())
            # Inject tenant_id from logged-in user so actions are tenant-scoped
            if user.tenant_id:
                action["tenant_id"] = user.tenant_id

            # BULK TASK: if it's a queue_bulk_task, execute ALL items inline
            # (admin is waiting with "typing..." indicator — execute everything now)
            if action.get("action") == "queue_bulk_task" and action.get("items"):
                from activity_log import log_event
                items = action["items"]
                desc = action.get("description", "Tarea masiva")
                ok_count = 0
                fail_count = 0
                log_event("accion", f"Iniciando tarea: {desc}", detail=f"{len(items)} items por procesar", status="info")
                for i, item in enumerate(items):
                    try:
                        if user.tenant_id:
                            item["tenant_id"] = user.tenant_id
                        _execute_action(item, db)
                        ok_count += 1
                    except Exception as item_err:
                        fail_count += 1
                        print(f"[AI] Bulk item {i+1} failed: {item_err}")
                summary = f"Tarea completada: {ok_count} creados" + (f", {fail_count} fallaron" if fail_count else "")
                log_event("accion", summary, detail=desc, status="ok" if fail_count == 0 else "warning")
                action_results.append(summary)
            else:
                from activity_log import log_event
                result = _execute_action(action, db)
                action_results.append(result)
                log_event("accion", f"Accion ejecutada: {action.get('action','?')}", detail=result[:150], status="ok" if "ERROR" not in result else "error")
        except json.JSONDecodeError:
            action_results.append("ERROR: No pude parsear la accion.")

    # Clean action blocks from response
    clean_text = ACTION_PATTERN.sub('', text).strip()

    if action_results:
        # Separate successful and failed results
        conflicts = [r for r in action_results if "CONFLICTO" in r]
        errors = [r for r in action_results if "ERROR" in r and "CONFLICTO" not in r]
        successes = [r for r in action_results if "CONFLICTO" not in r and "ERROR" not in r]

        if conflicts or errors:
            # OVERRIDE: Replace Lina's entire text with honest response
            parts = []
            if successes:
                parts.append("Lo que sí se hizo:")
                for s in successes:
                    parts.append(f"  ✅ {s}")
            if conflicts:
                parts.append("\nNo se pudo completar:")
                for c in conflicts:
                    parts.append(f"  ⚠️ {c}")
            if errors:
                for e in errors:
                    parts.append(f"  ❌ {e}")
            clean_text = "\n".join(parts)
        else:
            # All actions succeeded — keep Lina's text + append results
            results_str = "\n".join(f"✅ {r}" for r in action_results)
            clean_text += f"\n\n{results_str}"

    # Track AI usage per tenant in DB
    try:
        from routes._usage_tracker import track_ai_usage
        _tenant_id = user.tenant_id or (tenant.id if tenant else 1)
        track_ai_usage(tokens, tenant_id=_tenant_id)
    except Exception as e:
        print(f"[AI] Usage tracking error: {e}")

    return AIChatResponse(response=clean_text, tokens_used=tokens)


# ============================================================================
# STANDALONE AI CALL — Used by WhatsApp auto-reply
# ============================================================================

# _call_ai moved to services/ai/client.py (Phase 6 refactor)
from services.ai.client import call_ai as _call_ai

# _call_ai_sync moved to services/ai/client.py (Phase 6 refactor)
from services.ai.client import call_ai_sync as _call_ai_sync
