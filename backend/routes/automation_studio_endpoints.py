# ============================================================================
# AUTOMATION STUDIO — API endpoints for user-created automations
# CRUD, audience preview, Meta submission, execution history
# ============================================================================

import os
import re
import json
import httpx
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import (
    AutomationRule, AutomationExecution, Tenant, Client, Service,
)
from datetime import datetime, timedelta
from sqlalchemy import func
from routes._helpers import safe_tid, normalize_phone, now_colombia
from routes._media_helpers import upload_media_to_meta
from middleware.auth_middleware import get_current_user
from automation_engine import (
    PLAN_LIMITS, get_plan_limit, TRIGGER_EVALUATORS, preview_audience,
)

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")

router = APIRouter(prefix="/automation-studio", tags=["Automation Studio"])


# ============================================================================
# TRIGGER DEFINITIONS — Sent to frontend for wizard UI
# ============================================================================

TRIGGER_DEFINITIONS = [
    # ── CITAS ──
    {"type": "hours_before_appt", "name": "Recordatorio de cita", "description": "X horas antes de una cita confirmada", "category": "appointments",
     "config_fields": [{"key": "hours", "label": "Horas antes", "type": "number", "default": 24, "min": 1, "max": 168}],
     "variables": ["nombre", "negocio", "hora", "fecha", "profesional", "servicio"]},
    {"type": "hours_after_complete", "name": "Seguimiento post-visita", "description": "X horas después de completar un servicio", "category": "appointments",
     "config_fields": [{"key": "hours", "label": "Horas después", "type": "number", "default": 2, "min": 1, "max": 72}],
     "variables": ["nombre", "negocio", "servicio", "profesional"]},
    {"type": "appointment_created", "name": "Confirmación de cita", "description": "Al crear o confirmar una nueva cita", "category": "appointments",
     "config_fields": [], "variables": ["nombre", "negocio", "hora", "fecha", "profesional", "servicio"]},
    {"type": "appointment_cancelled", "name": "Cita cancelada", "description": "Cuando se cancela una cita", "category": "appointments",
     "config_fields": [], "variables": ["nombre", "negocio", "hora", "fecha", "profesional"]},
    {"type": "appointment_rescheduled", "name": "Cita reagendada", "description": "Cuando se mueve una cita a otro horario", "category": "appointments",
     "config_fields": [], "variables": ["nombre", "negocio", "hora", "fecha", "profesional"]},
    {"type": "no_show", "name": "No-show / Inasistencia", "description": "Al día siguiente de una inasistencia", "category": "appointments",
     "config_fields": [], "variables": ["nombre", "negocio"]},
    {"type": "rebooking_reminder", "name": "Sugerir re-agendar", "description": "Cuando pasó el ciclo habitual de visita del cliente", "category": "appointments",
     "config_fields": [{"key": "days", "label": "Días del ciclo", "type": "number", "default": 21, "min": 7, "max": 180}],
     "variables": ["nombre", "negocio", "dias"]},

    # ── CLIENTES ──
    {"type": "new_client", "name": "Bienvenida", "description": "Al registrar un nuevo cliente en el sistema", "category": "clients",
     "config_fields": [], "variables": ["nombre", "negocio"]},
    {"type": "days_since_visit", "name": "Cliente inactivo", "description": "X días sin visitar — recuperación automática", "category": "clients",
     "config_fields": [{"key": "days", "label": "Días sin visitar", "type": "number", "default": 30, "min": 7, "max": 365}],
     "variables": ["nombre", "negocio", "dias"]},
    {"type": "birthday", "name": "Cumpleaños", "description": "El día del cumpleaños del cliente", "category": "clients",
     "config_fields": [], "variables": ["nombre", "negocio"]},
    {"type": "visit_milestone", "name": "Milestone de visitas", "description": "Al alcanzar X visitas (5, 10, 25, 50...)", "category": "clients",
     "config_fields": [{"key": "milestone", "label": "Número de visitas", "type": "number", "default": 10, "min": 3, "max": 100}],
     "variables": ["nombre", "negocio"]},
    {"type": "client_anniversary", "name": "Aniversario de cliente", "description": "1 año desde la primera visita", "category": "clients",
     "config_fields": [], "variables": ["nombre", "negocio"]},
    {"type": "vip_reached", "name": "Cliente VIP", "description": "Cuando un cliente alcanza el estado VIP", "category": "clients",
     "config_fields": [{"key": "min_visits", "label": "Visitas para VIP", "type": "number", "default": 15, "min": 5, "max": 100}],
     "variables": ["nombre", "negocio"]},
    {"type": "client_at_risk", "name": "Cliente en riesgo", "description": "Cuando un cliente activo empieza a alejarse", "category": "clients",
     "config_fields": [{"key": "days", "label": "Días sin actividad", "type": "number", "default": 45, "min": 14, "max": 180}],
     "variables": ["nombre", "negocio", "dias"]},

    # ── MARKETING ──
    {"type": "satisfaction_survey", "name": "Encuesta de satisfacción", "description": "Pedir calificación X horas después de la visita", "category": "marketing",
     "config_fields": [{"key": "hours", "label": "Horas después", "type": "number", "default": 4, "min": 1, "max": 48}],
     "variables": ["nombre", "negocio", "servicio", "profesional"]},
    {"type": "review_request", "name": "Pedir reseña Google", "description": "Invitar al cliente a dejar reseña en Google", "category": "marketing",
     "config_fields": [{"key": "hours", "label": "Horas después de visita", "type": "number", "default": 24, "min": 2, "max": 72}],
     "variables": ["nombre", "negocio"]},
    {"type": "referral_program", "name": "Programa de referidos", "description": "Invitar a clientes a referir amigos", "category": "marketing",
     "config_fields": [{"key": "min_visits", "label": "Mín. visitas para invitar", "type": "number", "default": 3, "min": 1, "max": 20}],
     "variables": ["nombre", "negocio"]},
    {"type": "seasonal_promo", "name": "Promoción de temporada", "description": "Mensaje promocional programado para una fecha", "category": "marketing",
     "config_fields": [], "variables": ["nombre", "negocio"]},
    {"type": "winback_offer", "name": "Oferta de recuperación", "description": "Descuento especial para clientes que no vuelven", "category": "marketing",
     "config_fields": [{"key": "days", "label": "Días sin visitar", "type": "number", "default": 90, "min": 30, "max": 365}],
     "variables": ["nombre", "negocio", "dias", "descuento"]},
    {"type": "upsell_suggestion", "name": "Sugerencia de servicio", "description": "Recomendar servicio complementario basado en historial", "category": "marketing",
     "config_fields": [{"key": "hours", "label": "Horas después de visita", "type": "number", "default": 48, "min": 12, "max": 168}],
     "variables": ["nombre", "negocio", "servicio"]},

    # ── FIDELIZACIÓN ──
    {"type": "loyalty_welcome", "name": "Bienvenida al programa", "description": "Al unirse al programa de lealtad/puntos", "category": "loyalty",
     "config_fields": [], "variables": ["nombre", "negocio"]},
    {"type": "loyalty_points", "name": "Puntos acumulados", "description": "Notificar cuando alcanza X puntos de lealtad", "category": "loyalty",
     "config_fields": [{"key": "points", "label": "Puntos mínimos", "type": "number", "default": 100, "min": 10, "max": 10000}],
     "variables": ["nombre", "negocio"]},
    {"type": "loyalty_reward", "name": "Premio disponible", "description": "Avisar que tiene un premio canjeable", "category": "loyalty",
     "config_fields": [], "variables": ["nombre", "negocio"]},
    {"type": "first_visit_thanks", "name": "Gracias por su primera visita", "description": "Mensaje especial después de la primera visita", "category": "loyalty",
     "config_fields": [{"key": "hours", "label": "Horas después", "type": "number", "default": 3, "min": 1, "max": 24}],
     "variables": ["nombre", "negocio", "servicio"]},
    {"type": "vip_exclusive", "name": "Oferta exclusiva VIP", "description": "Mensaje exclusivo para clientes VIP", "category": "loyalty",
     "config_fields": [], "variables": ["nombre", "negocio", "descuento"]},

    # ── PAGOS ──
    {"type": "payment_received", "name": "Confirmación de pago", "description": "Al registrar un pago por un servicio", "category": "payments",
     "config_fields": [], "variables": ["nombre", "negocio", "servicio"]},
    {"type": "payment_pending", "name": "Pago pendiente", "description": "24h después de servicio sin pago registrado", "category": "payments",
     "config_fields": [], "variables": ["nombre", "negocio"]},
    {"type": "digital_receipt", "name": "Recibo digital", "description": "Enviar recibo por WhatsApp al pagar", "category": "payments",
     "config_fields": [], "variables": ["nombre", "negocio", "servicio"]},
    {"type": "membership_expiring", "name": "Membresía por vencer", "description": "X días antes de que expire la membresía/paquete", "category": "payments",
     "config_fields": [{"key": "days", "label": "Días antes de vencer", "type": "number", "default": 7, "min": 1, "max": 30}],
     "variables": ["nombre", "negocio", "dias"]},

]


# ============================================================================
# SUGGESTED TEMPLATES — Pre-built automations by business type
# ============================================================================

def _get_suggested_templates(business_type="peluqueria", tenant_name="tu negocio"):
    """Return suggested automation templates based on business type."""
    # Universal templates (all businesses)
    universal = [
        {
            "name": "Recordatorio de cita 24h",
            "trigger_type": "hours_before_appt",
            "trigger_config": {"hours": 24},
            "action_config": {
                "message": f"Hola {{{{nombre}}}}! Le recordamos que mañana tiene cita en {{{{negocio}}}} a las {{{{hora}}}}. ¿Confirma su asistencia? Responda SÍ o NO."
            },
            "cooldown_days": 1,
            "max_per_day": 50,
        },
        {
            "name": "Bienvenida cliente nuevo",
            "trigger_type": "new_client",
            "trigger_config": {},
            "action_config": {
                "message": f"Hola {{{{nombre}}}}! Bienvenido/a a {{{{negocio}}}}. Es un placer tenerle con nosotros. Si necesita agendar una cita o tiene alguna consulta, estamos para servirle."
            },
            "cooldown_days": 365,
            "max_per_day": 20,
        },
        {
            "name": "Felicitación de cumpleaños",
            "trigger_type": "birthday",
            "trigger_config": {},
            "eval_hour": 9,
            "action_config": {
                "message": f"¡Feliz cumpleaños, {{{{nombre}}}}! 🎉 De parte de todo el equipo de {{{{negocio}}}}, le deseamos un excelente día. Tiene un detalle especial esperándole en su próxima visita."
            },
            "cooldown_days": 365,
            "max_per_day": 20,
        },
        {
            "name": "Reactivación 30 días",
            "trigger_type": "days_since_visit",
            "trigger_config": {"days": 30},
            "eval_hour": 10,
            "action_config": {
                "message": f"Hola {{{{nombre}}}}, le extrañamos en {{{{negocio}}}}. Ya pasaron {{{{dias}}}} días desde su última visita. ¿Le agendamos para esta semana?"
            },
            "cooldown_days": 14,
            "max_per_day": 10,
        },
        {
            "name": "Seguimiento post-visita",
            "trigger_type": "hours_after_complete",
            "trigger_config": {"hours": 2},
            "action_config": {
                "message": f"Hola {{{{nombre}}}}, gracias por visitarnos hoy en {{{{negocio}}}}. Esperamos que todo haya sido de su agrado. ¡Lo esperamos pronto!"
            },
            "cooldown_days": 1,
            "max_per_day": 20,
        },
        {
            "name": "Seguimiento no-show",
            "trigger_type": "no_show",
            "trigger_config": {},
            "eval_hour": 9,
            "action_config": {
                "message": f"Hola {{{{nombre}}}}, notamos que no pudo asistir a su cita en {{{{negocio}}}}. ¿Todo bien? Si desea reagendar, estamos para servirle."
            },
            "cooldown_days": 7,
            "max_per_day": 10,
        },
    ]

    return universal


# ============================================================================
# SERIALIZATION
# ============================================================================

def _serialize_rule(rule):
    """Serialize an AutomationRule for the frontend."""
    trigger_def = next((t for t in TRIGGER_DEFINITIONS if t["type"] == rule.trigger_type), None)
    return {
        "id": rule.id,
        "name": rule.name,
        "trigger_type": rule.trigger_type,
        "trigger_name": trigger_def["name"] if trigger_def else rule.trigger_type,
        "trigger_description": trigger_def["description"] if trigger_def else "",
        "trigger_category": trigger_def["category"] if trigger_def else "other",
        "trigger_config": rule.trigger_config or {},
        "filter_config": rule.filter_config or {},
        "action_type": rule.action_type or "send_whatsapp",
        "action_config": rule.action_config or {},
        "chain_config": rule.chain_config,
        "meta_template_name": rule.meta_template_name,
        "meta_template_status": rule.meta_template_status or "draft",
        "is_enabled": rule.is_enabled,
        "cooldown_days": rule.cooldown_days or 1,
        "max_per_day": rule.max_per_day or 20,
        "eval_hour": rule.eval_hour,
        "available_variables": trigger_def["variables"] if trigger_def else [],
        "stats": {
            "sent": rule.stats_sent or 0,
            "responded": rule.stats_responded or 0,
            "failed": rule.stats_failed or 0,
        },
        "last_triggered": rule.last_triggered_at.isoformat() if rule.last_triggered_at else None,
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
    }


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("")
async def list_automations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List all automation rules for the tenant."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(400, "No tenant assigned")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    plan_limit = get_plan_limit(tenant) if tenant else 3

    rules = (
        db.query(AutomationRule)
        .filter(AutomationRule.tenant_id == tid)
        .order_by(AutomationRule.is_enabled.desc(), AutomationRule.created_at.desc())
        .all()
    )

    active_count = sum(1 for r in rules if r.is_enabled)

    return {
        "automations": [_serialize_rule(r) for r in rules],
        "plan": tenant.plan if tenant else "trial",
        "plan_limit": plan_limit,
        "active_count": active_count,
        "total_count": len(rules),
    }


@router.post("")
async def create_automation(body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Create a new automation rule."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(400, "No tenant assigned")

    # Enforce plan limit — count total rules (active or not)
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    plan_limit = get_plan_limit(tenant) if tenant else 3
    total_rules = db.query(AutomationRule).filter(AutomationRule.tenant_id == tid).count()
    if total_rules >= plan_limit:
        raise HTTPException(
            403,
            f"Límite de automatizaciones alcanzado ({total_rules}/{plan_limit}). "
            f"Actualice su plan para crear más."
        )

    trigger_type = body.get("trigger_type")
    if trigger_type not in TRIGGER_EVALUATORS:
        raise HTTPException(400, f"Trigger type '{trigger_type}' no válido")

    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "El nombre es requerido")

    action_config = body.get("action_config", {})
    message = action_config.get("message", "").strip()
    if not message:
        raise HTTPException(400, "El mensaje es requerido")

    rule = AutomationRule(
        tenant_id=tid,
        name=name,
        trigger_type=trigger_type,
        trigger_config=body.get("trigger_config", {}),
        filter_config=body.get("filter_config", {}),
        action_type=body.get("action_type", "send_whatsapp"),
        action_config=action_config,
        chain_config=body.get("chain_config"),
        cooldown_days=body.get("cooldown_days", 1),
        max_per_day=body.get("max_per_day", 20),
        eval_hour=body.get("eval_hour"),
        is_enabled=False,
        meta_template_status="draft",
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)

    return _serialize_rule(rule)


@router.put("/{rule_id}")
async def update_automation(rule_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Update an existing automation rule."""
    tid = safe_tid(user, db)
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.tenant_id == tid,
    ).first()
    if not rule:
        raise HTTPException(404, "Automatización no encontrada")

    # Update fields
    if "name" in body:
        rule.name = body["name"]
    if "trigger_config" in body:
        rule.trigger_config = body["trigger_config"]
    if "filter_config" in body:
        rule.filter_config = body["filter_config"]
    if "action_config" in body:
        old_msg = (rule.action_config or {}).get("message", "")
        new_msg = body["action_config"].get("message", "")
        rule.action_config = body["action_config"]
        # Reset Meta status if message changed
        if old_msg != new_msg and rule.meta_template_status == "approved":
            rule.meta_template_status = "draft"
            rule.meta_template_name = None
            rule.is_enabled = False
    if "chain_config" in body:
        rule.chain_config = body["chain_config"]
    if "cooldown_days" in body:
        rule.cooldown_days = body["cooldown_days"]
    if "max_per_day" in body:
        rule.max_per_day = body["max_per_day"]
    if "eval_hour" in body:
        rule.eval_hour = body["eval_hour"]
    if "is_enabled" in body:
        # Can only enable if Meta template is approved
        if body["is_enabled"] and rule.meta_template_status != "approved":
            raise HTTPException(400, "No puede activar sin aprobación de Meta. Envíe la plantilla primero.")
        # Enforce plan limit on activation
        if body["is_enabled"]:
            tenant = db.query(Tenant).filter(Tenant.id == rule.tenant_id).first()
            plan_limit = get_plan_limit(tenant) if tenant else 3
            active_count = db.query(AutomationRule).filter(
                AutomationRule.tenant_id == rule.tenant_id,
                AutomationRule.is_enabled == True,
                AutomationRule.id != rule.id
            ).count()
            if active_count >= plan_limit:
                raise HTTPException(
                    403,
                    f"Límite de automatizaciones activas alcanzado ({active_count}/{plan_limit}). "
                    f"Desactive una existente o actualice su plan."
                )
        rule.is_enabled = body["is_enabled"]

    rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rule)

    return _serialize_rule(rule)


@router.delete("/{rule_id}")
async def delete_automation(rule_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Delete an automation rule and its executions."""
    tid = safe_tid(user, db)
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.tenant_id == tid,
    ).first()
    if not rule:
        raise HTTPException(404, "Automatización no encontrada")

    # Delete executions first (cascade should handle but be safe)
    db.query(AutomationExecution).filter(AutomationExecution.automation_id == rule_id).delete()
    db.delete(rule)
    db.commit()

    return {"ok": True}


@router.post("/{rule_id}/duplicate")
async def duplicate_automation(rule_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Duplicate an automation rule."""
    tid = safe_tid(user, db)
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.tenant_id == tid,
    ).first()
    if not rule:
        raise HTTPException(404, "Automatización no encontrada")

    new_rule = AutomationRule(
        tenant_id=tid,
        name=f"{rule.name} (copia)",
        trigger_type=rule.trigger_type,
        trigger_config=rule.trigger_config,
        filter_config=rule.filter_config,
        action_type=rule.action_type,
        action_config=rule.action_config,
        chain_config=rule.chain_config,
        cooldown_days=rule.cooldown_days,
        max_per_day=rule.max_per_day,
        eval_hour=rule.eval_hour,
        is_enabled=False,
        meta_template_status="draft",
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    return _serialize_rule(new_rule)


# ============================================================================
# AUDIENCE PREVIEW — Shows matching clients before activating
# ============================================================================

@router.post("/preview-audience")
async def api_preview_audience(body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Preview how many clients match the given trigger + filters."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(400, "No tenant assigned")

    trigger_type = body.get("trigger_type")
    if not trigger_type:
        raise HTTPException(400, "trigger_type is required")

    result = preview_audience(
        db, tid,
        trigger_type=trigger_type,
        trigger_config=body.get("trigger_config", {}),
        filter_config=body.get("filter_config", {}),
    )
    return result


# ============================================================================
# META TEMPLATE SUBMISSION — Submit automation message for WhatsApp approval
# ============================================================================

_AUTOMATION_TEMPLATE_SLUG_MAP = {
    "hours_before_appt": "auto_recordatorio",
    "hours_after_complete": "auto_postvisita",
    "appointment_created": "auto_confirmacion",
    "appointment_cancelled": "auto_cancelacion",
    "no_show": "auto_noshow",
    "days_since_visit": "auto_reactivacion",
    "new_client": "auto_bienvenida",
    "birthday": "auto_cumpleanos",
    "visit_milestone": "auto_milestone",
    "client_anniversary": "auto_aniversario",
    "payment_received": "auto_pago",
    "payment_pending": "auto_pago_pendiente",
}


def _convert_variables_to_meta(body_text):
    """Convert {{nombre}} style to {{1}} style for Meta API."""
    variables = []
    seen = set()

    def replacer(match):
        var_name = match.group(1)
        if var_name not in seen:
            seen.add(var_name)
            variables.append(var_name)
        idx = variables.index(var_name) + 1
        return "{{" + str(idx) + "}}"

    converted = re.sub(r'\{\{(\w+)\}\}', replacer, body_text)
    return converted, variables


@router.post("/{rule_id}/submit-to-meta")
async def submit_to_meta(rule_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Submit automation message template to Meta for approval."""
    tid = safe_tid(user, db)
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.tenant_id == tid,
    ).first()
    if not rule:
        raise HTTPException(404, "Automatización no encontrada")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant or not tenant.wa_business_account_id or not tenant.wa_access_token:
        raise HTTPException(400, "WhatsApp Business no configurado para este tenant")

    action_config = rule.action_config or {}
    message = action_config.get("message", "")
    if not message:
        raise HTTPException(400, "El mensaje no puede estar vacío")

    # Pad message if starts/ends with variable (Meta rejects this)
    padded_message = message
    if padded_message.strip().startswith("{{"):
        padded_message = "Hola " + padded_message
    if padded_message.strip().endswith("}}"):
        padded_message = padded_message + "."

    # Convert variables to Meta format
    converted_body, variables = _convert_variables_to_meta(padded_message)

    # Build template slug — clean for Meta (lowercase, underscores, no special chars)
    base_slug = _AUTOMATION_TEMPLATE_SLUG_MAP.get(rule.trigger_type, "auto_custom")
    slug = f"{base_slug}_{rule.id}"
    slug = re.sub(r'[^a-z0-9_]', '_', slug.lower())[:64]

    # Example values for Meta (comprehensive like old system)
    example_values = {
        "nombre": "Juan",
        "negocio": tenant.name or "Mi Negocio",
        "hora": "10:00 AM",
        "fecha": "15 de abril de 2026",
        "profesional": "Carlos",
        "servicio": "Consulta General",
        "dias": "30",
        "descuento": "20%",
        "monto": "50000",
        "visitas": "12",
        "puntos": "500",
        "telefono": "+573001234567",
        "direccion": "Calle 123",
        "plan": "Premium",
    }
    example_params = [example_values.get(v, f"valor_{v}") for v in variables]

    # Determine category
    trigger_def = next((t for t in TRIGGER_DEFINITIONS if t["type"] == rule.trigger_type), None)
    category_map = {
        "appointments": "UTILITY",
        "clients": "MARKETING",
        "payments": "UTILITY",
    }
    meta_category = category_map.get(trigger_def["category"], "UTILITY") if trigger_def else "UTILITY"

    # Build Meta payload — BODY component first
    body_component = {
        "type": "BODY",
        "text": converted_body,
    }
    if variables and example_params:
        body_component["example"] = {"body_text": [example_params]}

    components = []

    # Add HEADER component if media/text header exists in action_config
    header_type = action_config.get("header_type")
    header_media_url = action_config.get("header_media_url")
    header_text_val = action_config.get("header_text")

    if header_type in ("IMAGE", "VIDEO") and header_media_url:
        default_mime = "image/jpeg" if header_type == "IMAGE" else "video/mp4"
        try:
            handle = upload_media_to_meta(
                header_media_url, default_mime,
                wa_token=tenant.wa_access_token,
                phone_id=tenant.wa_phone_number_id,
            )
            if handle:
                components.append({
                    "type": "HEADER",
                    "format": header_type,
                    "example": {"header_handle": [handle]},
                })
                print(f"[AUTO-STUDIO META] Header {header_type} with handle: {str(handle)[:30]}...")
            else:
                print(f"[AUTO-STUDIO META] No handle returned, submitting {header_type} header without example")
                components.append({"type": "HEADER", "format": header_type})
        except Exception as e:
            print(f"[AUTO-STUDIO META] Header upload error: {e}")
            components.append({"type": "HEADER", "format": header_type})
    elif header_type == "TEXT" and header_text_val:
        components.append({
            "type": "HEADER",
            "format": "TEXT",
            "text": header_text_val,
        })

    components.append(body_component)

    payload = {
        "name": slug,
        "language": "es",
        "category": meta_category,
        "components": components,
    }

    print(f"[AUTO-STUDIO META] URL: https://graph.facebook.com/{WA_API_VERSION}/{tenant.wa_business_account_id}/message_templates")
    print(f"[AUTO-STUDIO META] Payload: {json.dumps(payload, ensure_ascii=False)}")

    # Submit to Meta
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"https://graph.facebook.com/{WA_API_VERSION}/{tenant.wa_business_account_id}/message_templates",
                headers={
                    "Authorization": f"Bearer {tenant.wa_access_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            data = resp.json()
            print(f"[AUTO-STUDIO META] Response {resp.status_code}: {json.dumps(data, ensure_ascii=False)[:500]}")

            if resp.status_code in (200, 201):
                status = data.get("status", "PENDING")
                rule.meta_template_name = slug
                rule.meta_template_status = "approved" if status == "APPROVED" else "pending"
                # Store variables in action_config
                action_config["template_name"] = slug
                action_config["template_language"] = "es"
                action_config["variables"] = variables
                rule.action_config = action_config
                rule.updated_at = datetime.utcnow()
                db.commit()

                return {
                    "ok": True,
                    "meta_status": rule.meta_template_status,
                    "template_name": slug,
                    "meta_response": data,
                }
            else:
                error = data.get("error", {})
                error_msg = error.get("message", str(data)[:300])
                error_user_msg = error.get("error_user_msg", "")
                error_code = error.get("code", 0)
                error_subcode = error.get("error_subcode", 0)
                print(f"[AUTO-STUDIO META] ERROR code={error_code} subcode={error_subcode} msg={error_msg} user_msg={error_user_msg}")

                # Check if template already exists (English or Spanish error)
                is_duplicate = (
                    error_code == 2388023 or
                    "already exists" in error_msg.lower() or
                    "ya existe" in error_msg.lower() or
                    "ya existe" in error_user_msg.lower()
                )

                if is_duplicate:
                    # Retry with _v2, _v3, etc.
                    for suffix_num in range(2, 6):
                        v_slug = f"{slug}_v{suffix_num}"
                        payload["name"] = v_slug
                        print(f"[AUTO-STUDIO META] Retrying with slug: {v_slug}")
                        retry_resp = await client.post(
                            f"https://graph.facebook.com/{WA_API_VERSION}/{tenant.wa_business_account_id}/message_templates",
                            headers={"Authorization": f"Bearer {tenant.wa_access_token}", "Content-Type": "application/json"},
                            json=payload,
                        )
                        retry_data = retry_resp.json()
                        print(f"[AUTO-STUDIO META] Retry response: {retry_resp.status_code} {json.dumps(retry_data, ensure_ascii=False)[:300]}")

                        if retry_resp.status_code in (200, 201):
                            retry_status = retry_data.get("status", "PENDING")
                            rule.meta_template_name = v_slug
                            rule.meta_template_status = "approved" if retry_status == "APPROVED" else "pending"
                            action_config["template_name"] = v_slug
                            action_config["template_language"] = "es"
                            action_config["variables"] = variables
                            rule.action_config = action_config
                            rule.updated_at = datetime.utcnow()
                            db.commit()
                            return {
                                "ok": True,
                                "meta_status": rule.meta_template_status,
                                "template_name": v_slug,
                            }

                        # Check if this suffix also exists
                        retry_err = retry_data.get("error", {}).get("error_user_msg", "")
                        if "ya existe" not in retry_err.lower() and "already exists" not in retry_err.lower():
                            break  # Different error, stop retrying

                    # If all retries failed, still save as pending
                    rule.meta_template_name = slug
                    rule.meta_template_status = "pending"
                    action_config["template_name"] = slug
                    action_config["variables"] = variables
                    rule.action_config = action_config
                    db.commit()
                    return {
                        "ok": True,
                        "meta_status": "pending",
                        "template_name": slug,
                        "note": "Template exists in Meta, verifying status...",
                    }

                detail_msg = error_user_msg or error_msg
                raise HTTPException(400, f"Meta rechazó la plantilla: {detail_msg}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTO-STUDIO META] Exception: {e}")
        raise HTTPException(500, f"Error al enviar a Meta: {str(e)}")


@router.post("/{rule_id}/check-meta-status")
async def check_meta_status(rule_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Check the approval status of a submitted template in Meta."""
    tid = safe_tid(user, db)
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.tenant_id == tid,
    ).first()
    if not rule:
        raise HTTPException(404, "Automatización no encontrada")

    if not rule.meta_template_name:
        raise HTTPException(400, "Esta automatización no ha sido enviada a Meta")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant or not tenant.wa_business_account_id or not tenant.wa_access_token:
        raise HTTPException(400, "WhatsApp Business no configurado")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{tenant.wa_business_account_id}/message_templates",
                headers={"Authorization": f"Bearer {tenant.wa_access_token}"},
                params={"name": rule.meta_template_name, "limit": 1},
            )
            data = resp.json()
            templates = data.get("data", [])

            if templates:
                meta_status = templates[0].get("status", "PENDING")
                status_map = {
                    "APPROVED": "approved",
                    "PENDING": "pending",
                    "REJECTED": "rejected",
                    "PAUSED": "rejected",
                    "DISABLED": "rejected",
                }
                new_status = status_map.get(meta_status, "pending")
                rule.meta_template_status = new_status
                rule.updated_at = datetime.utcnow()
                db.commit()

                return {
                    "meta_status": new_status,
                    "meta_raw_status": meta_status,
                    "rejection_reason": templates[0].get("quality_score", {}).get("reasons", []),
                }
            else:
                return {"meta_status": rule.meta_template_status, "note": "Template not found in Meta"}

    except Exception as e:
        raise HTTPException(500, f"Error al consultar Meta: {str(e)}")


# ============================================================================
# EXECUTION HISTORY
# ============================================================================

@router.get("/executions")
async def list_all_executions(
    limit: int = 50,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List recent executions across all automations."""
    tid = safe_tid(user, db)
    executions = (
        db.query(AutomationExecution)
        .filter(AutomationExecution.tenant_id == tid)
        .order_by(AutomationExecution.created_at.desc())
        .limit(limit)
        .all()
    )

    result = []
    for ex in executions:
        rule = db.query(AutomationRule).filter(AutomationRule.id == ex.automation_id).first()
        client = db.query(Client).filter(Client.id == ex.client_id).first() if ex.client_id else None
        result.append({
            "id": ex.id,
            "automation_id": ex.automation_id,
            "automation_name": rule.name if rule else "Eliminada",
            "client_name": client.name if client else "Desconocido",
            "client_phone": ex.phone[-4:] if ex.phone else "",
            "message_preview": (ex.message_sent or "")[:100],
            "is_chain": ex.is_chain,
            "status": ex.status,
            "created_at": ex.created_at.isoformat() if ex.created_at else None,
        })

    return result


@router.get("/{rule_id}/executions")
async def list_rule_executions(
    rule_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List executions for a specific automation rule."""
    tid = safe_tid(user, db)
    rule = db.query(AutomationRule).filter(
        AutomationRule.id == rule_id,
        AutomationRule.tenant_id == tid,
    ).first()
    if not rule:
        raise HTTPException(404, "Automatización no encontrada")

    executions = (
        db.query(AutomationExecution)
        .filter(
            AutomationExecution.automation_id == rule_id,
            AutomationExecution.tenant_id == tid,
        )
        .order_by(AutomationExecution.created_at.desc())
        .limit(limit)
        .all()
    )

    # Monthly stats
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    month_execs = (
        db.query(AutomationExecution)
        .filter(
            AutomationExecution.automation_id == rule_id,
            AutomationExecution.created_at >= month_start,
        )
        .all()
    )
    sent_month = sum(1 for e in month_execs if e.status in ("sent", "delivered", "responded"))
    responded_month = sum(1 for e in month_execs if e.status == "responded")

    result = []
    for ex in executions:
        client = db.query(Client).filter(Client.id == ex.client_id).first() if ex.client_id else None
        result.append({
            "id": ex.id,
            "client_name": client.name if client else "Desconocido",
            "client_phone": ex.phone[-4:] if ex.phone else "",
            "message_preview": (ex.message_sent or "")[:100],
            "is_chain": ex.is_chain,
            "status": ex.status,
            "created_at": ex.created_at.isoformat() if ex.created_at else None,
        })

    return {
        "executions": result,
        "month_stats": {
            "sent": sent_month,
            "responded": responded_month,
            "response_rate": round(responded_month / sent_month * 100, 1) if sent_month > 0 else 0,
        },
    }


# ============================================================================
# STATS
# ============================================================================

@router.get("/stats")
async def get_stats(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get aggregate automation stats for the tenant."""
    tid = safe_tid(user, db)

    rules = db.query(AutomationRule).filter(AutomationRule.tenant_id == tid).all()
    active = sum(1 for r in rules if r.is_enabled)
    total_sent = sum(r.stats_sent or 0 for r in rules)
    total_responded = sum(r.stats_responded or 0 for r in rules)

    # This month
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    month_count = (
        db.query(AutomationExecution)
        .filter(
            AutomationExecution.tenant_id == tid,
            AutomationExecution.created_at >= month_start,
        )
        .count()
    )

    return {
        "active_count": active,
        "total_count": len(rules),
        "sent_this_month": month_count,
        "sent_total": total_sent,
        "response_rate": round(total_responded / total_sent * 100, 1) if total_sent > 0 else 0,
    }


# ============================================================================
# TRIGGER DEFINITIONS & SUGGESTED TEMPLATES (for frontend wizard)
# ============================================================================

@router.get("/triggers")
async def get_trigger_definitions(user=Depends(get_current_user)):
    """Return all available trigger types for the wizard."""
    return TRIGGER_DEFINITIONS


@router.get("/suggested-templates")
async def get_suggested(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return suggested automation templates for this tenant's business type."""
    tid = safe_tid(user, db)
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    business_type = tenant.business_type if tenant else "general"
    tenant_name = tenant.name if tenant else "tu negocio"

    templates = _get_suggested_templates(business_type, tenant_name)
    return {"business_type": business_type, "templates": templates}


# ============================================================================
# CLIENT LIST — For audience preview dropdown
# ============================================================================

@router.get("/clients-preview")
async def clients_preview(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Return a few clients for the message preview selector."""
    tid = safe_tid(user, db)
    clients = (
        db.query(Client)
        .filter(Client.tenant_id == tid, Client.is_active == True)
        .order_by(Client.updated_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": c.id,
            "name": c.name,
            "phone": c.phone[-4:] if c.phone else "",
            "favorite_service": c.favorite_service,
        }
        for c in clients
    ]
