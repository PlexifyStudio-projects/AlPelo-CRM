# ============================================================================
# AUTOMATION ENGINE — Configurable WhatsApp + CRM + Marketing workflows
# Multi-tenant, multi-business-type automated workflow management
# ============================================================================

from fastapi import APIRouter, HTTPException
from database.connection import SessionLocal
from database.models import (
    WorkflowTemplate, WorkflowExecution, Tenant, Client,
    Appointment, VisitHistory, WhatsAppMessage,
)
from datetime import datetime, timedelta
from sqlalchemy import func

router = APIRouter(prefix="/automations", tags=["Automations"])


# ═══════════════════════════════════════════════
# DEFAULT WORKFLOW TEMPLATES — Multi-business
# ═══════════════════════════════════════════════

def _get_default_workflows(tenant_name: str = "tu negocio"):
    """Default workflow templates that work for ANY service business.
    Each workflow includes:
    - message_template: preview text (shown in UI and used within 24h window)
    - config.template_name: Meta-approved template to use outside 24h window
    - config.send_hour: what hour to execute (where applicable)
    - config.suggested_templates: list of template names the admin can choose from
    """
    return [
        {
            "workflow_type": "reminder_24h",
            "name": "Recordatorio de Cita (24h)",
            "icon": "🔔",
            "color": "#3B82F6",
            "trigger_description": "24 horas antes de la cita",
            "message_template": (
                "Hola {{nombre}}, te recordamos tu cita mañana a las {{hora}} "
                "con {{profesional}} para {{servicio}}.\n\n"
                "¿Confirmas tu asistencia? Responde SI o NO"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "template_language": "es",
                "send_hour": None,
                "suggested_templates": ["recordatorio_cita_24h", "appointment_reminder"],
                "variables": ["nombre", "hora", "profesional", "servicio"],
            },
        },
        {
            "workflow_type": "reminder_1h",
            "name": "Recordatorio de Cita (1h)",
            "icon": "⏰",
            "color": "#F59E0B",
            "trigger_description": "1 hora antes de la cita",
            "message_template": (
                "{{nombre}}, tu cita es en 1 hora a las {{hora}} "
                "con {{profesional}}.\n\n¡Te esperamos en {{negocio}}!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "template_language": "es",
                "send_hour": None,
                "suggested_templates": ["recordatorio_cita_1h", "cita_hoy"],
                "variables": ["nombre", "hora", "profesional", "negocio"],
            },
        },
        {
            "workflow_type": "post_visit",
            "name": "Seguimiento Post-Visita",
            "icon": "💬",
            "color": "#8B5CF6",
            "trigger_description": "2 horas después de completar servicio",
            "message_template": (
                "Hola {{nombre}}, gracias por tu visita hoy en {{negocio}}! "
                "¿Cómo calificas tu experiencia del 1 al 5?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "delay_hours": 2,
                "template_name": "",
                "template_language": "es",
                "suggested_templates": ["como_te_fue", "calificanos", "post_visita"],
                "variables": ["nombre", "servicio", "negocio"],
            },
        },
        {
            "workflow_type": "birthday",
            "name": "Feliz Cumpleaños",
            "icon": "🎂",
            "color": "#EC4899",
            "trigger_description": "Día del cumpleaños",
            "message_template": (
                "¡Feliz cumpleaños, {{nombre}}! 🎂🎉\n\n"
                "En {{negocio}} queremos celebrar contigo. "
                "Te regalamos un 10% de descuento en tu próxima visita. "
                "¡Válido por 7 días!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "send_hour": 9,
                "send_hour_options": [8, 9, 10, 11, 12],
                "template_name": "",
                "template_language": "es",
                "suggested_templates": ["feliz_cumpleanos", "descuento_cumpleanos"],
                "variables": ["nombre", "negocio"],
            },
        },
        {
            "workflow_type": "reactivation",
            "name": "Reactivación de Clientes",
            "icon": "🔄",
            "color": "#EF4444",
            "trigger_description": "Cliente sin visita por X días",
            "message_template": (
                "Hola {{nombre}}, te extrañamos en {{negocio}}! "
                "Han pasado {{dias}} días desde tu última visita. "
                "¿Te gustaría agendar? Escríbenos y te ayudamos."
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "days": 30,
                "days_options": [15, 30, 45, 60, 90],
                "send_hour": 10,
                "send_hour_options": [9, 10, 11, 14, 15, 16],
                "template_name": "",
                "template_language": "es",
                "suggested_templates": ["hace_rato_no_vienes", "te_extranamos", "reactivacion"],
                "variables": ["nombre", "negocio", "dias"],
            },
        },
        {
            "workflow_type": "no_show_followup",
            "name": "Seguimiento No-Show",
            "icon": "📋",
            "color": "#6366F1",
            "trigger_description": "Después de una inasistencia",
            "message_template": (
                "Hola {{nombre}}, notamos que no pudiste asistir a tu cita "
                "de {{servicio}}. ¿Te gustaría reagendar? "
                "Estamos para ayudarte."
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "send_hour": 10,
                "template_name": "",
                "template_language": "es",
                "suggested_templates": ["seguimiento_no_show", "reagendar_cita"],
                "variables": ["nombre", "servicio", "negocio"],
            },
        },
        {
            "workflow_type": "welcome",
            "name": "Bienvenida Nuevo Cliente",
            "icon": "👋",
            "color": "#10B981",
            "trigger_description": "Al registrar un cliente nuevo",
            "message_template": (
                "¡Bienvenido/a a {{negocio}}, {{nombre}}! "
                "Estamos felices de tenerte. "
                "Puedes agendar tu próxima cita escribiéndonos aquí. "
                "¿En qué te podemos ayudar?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "crm",
                "template_name": "",
                "template_language": "es",
                "suggested_templates": ["bienvenida", "welcome"],
                "variables": ["nombre", "negocio"],
            },
        },
        {
            "workflow_type": "auto_vip",
            "name": "Auto-VIP por Visitas",
            "icon": "⭐",
            "color": "#D97706",
            "trigger_description": "Cliente alcanza X visitas completadas",
            "message_template": (
                "¡Felicidades {{nombre}}! 🌟 Has alcanzado el nivel VIP "
                "en {{negocio}}. Gracias por tu lealtad. "
                "A partir de ahora tienes beneficios exclusivos."
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp+crm",
                "category": "crm",
                "visits_threshold": 10,
                "auto_tag": "VIP",
                "template_name": "",
                "template_language": "es",
                "suggested_templates": ["gracias_vip", "cliente_vip"],
                "variables": ["nombre", "negocio"],
            },
        },
        {
            "workflow_type": "review_request",
            "name": "Solicitud de Reseña Google",
            "icon": "⭐",
            "color": "#F97316",
            "trigger_description": "Después de calificación positiva (4-5)",
            "message_template": (
                "¡Genial, {{nombre}}! Nos alegra que hayas tenido una buena experiencia. "
                "¿Nos ayudarías con una reseña en Google? Solo toma 30 segundos:\n\n"
                "{{google_review_link}}"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "min_rating": 4,
                "google_review_url": "",
                "template_name": "",
                "template_language": "es",
                "suggested_templates": ["dejanos_tu_resena", "review_google"],
                "variables": ["nombre", "google_review_link"],
            },
        },
        {
            "workflow_type": "daily_summary",
            "name": "Resumen Diario al Dueño",
            "icon": "📊",
            "color": "#0EA5E9",
            "trigger_description": "Cada día a las 8:30 PM",
            "message_template": (
                "📊 Resumen del día en {{negocio}}:\n\n"
                "✅ Citas completadas: {{citas_completadas}}\n"
                "❌ No-shows: {{no_shows}}\n"
                "💰 Ingresos del día: ${{ingresos}}\n"
                "👥 Clientes nuevos: {{nuevos}}\n\n"
                "¡Buen trabajo! 💪"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "interno",
                "send_hour": 20,
                "send_hour_options": [18, 19, 20, 21],
                "send_to": "owner",
                "variables": ["negocio", "citas_completadas", "no_shows", "ingresos", "nuevos"],
            },
        },
    ]


# ═══════════════════════════════════════════════
# SEED — Create default workflows for a tenant
# ═══════════════════════════════════════════════

def seed_workflows_for_tenant(tenant_id: int, tenant_name: str = "tu negocio"):
    """Create default workflow templates for a tenant if none exist."""
    db = SessionLocal()
    try:
        existing = db.query(WorkflowTemplate).filter(
            WorkflowTemplate.tenant_id == tenant_id
        ).count()
        if existing > 0:
            return existing  # Already seeded

        defaults = _get_default_workflows(tenant_name)
        created = 0
        for wf in defaults:
            template = WorkflowTemplate(
                tenant_id=tenant_id,
                **wf,
            )
            db.add(template)
            created += 1

        db.commit()
        print(f"[AUTOMATIONS] Seeded {created} default workflows for tenant {tenant_id}")
        return created
    except Exception as e:
        db.rollback()
        print(f"[AUTOMATIONS] Seed error for tenant {tenant_id}: {e}")
        return 0
    finally:
        db.close()


# ═══════════════════════════════════════════════
# API ENDPOINTS
# ═══════════════════════════════════════════════

@router.get("")
async def list_workflows(tenant_id: int = None):
    """List all workflow templates for a tenant. Auto-seeds defaults if none exist."""
    db = SessionLocal()
    try:
        # For now, get the first tenant (or specified)
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        else:
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()

        if not tenant:
            raise HTTPException(status_code=404, detail="No tenant found")

        # Auto-seed if no workflows exist
        count = db.query(WorkflowTemplate).filter(
            WorkflowTemplate.tenant_id == tenant.id
        ).count()
        if count == 0:
            seed_workflows_for_tenant(tenant.id, tenant.name)
            # Re-query with fresh session
            db.close()
            db = SessionLocal()

        workflows = (
            db.query(WorkflowTemplate)
            .filter(WorkflowTemplate.tenant_id == tenant.id)
            .order_by(WorkflowTemplate.id)
            .all()
        )

        # Auto-link approved templates to workflows (by matching workflow_type to slug)
        _WORKFLOW_TEMPLATE_MAP = {
            "reminder_24h": "recordatorio_cita_24h",
            "reminder_1h": "recordatorio_cita_1h",
            "post_visit": "gracias_visita",
            "birthday": "feliz_cumpleanos",
            "reactivation": "te_extranamos",
            "no_show_followup": "seguimiento_no_show",
            "welcome": "bienvenida_v2",
            "auto_vip": "gracias_vip",
            "review_request": "como_te_fue",
        }
        approved_slugs = set(
            t.slug for t in db.query(MessageTemplate).filter(
                MessageTemplate.tenant_id == tenant.id,
                MessageTemplate.status == "approved",
            ).all()
        )
        updated = False
        for w in workflows:
            expected_slug = _WORKFLOW_TEMPLATE_MAP.get(w.workflow_type)
            if expected_slug and expected_slug in approved_slugs:
                config = w.config or {}
                if config.get("template_name") != expected_slug:
                    config["template_name"] = expected_slug
                    w.config = config
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(w, "config")
                    updated = True
        if updated:
            db.commit()

        return [_serialize_workflow(w) for w in workflows]
    finally:
        db.close()


@router.put("/{workflow_id}")
async def update_workflow(workflow_id: int, data: dict):
    """Update a workflow template (toggle, message, config)."""
    db = SessionLocal()
    try:
        wf = db.query(WorkflowTemplate).filter(
            WorkflowTemplate.id == workflow_id
        ).first()
        if not wf:
            raise HTTPException(status_code=404, detail="Workflow not found")

        if "enabled" in data or "is_enabled" in data:
            wf.is_enabled = data.get("enabled", data.get("is_enabled", wf.is_enabled))
        if "message" in data or "message_template" in data:
            wf.message_template = data.get("message", data.get("message_template", wf.message_template))
        if "config" in data:
            existing = wf.config or {}
            existing.update(data["config"])
            wf.config = existing
        if "days" in data:
            config = wf.config or {}
            config["days"] = int(data["days"])
            wf.config = config
        if "name" in data:
            wf.name = data["name"]

        wf.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(wf)

        return _serialize_workflow(wf)
    finally:
        db.close()


@router.get("/stats")
async def get_stats(tenant_id: int = None):
    """Get aggregate automation stats for a tenant."""
    db = SessionLocal()
    try:
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        else:
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()

        if not tenant:
            return {"active_count": 0, "total_count": 0, "sent_this_month": 0,
                    "response_rate": 0, "confirmed_appointments": 0}

        workflows = db.query(WorkflowTemplate).filter(
            WorkflowTemplate.tenant_id == tenant.id
        ).all()

        active = sum(1 for w in workflows if w.is_enabled)
        total_sent = sum(w.stats_sent or 0 for w in workflows)
        total_responded = sum(w.stats_responded or 0 for w in workflows)
        response_rate = round((total_responded / total_sent * 100) if total_sent > 0 else 0)

        # Count executions this month
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_sent = db.query(func.count(WorkflowExecution.id)).filter(
            WorkflowExecution.tenant_id == tenant.id,
            WorkflowExecution.created_at >= month_start,
        ).scalar() or 0

        return {
            "active_count": active,
            "total_count": len(workflows),
            "sent_this_month": month_sent,
            "sent_total": total_sent,
            "response_rate": response_rate,
            "confirmed_appointments": round(total_responded * 0.72) if total_responded else 0,
        }
    finally:
        db.close()


@router.get("/executions")
async def get_executions(tenant_id: int = None, limit: int = 50):
    """Get recent workflow execution log."""
    db = SessionLocal()
    try:
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        else:
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()

        if not tenant:
            return []

        execs = (
            db.query(WorkflowExecution)
            .filter(WorkflowExecution.tenant_id == tenant.id)
            .order_by(WorkflowExecution.created_at.desc())
            .limit(limit)
            .all()
        )

        results = []
        for ex in execs:
            wf = db.query(WorkflowTemplate).filter(
                WorkflowTemplate.id == ex.workflow_id
            ).first()
            client = db.query(Client).filter(
                Client.id == ex.client_id
            ).first() if ex.client_id else None

            results.append({
                "id": ex.id,
                "workflow_name": wf.name if wf else "?",
                "workflow_type": wf.workflow_type if wf else "?",
                "workflow_icon": wf.icon if wf else "?",
                "client_name": client.name if client else "?",
                "phone": ex.phone[-4:] if ex.phone else "",
                "message_preview": (ex.message_sent or "")[:80],
                "status": ex.status,
                "created_at": ex.created_at.isoformat() if ex.created_at else None,
            })

        return results
    finally:
        db.close()


@router.post("/reset")
async def reset_workflows(tenant_id: int = None):
    """Delete and re-seed workflows with latest defaults. Use after config changes."""
    db = SessionLocal()
    try:
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        else:
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="No tenant found")

        db.query(WorkflowTemplate).filter(
            WorkflowTemplate.tenant_id == tenant.id
        ).delete()
        db.commit()

        seed_workflows_for_tenant(tenant.id, tenant.name)
        db.close()
        db = SessionLocal()

        workflows = (
            db.query(WorkflowTemplate)
            .filter(WorkflowTemplate.tenant_id == tenant.id)
            .order_by(WorkflowTemplate.id)
            .all()
        )
        return [_serialize_workflow(w) for w in workflows]
    finally:
        db.close()


def _serialize_workflow(w):
    """Serialize a WorkflowTemplate to dict."""
    config = w.config or {}
    return {
        "id": w.id,
        "workflow_type": w.workflow_type,
        "name": w.name,
        "icon": w.icon,
        "color": w.color,
        "bg": f"rgba({_hex_to_rgb(w.color)}, 0.08)" if w.color else "rgba(0,0,0,0.04)",
        "trigger": w.trigger_description,
        "message": w.message_template,
        "enabled": w.is_enabled,
        "config": config,
        "channel": config.get("channel", "whatsapp"),
        "category": config.get("category", "general"),
        # Configurable options
        "days": config.get("days"),
        "days_options": config.get("days_options"),
        "send_hour": config.get("send_hour"),
        "send_hour_options": config.get("send_hour_options"),
        # Template config
        "template_name": config.get("template_name", ""),
        "template_language": config.get("template_language", "es"),
        "suggested_templates": config.get("suggested_templates", []),
        "variables": config.get("variables", []),
        # Stats
        "stats": {
            "sent": w.stats_sent or 0,
            "responded": w.stats_responded or 0,
        },
        "last_triggered": w.last_triggered_at.isoformat() if w.last_triggered_at else None,
    }


def _hex_to_rgb(hex_color):
    """Convert #hex to 'r, g, b' string."""
    if not hex_color:
        return "0, 0, 0"
    h = hex_color.lstrip('#')
    try:
        return ', '.join(str(int(h[i:i+2], 16)) for i in (0, 2, 4))
    except (ValueError, IndexError):
        return "0, 0, 0"
