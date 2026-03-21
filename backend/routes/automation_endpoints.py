# ============================================================================
# AUTOMATION ENGINE — Configurable WhatsApp + CRM + Marketing workflows
# Multi-tenant, multi-business-type automated workflow management
# ============================================================================

import os
import re
import httpx
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database.connection import SessionLocal, get_db
from database.models import (
    WorkflowTemplate, WorkflowExecution, Tenant, Client,
    Appointment, VisitHistory, WhatsAppMessage, MessageTemplate,
)
from datetime import datetime, timedelta
from sqlalchemy import func
from routes._helpers import safe_tid
from middleware.auth_middleware import get_current_user

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")

router = APIRouter(prefix="/automations", tags=["Automations"])


# ═══════════════════════════════════════════════
# DEFAULT WORKFLOW TEMPLATES — Multi-business
# ═══════════════════════════════════════════════

def _get_default_workflows(tenant_name: str = "tu negocio"):
    """Default workflow templates that work for ANY service business.
    40 workflows across 9 categories: citas, post-visita, retencion,
    fidelizacion, cumpleanos, marketing, pagos, operativo, disponibilidad.
    """
    return [
        # ── CITAS — Pre-visita (6) ──────────────────────────────
        {
            "workflow_type": "confirmation",
            "name": "Confirmación de Cita",
            "icon": "✅",
            "color": "#3B82F6",
            "trigger_description": "Al crear o confirmar una cita",
            "message_template": (
                "Hola {{nombre}}! Tu cita quedo confirmada para el {{fecha}} a las {{hora}} "
                "con {{profesional}} para tu {{servicio}}. Te esperamos! Si necesitas cambiar "
                "algo me escribes por aqui"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "fecha", "hora", "profesional", "servicio"],
            },
        },
        {
            "workflow_type": "reminder_24h",
            "name": "Recordatorio 24 Horas",
            "icon": "🔔",
            "color": "#3B82F6",
            "trigger_description": "24 horas antes de la cita",
            "message_template": (
                "Hola {{nombre}}! Te escribo para recordarte que mañana tienes cita a las "
                "{{hora}} con {{profesional}}. ¿Nos confirmas que vienes? Cualquier cosa me "
                "avisas por aqui"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "hora", "profesional"],
            },
        },
        {
            "workflow_type": "reminder_1h",
            "name": "Recordatorio 1 Hora",
            "icon": "⏰",
            "color": "#2563EB",
            "trigger_description": "1 hora antes de la cita",
            "message_template": (
                "Hola {{nombre}}! Tu cita es en 1 hora a las {{hora}} con {{profesional}}. "
                "Te estamos esperando! Recuerda llegar unos minuticos antes"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "hora", "profesional"],
            },
        },
        {
            "workflow_type": "reschedule",
            "name": "Cita Reagendada",
            "icon": "📅",
            "color": "#2563EB",
            "trigger_description": "Al mover una cita a otro horario",
            "message_template": (
                "Hola {{nombre}}! Te confirmo que tu cita fue movida para el {{fecha}} a las "
                "{{hora}} con {{profesional}}. Si necesitas otro cambio me dices"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "fecha", "hora", "profesional"],
            },
        },
        {
            "workflow_type": "cancellation",
            "name": "Cita Cancelada",
            "icon": "❌",
            "color": "#1D4ED8",
            "trigger_description": "Al cancelar una cita",
            "message_template": (
                "Hola {{nombre}}! Tu cita del {{fecha}} fue cancelada. Si quieres reagendar "
                "para otro dia me escribes y con gusto te ayudo a buscar un horario que te sirva"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "fecha"],
            },
        },
        {
            "workflow_type": "client_confirmed",
            "name": "Cliente Confirmó Cita",
            "icon": "👍",
            "color": "#1D4ED8",
            "trigger_description": "Cuando el cliente confirma asistencia",
            "message_template": (
                "Hola {{nombre}}! Listo, tu cita queda confirmada. Te esperamos el {{fecha}} "
                "a las {{hora}}. Que tengas buen dia!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "fecha", "hora"],
            },
        },
        # ── POST-VISITA (5) ─────────────────────────────────────
        {
            "workflow_type": "post_visit_thanks",
            "name": "Agradecimiento Post-Visita",
            "icon": "💬",
            "color": "#8B5CF6",
            "trigger_description": "2 horas después de completar servicio",
            "message_template": (
                "Hola {{nombre}}! Gracias por visitarnos hoy. Fue un gusto atenderte! "
                "Esperamos que hayas quedado contento/a con tu {{servicio}}. Nos vemos pronto"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio"],
            },
        },
        {
            "workflow_type": "rating_request",
            "name": "Solicitar Calificación",
            "icon": "⭐",
            "color": "#8B5CF6",
            "trigger_description": "4 horas después del servicio",
            "message_template": (
                "Hola {{nombre}}! Oye, queria preguntarte como te fue con tu {{servicio}} "
                "de hoy. ¿Te gusto el resultado? Tu opinion nos ayuda mucho a mejorar"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio"],
            },
        },
        {
            "workflow_type": "review_google",
            "name": "Reseña en Google",
            "icon": "🌟",
            "color": "#7C3AED",
            "trigger_description": "Después de calificación positiva (4-5)",
            "message_template": (
                "Hola {{nombre}}! Que bueno que te haya gustado! Oye, te pido un favorcito: "
                "si puedes dejarnos una resenita en Google nos ayudaria muchisimo. Solo toma "
                "30 segundos y para nosotros vale oro"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre"],
            },
        },
        {
            "workflow_type": "post_care_tips",
            "name": "Tips de Cuidado",
            "icon": "💡",
            "color": "#7C3AED",
            "trigger_description": "Día siguiente al servicio",
            "message_template": (
                "Hola {{nombre}}! Te queria compartir unos tips para que tu {{servicio}} "
                "te dure mas tiempo y se vea increible. Cualquier duda me escribes!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio"],
            },
        },
        {
            "workflow_type": "suggest_next_service",
            "name": "Sugerir Servicio Siguiente",
            "icon": "💎",
            "color": "#8B5CF6",
            "trigger_description": "3 días después del servicio",
            "message_template": (
                "Hola {{nombre}}! Por cierto, viendo tu historial creo que te podria interesar "
                "{{servicio_sugerido}}. Si te llama la atencion me dices y te cuento los detalles"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio_sugerido"],
            },
        },
        # ── RETENCIÓN (6) ──────────────────────────────────────
        {
            "workflow_type": "reactivation_30d",
            "name": "Reactivación 30 Días",
            "icon": "🔄",
            "color": "#EF4444",
            "trigger_description": "Cliente sin visita por 30 días",
            "message_template": (
                "Hola {{nombre}}! Hace rato no te vemos por aqui y te extrañamos. ¿Como has "
                "estado? Si quieres agendar algo me escribes y te busco un horario que te "
                "quede bien"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre"],
            },
        },
        {
            "workflow_type": "reactivation_60d",
            "name": "Reactivación 60 Días",
            "icon": "📩",
            "color": "#F97316",
            "trigger_description": "Cliente sin visita por 60 días",
            "message_template": (
                "Hola {{nombre}}! Ya van como {{dias}} dias desde tu ultima visita y queria "
                "ver como estas. Te tenemos una sorpresa si te animas a venir esta semana. "
                "¿Te cuento?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "dias"],
            },
        },
        {
            "workflow_type": "reactivation_90d",
            "name": "Reactivación 90 Días",
            "icon": "🚨",
            "color": "#DC2626",
            "trigger_description": "Cliente sin visita por 90 días",
            "message_template": (
                "Hola {{nombre}}! Oye, no queremos perderte como cliente. Te tenemos un "
                "descuento especial esperandote, pero es solo por estos dias. ¿Te interesa?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre"],
            },
        },
        {
            "workflow_type": "no_show_followup",
            "name": "Seguimiento No-Show",
            "icon": "📋",
            "color": "#EF4444",
            "trigger_description": "Después de una inasistencia",
            "message_template": (
                "Hola {{nombre}}! Vi que no pudiste venir a tu cita de {{servicio}}. ¿Todo "
                "bien? Si quieres la reagendamos para otro dia, sin problema. Me dices"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio"],
            },
        },
        {
            "workflow_type": "rebooking_cycle",
            "name": "Ciclo de Reagendamiento",
            "icon": "🔁",
            "color": "#F97316",
            "trigger_description": "Según frecuencia habitual del cliente",
            "message_template": (
                "Hola {{nombre}}! Segun tu ritmo ya te estaria tocando tu proximo {{servicio}}. "
                "¿Quieres que te busque un horario? Me dices y te ayudo"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio"],
            },
        },
        {
            "workflow_type": "winback_discount",
            "name": "Recuperación con Descuento",
            "icon": "🎯",
            "color": "#DC2626",
            "trigger_description": "Cliente inactivo con oferta especial",
            "message_template": (
                "Hola {{nombre}}! Ha pasado un tiempito y la verdad te extrañamos. Te quiero "
                "ofrecer un descuento especial para que vuelvas. ¿Que dia te queda bien?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre"],
            },
        },
        # ── FIDELIZACIÓN (5) ───────────────────────────────────
        {
            "workflow_type": "welcome",
            "name": "Bienvenida Nuevo Cliente",
            "icon": "👋",
            "color": "#10B981",
            "trigger_description": "Al registrar un cliente nuevo",
            "message_template": (
                "Hola {{nombre}}! Bienvenido/a a {{negocio}}! Que bueno tenerte con nosotros. "
                "Aqui puedes escribirnos para agendar citas, preguntar precios o lo que "
                "necesites. Estamos para ti!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "crm",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "negocio"],
            },
        },
        {
            "workflow_type": "auto_vip",
            "name": "Auto-VIP por Visitas",
            "icon": "⭐",
            "color": "#10B981",
            "trigger_description": "Cliente alcanza nivel VIP",
            "message_template": (
                "Hola {{nombre}}! Tenemos algo especial para ti: ya alcanzaste el nivel VIP "
                "con nosotros! Gracias por tu lealtad. A partir de ahora tienes beneficios "
                "exclusivos que te van a encantar"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "crm",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre"],
            },
        },
        {
            "workflow_type": "anniversary",
            "name": "Aniversario de Cliente",
            "icon": "🎉",
            "color": "#059669",
            "trigger_description": "1 año desde la primera visita",
            "message_template": (
                "Hola {{nombre}}! Hoy se cumple 1 año desde tu primera visita a {{negocio}} "
                "y queriamos agradecerte por confiar en nosotros. Ha sido un gusto atenderte "
                "todo este tiempo!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "crm",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "negocio"],
            },
        },
        {
            "workflow_type": "referral_thanks",
            "name": "Gracias por Referido",
            "icon": "🤝",
            "color": "#059669",
            "trigger_description": "Cuando un referido visita por primera vez",
            "message_template": (
                "Hola {{nombre}}! Queria darte las gracias porque alguien vino de tu parte a "
                "{{negocio}}. Eso para nosotros vale mucho. Te tenemos un detallito como "
                "agradecimiento!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "crm",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "negocio"],
            },
        },
        {
            "workflow_type": "visit_milestone",
            "name": "Hito de Visitas",
            "icon": "🏆",
            "color": "#10B981",
            "trigger_description": "Al alcanzar X visitas (10, 25, 50...)",
            "message_template": (
                "Hola {{nombre}}! Ya llevas {{visitas}} visitas con nosotros, eso es increible! "
                "Gracias por tu confianza. Te tenemos algo especial por ser de nuestros "
                "clientes mas fieles"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "crm",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "visitas"],
            },
        },
        # ── CUMPLEAÑOS (3) ─────────────────────────────────────
        {
            "workflow_type": "birthday",
            "name": "Feliz Cumpleaños",
            "icon": "🎂",
            "color": "#EC4899",
            "trigger_description": "Día del cumpleaños del cliente",
            "message_template": (
                "Hola {{nombre}}! Feliz cumpleaños! De parte de todo el equipo de {{negocio}} "
                "te deseamos un dia increible. Te tenemos un detallito: un descuento especial "
                "solo por ser tu dia"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": 9,
                "variables": ["nombre", "negocio"],
            },
        },
        {
            "workflow_type": "pre_birthday",
            "name": "Pre-Cumpleaños",
            "icon": "🎁",
            "color": "#DB2777",
            "trigger_description": "3 días antes del cumpleaños",
            "message_template": (
                "Hola {{nombre}}! Tu cumple se acerca y en {{negocio}} ya te tenemos algo "
                "preparado. Estate pendiente que te va a gustar!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": 10,
                "variables": ["nombre", "negocio"],
            },
        },
        {
            "workflow_type": "birthday_reminder_use",
            "name": "Recordatorio Descuento Cumpleaños",
            "icon": "⏳",
            "color": "#EC4899",
            "trigger_description": "5 días después del cumpleaños si no ha usado descuento",
            "message_template": (
                "Hola {{nombre}}! Oye, tu descuento de cumpleaños vence pronto. No lo dejes "
                "pasar! Si quieres agendar algo esta semana me dices y te busco un horario"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre"],
            },
        },
        # ── MARKETING / PROMOS (6) ─────────────────────────────
        {
            "workflow_type": "promo_weekly",
            "name": "Promo Semanal",
            "icon": "🏷️",
            "color": "#F59E0B",
            "trigger_description": "Envío semanal programado",
            "message_template": (
                "Hola {{nombre}}! Esta semana tenemos algo especial: {{servicio}} con "
                "descuento. Cupos limitados, si te interesa me dices y te lo aparto"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio"],
            },
        },
        {
            "workflow_type": "new_service",
            "name": "Servicio Nuevo",
            "icon": "✨",
            "color": "#F59E0B",
            "trigger_description": "Al agregar un servicio nuevo al catálogo",
            "message_template": (
                "Hola {{nombre}}! Te cuento que ahora tenemos un servicio nuevo: "
                "{{servicio_nuevo}}. Creo que te podria gustar. ¿Quieres saber mas?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio_nuevo"],
            },
        },
        {
            "workflow_type": "flash_sale",
            "name": "Oferta Relámpago",
            "icon": "⚡",
            "color": "#D97706",
            "trigger_description": "Activación manual de oferta flash",
            "message_template": (
                "Hola {{nombre}}! Solo por hoy tenemos una oferta que no te puedes perder. "
                "Preguntame y te cuento los detalles antes de que se acabe"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre"],
            },
        },
        {
            "workflow_type": "bring_friend",
            "name": "Trae un Amigo",
            "icon": "👥",
            "color": "#D97706",
            "trigger_description": "Campaña de referidos activa",
            "message_template": (
                "Hola {{nombre}}! Tenemos una promo buenisima: trae a un amigo/a y los dos "
                "reciben descuento. Asi de facil. ¿Te animas?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre"],
            },
        },
        {
            "workflow_type": "combo_special",
            "name": "Combo Especial",
            "icon": "🎯",
            "color": "#F59E0B",
            "trigger_description": "Al crear un combo de servicios",
            "message_template": (
                "Hola {{nombre}}! Te queria contar de un combo que armamos: {{servicio1}} + "
                "{{servicio2}} a precio especial. Si te interesa me dices"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio1", "servicio2"],
            },
        },
        {
            "workflow_type": "seasonal_promo",
            "name": "Promo de Temporada",
            "icon": "🌟",
            "color": "#D97706",
            "trigger_description": "Campaña de temporada (navidad, día de la madre, etc.)",
            "message_template": (
                "Hola {{nombre}}! Se viene {{temporada}} y en {{negocio}} preparamos algo "
                "especial para ti. ¿Quieres que te cuente?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "marketing",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "temporada", "negocio"],
            },
        },
        # ── PAGOS (3) ──────────────────────────────────────────
        {
            "workflow_type": "payment_confirmed",
            "name": "Pago Confirmado",
            "icon": "💰",
            "color": "#22C55E",
            "trigger_description": "Al registrar un pago",
            "message_template": (
                "Hola {{nombre}}! Tu pago de ${{monto}} quedo registrado correctamente. "
                "Muchas gracias! Si necesitas factura o comprobante me dices"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "pagos",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "monto"],
            },
        },
        {
            "workflow_type": "payment_reminder",
            "name": "Recordatorio de Pago",
            "icon": "💳",
            "color": "#16A34A",
            "trigger_description": "Saldo pendiente por cobrar",
            "message_template": (
                "Hola {{nombre}}! Te escribo porque tienes un saldo pendiente de ${{monto}} "
                "por tu {{servicio}}. ¿Como te queda mas facil pagarlo? Me dices y lo "
                "coordinamos"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "pagos",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "monto", "servicio"],
            },
        },
        {
            "workflow_type": "digital_receipt",
            "name": "Recibo Digital",
            "icon": "🧾",
            "color": "#22C55E",
            "trigger_description": "Al completar un servicio pagado",
            "message_template": (
                "Hola {{nombre}}! Aqui te mando tu recibo: {{servicio}} por ${{monto}}. Si "
                "tienes alguna duda me escribes. Gracias por tu preferencia!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "pagos",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "servicio", "monto"],
            },
        },
        # ── OPERATIVO — Interno (4) ────────────────────────────
        {
            "workflow_type": "daily_summary",
            "name": "Resumen Diario",
            "icon": "📊",
            "color": "#0EA5E9",
            "trigger_description": "Cada día al cierre de jornada",
            "message_template": (
                "Hola! Aqui va el resumen del dia en {{negocio}}: {{completadas}} citas "
                "completadas, {{no_shows}} no-shows, ${{ingresos}} en ingresos, {{nuevos}} "
                "clientes nuevos. Buen trabajo!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "interno",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": 20,
                "variables": ["negocio", "completadas", "no_shows", "ingresos", "nuevos"],
            },
        },
        {
            "workflow_type": "weekly_summary",
            "name": "Resumen Semanal",
            "icon": "📈",
            "color": "#0EA5E9",
            "trigger_description": "Cada domingo al cierre de la semana",
            "message_template": (
                "Hola! Resumen de la semana en {{negocio}}: {{total_citas}} citas atendidas, "
                "${{ingresos}} en ingresos, {{nuevos}} clientes nuevos. Vamos bien!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "interno",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": 20,
                "variables": ["negocio", "total_citas", "ingresos", "nuevos"],
            },
        },
        {
            "workflow_type": "noshow_alert",
            "name": "Alerta de No-Shows",
            "icon": "🚩",
            "color": "#0284C7",
            "trigger_description": "Cuando hay no-shows en el día",
            "message_template": (
                "Ojo! Hoy hubo {{cantidad}} no-shows en {{negocio}}. ¿Quieres que intentemos "
                "contactarlos para reagendar?"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "interno",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["cantidad", "negocio"],
            },
        },
        {
            "workflow_type": "new_client_alert",
            "name": "Alerta Cliente Nuevo",
            "icon": "🆕",
            "color": "#0284C7",
            "trigger_description": "Al registrar un cliente nuevo en el sistema",
            "message_template": (
                "Nuevo cliente registrado en {{negocio}}: {{nombre}} — {{telefono}}. Ya le "
                "enviamos la bienvenida!"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "interno",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["negocio", "nombre", "telefono"],
            },
        },
        # ── DISPONIBILIDAD (2) ─────────────────────────────────
        {
            "workflow_type": "waitlist_available",
            "name": "Lista de Espera — Disponible",
            "icon": "📢",
            "color": "#14B8A6",
            "trigger_description": "Se abre un espacio en la agenda",
            "message_template": (
                "Hola {{nombre}}! Buenas noticias! Se abrio un espacio el {{fecha}} a las "
                "{{hora}} que creo te puede servir. ¿Lo quieres? Me dices rapido antes de "
                "que se ocupe"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "fecha", "hora"],
            },
        },
        {
            "workflow_type": "special_hours",
            "name": "Horario Especial",
            "icon": "🕐",
            "color": "#0D9488",
            "trigger_description": "Cambio de horario en un día específico",
            "message_template": (
                "Hola {{nombre}}! Te aviso que el {{fecha}} tendremos horario especial en "
                "{{negocio}}: {{horario}}. Si tienes cita ese dia y necesitas ajustar algo "
                "me dices"
            ),
            "is_enabled": False,
            "config": {
                "channel": "whatsapp",
                "category": "citas",
                "template_name": "",
                "meta_template_status": "draft",
                "template_language": "es",
                "send_hour": None,
                "variables": ["nombre", "fecha", "negocio", "horario"],
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
async def list_workflows(tenant_id: int = None, user=Depends(get_current_user)):
    """List all workflow templates for a tenant. Auto-seeds defaults if none exist."""
    db = SessionLocal()
    try:
        # Use authenticated user's tenant_id (ignore query param for security)
        tid = safe_tid(user, db)
        if not tid:
            if getattr(user, "role", None) == "dev":
                return []
            raise HTTPException(status_code=403, detail="No tenant asociado")
        tenant = db.query(Tenant).filter(Tenant.id == tid).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant no encontrado")

        # Auto-seed: add missing workflow types (preserves existing edits)
        existing_types = {
            w.workflow_type for w in
            db.query(WorkflowTemplate.workflow_type).filter(WorkflowTemplate.tenant_id == tenant.id).all()
        }
        all_defaults = _get_default_workflows(tenant.name)
        missing = [w for w in all_defaults if w["workflow_type"] not in existing_types]
        if missing:
            for wdef in missing:
                wf = WorkflowTemplate(
                    tenant_id=tenant.id,
                    workflow_type=wdef["workflow_type"],
                    name=wdef["name"],
                    icon=wdef.get("icon", "⚡"),
                    color=wdef.get("color", "#6366F1"),
                    trigger_description=wdef.get("trigger_description", ""),
                    message_template=wdef.get("message_template", ""),
                    is_enabled=False,
                    config=wdef.get("config", {}),
                )
                db.add(wf)
            db.commit()
            print(f"[AUTOMATIONS] Added {len(missing)} new workflows for tenant {tenant.id}")
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
            "confirmation": "confirmacion_cita",
            "reminder_24h": "recordatorio_cita_24h",
            "reminder_1h": "recordatorio_cita_1h",
            "reschedule": "cita_reagendada",
            "cancellation": "cita_cancelada",
            "client_confirmed": "cita_confirmada",
            "post_visit_thanks": "gracias_visita",
            "rating_request": "calificanos",
            "review_google": "como_te_fue",
            "post_care_tips": "tips_cuidado",
            "suggest_next_service": "sugerir_servicio",
            "reactivation_30d": "te_extranamos",
            "reactivation_60d": "reactivacion_60",
            "reactivation_90d": "reactivacion_90",
            "no_show_followup": "seguimiento_no_show",
            "rebooking_cycle": "reagendamiento_ciclo",
            "winback_discount": "recuperacion_descuento",
            "welcome": "bienvenida_v2",
            "auto_vip": "gracias_vip",
            "anniversary": "aniversario_cliente",
            "referral_thanks": "gracias_referido",
            "visit_milestone": "hito_visitas",
            "birthday": "feliz_cumpleanos",
            "pre_birthday": "pre_cumpleanos",
            "birthday_reminder_use": "descuento_cumpleanos",
            "promo_weekly": "promo_semanal",
            "new_service": "servicio_nuevo",
            "flash_sale": "oferta_relampago",
            "bring_friend": "trae_amigo",
            "combo_special": "combo_especial",
            "seasonal_promo": "promo_temporada",
            "payment_confirmed": "pago_confirmado",
            "payment_reminder": "recordatorio_pago",
            "digital_receipt": "recibo_digital",
            "daily_summary": "resumen_diario",
            "weekly_summary": "resumen_semanal",
            "noshow_alert": "alerta_no_shows",
            "new_client_alert": "alerta_cliente_nuevo",
            "waitlist_available": "lista_espera",
            "special_hours": "horario_especial",
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
async def update_workflow(workflow_id: int, data: dict, user=Depends(get_current_user), _db: Session = Depends(get_db)):
    """Update a workflow template (toggle, message, config)."""
    db = SessionLocal()
    try:
        wf = db.query(WorkflowTemplate).filter(
            WorkflowTemplate.id == workflow_id
        ).first()
        if not wf:
            raise HTTPException(status_code=404, detail="Workflow not found")

        tid = safe_tid(user, db)
        if tid and wf.tenant_id != tid:
            raise HTTPException(status_code=403, detail="No tienes acceso a este workflow")

        if "enabled" in data or "is_enabled" in data:
            wf.is_enabled = data.get("enabled", data.get("is_enabled", wf.is_enabled))
        if "message" in data or "message_template" in data:
            new_text = data.get("message", data.get("message_template", wf.message_template))
            if new_text != wf.message_template:
                wf.message_template = new_text
                # Reset meta template status when message text changes
                cfg = dict(wf.config or {})
                if cfg.get("meta_template_status") in ("approved", "pending"):
                    cfg["meta_template_status"] = "draft"
                    wf.config = cfg
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(wf, "config")
            else:
                wf.message_template = new_text
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
async def get_stats(tenant_id: int = None, user=Depends(get_current_user)):
    """Get aggregate automation stats for a tenant."""
    db = SessionLocal()
    try:
        tid = safe_tid(user, db)
        if not tid:
            return {"active_count": 0, "total_count": 0, "sent_this_month": 0,
                    "sent_total": 0, "response_rate": 0, "confirmed_appointments": 0}
        tenant = db.query(Tenant).filter(Tenant.id == tid).first()
        if not tenant:
            return {"active_count": 0, "total_count": 0, "sent_this_month": 0,
                    "sent_total": 0, "response_rate": 0, "confirmed_appointments": 0}

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
async def get_executions(tenant_id: int = None, limit: int = 50, user=Depends(get_current_user)):
    """Get recent workflow execution log."""
    db = SessionLocal()
    try:
        tid = safe_tid(user, db)
        if not tid:
            return []
        tenant = db.query(Tenant).filter(Tenant.id == tid).first()
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
async def reset_workflows(tenant_id: int = None, user=Depends(get_current_user), _db: Session = Depends(get_db)):
    """Delete and re-seed workflows with latest defaults. Use after config changes."""
    db = SessionLocal()
    try:
        tid = safe_tid(user, db)
        if not tid:
            if getattr(user, "role", None) == "dev":
                return []
            raise HTTPException(status_code=403, detail="No tenant asociado")
        if tenant_id and tid and tenant_id != tid:
            raise HTTPException(status_code=403, detail="No tienes acceso a este tenant")
        tenant = db.query(Tenant).filter(Tenant.id == tid).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant no encontrado")

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


# ═══════════════════════════════════════════════
# META INTEGRATION — Submit & check workflow template status
# ═══════════════════════════════════════════════

# Map workflow categories to Meta's required categories
_META_WORKFLOW_CATEGORY_MAP = {
    "citas": "UTILITY",
    "crm": "UTILITY",
    "interno": "UTILITY",
    "marketing": "MARKETING",
}


def _convert_workflow_variables_to_meta(body):
    """Convert {{nombre}}, {{hora}} etc. to Meta's {{1}}, {{2}} format.
    Returns (converted_body, variable_order)."""
    variables = []
    seen = set()

    def replacer(match):
        var_name = match.group(1)
        if var_name not in seen:
            seen.add(var_name)
            variables.append(var_name)
        idx = variables.index(var_name) + 1
        return "{{" + str(idx) + "}}"

    converted = re.sub(r'\{\{(\w+)\}\}', replacer, body)
    return converted, variables


@router.post("/{workflow_id}/submit-to-meta")
async def submit_workflow_to_meta(workflow_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Submit a workflow's message template to Meta for approval."""
    _db = SessionLocal()
    try:
        wf = _db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
        if not wf:
            raise HTTPException(status_code=404, detail="Workflow not found")

        tid = safe_tid(user, _db)
        if tid and wf.tenant_id != tid:
            raise HTTPException(status_code=403, detail="No tienes acceso a este workflow")

        tenant = _db.query(Tenant).filter(Tenant.id == wf.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant no encontrado")

        wa_business_id = tenant.wa_business_account_id
        wa_token = tenant.wa_access_token

        if not wa_business_id or not wa_token:
            raise HTTPException(
                status_code=400,
                detail="WhatsApp Business Account ID o Token no configurados"
            )

        if not wf.message_template:
            raise HTTPException(status_code=400, detail="El workflow no tiene mensaje configurado")

        # Prepare body text — Meta doesn't allow variables at start or end
        body_text = wf.message_template.strip()
        if body_text.startswith("{{"):
            body_text = "Hola " + body_text
        if body_text.endswith("}}"):
            body_text = body_text + "."

        # Convert variables to Meta format
        meta_body, var_order = _convert_workflow_variables_to_meta(body_text)

        # Generate slug from workflow_type
        clean_slug = re.sub(r'[^a-z0-9_]', '_', wf.workflow_type.lower())

        # Determine Meta category
        config = dict(wf.config or {})
        workflow_category = config.get("category", "marketing")
        meta_category = _META_WORKFLOW_CATEGORY_MAP.get(workflow_category, "MARKETING")

        # Build components
        components = [{
            "type": "BODY",
            "text": meta_body,
        }]

        # Add example values for variables (Meta requires examples)
        if var_order:
            example_values = {
                "nombre": "Juan",
                "hora": "10:00 AM",
                "profesional": "Carlos",
                "servicio": "Corte Clásico",
                "negocio": tenant.name or "Mi Negocio",
                "fecha": "15 de marzo",
                "dias": "30",
                "visitas": "12",
                "monto": "25.000",
                "telefono": "3001234567",
                "servicio_sugerido": "Tratamiento Capilar",
                "servicio_nuevo": "Masaje Relajante",
                "servicio1": "Corte Clásico",
                "servicio2": "Barba",
                "temporada": "Navidad",
                "horario": "8:00 AM a 2:00 PM",
                "cantidad": "3",
                "completadas": "15",
                "total_citas": "85",
                "no_shows": "2",
                "ingresos": "1.250.000",
                "nuevos": "3",
            }
            examples = [example_values.get(v, f"valor_{v}") for v in var_order]
            components[0]["example"] = {"body_text": [examples]}

        payload = {
            "name": clean_slug,
            "language": config.get("template_language", "es"),
            "category": meta_category,
            "components": components,
        }

        print(f"[META WORKFLOW SUBMIT] URL: https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates")
        print(f"[META WORKFLOW SUBMIT] Payload: {payload}")

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.post(
                    f"https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates",
                    headers={
                        "Authorization": f"Bearer {wa_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                data = resp.json()
                print(f"[META WORKFLOW SUBMIT] Response {resp.status_code}: {data}")

                if resp.status_code in (200, 201):
                    meta_status = data.get("status", "PENDING")
                    config["meta_template_name"] = clean_slug
                    config["meta_template_status"] = "approved" if meta_status == "APPROVED" else "pending"
                    wf.config = config
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(wf, "config")
                    wf.updated_at = datetime.utcnow()
                    _db.commit()
                    _db.refresh(wf)

                    return {
                        "success": True,
                        "meta_status": meta_status,
                        "meta_id": data.get("id"),
                        "meta_template_name": clean_slug,
                        "workflow": _serialize_workflow(wf),
                    }
                else:
                    error_msg = data.get("error", {}).get("message", str(data)[:200])
                    error_code = data.get("error", {}).get("code", 0)
                    error_user_msg = data.get("error", {}).get("error_user_msg", "")

                    # If template already exists, mark as pending and store name
                    if error_code == 2388023 or "already exists" in error_msg.lower():
                        config["meta_template_name"] = clean_slug
                        config["meta_template_status"] = "pending"
                        wf.config = config
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(wf, "config")
                        wf.updated_at = datetime.utcnow()
                        _db.commit()
                        _db.refresh(wf)
                        return {
                            "success": True,
                            "meta_status": "ALREADY_EXISTS",
                            "meta_template_name": clean_slug,
                            "message": "La plantilla ya existe en Meta. Verificando estado...",
                            "workflow": _serialize_workflow(wf),
                        }

                    raise HTTPException(
                        status_code=400,
                        detail=f"Meta rechazó: {error_user_msg or error_msg}"
                    )

        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Error conectando con Meta: {str(e)[:100]}")

    finally:
        _db.close()


@router.post("/{workflow_id}/check-meta-status")
async def check_workflow_meta_status(workflow_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Check the current approval status of a workflow's template in Meta."""
    _db = SessionLocal()
    try:
        wf = _db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
        if not wf:
            raise HTTPException(status_code=404, detail="Workflow not found")

        tid = safe_tid(user, _db)
        if tid and wf.tenant_id != tid:
            raise HTTPException(status_code=403, detail="No tienes acceso a este workflow")

        config = dict(wf.config or {})
        meta_template_name = config.get("meta_template_name")
        if not meta_template_name:
            raise HTTPException(
                status_code=400,
                detail="Este workflow no ha sido enviado a Meta aún"
            )

        tenant = _db.query(Tenant).filter(Tenant.id == wf.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant no encontrado")

        wa_business_id = tenant.wa_business_account_id
        wa_token = tenant.wa_access_token

        if not wa_business_id or not wa_token:
            raise HTTPException(
                status_code=400,
                detail="Credenciales de WhatsApp no configuradas"
            )

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates",
                    headers={"Authorization": f"Bearer {wa_token}"},
                    params={"name": meta_template_name, "limit": 1},
                )
                data = resp.json()

                templates = data.get("data", [])
                if templates:
                    meta_tpl = templates[0]
                    meta_status = meta_tpl.get("status", "").upper()

                    status_map = {
                        "APPROVED": "approved",
                        "PENDING": "pending",
                        "REJECTED": "rejected",
                        "PAUSED": "inactive",
                        "DISABLED": "inactive",
                    }
                    new_status = status_map.get(meta_status, config.get("meta_template_status", "pending"))

                    if new_status != config.get("meta_template_status"):
                        config["meta_template_status"] = new_status
                        wf.config = config
                        from sqlalchemy.orm.attributes import flag_modified
                        flag_modified(wf, "config")
                        wf.updated_at = datetime.utcnow()
                        _db.commit()
                        _db.refresh(wf)

                    return {
                        "meta_status": meta_status,
                        "plexify_status": new_status,
                        "meta_template_name": meta_template_name,
                        "workflow": _serialize_workflow(wf),
                    }
                else:
                    return {
                        "meta_status": "NOT_FOUND",
                        "plexify_status": config.get("meta_template_status", "draft"),
                        "meta_template_name": meta_template_name,
                        "message": "Plantilla no encontrada en Meta. ¿Ya la enviaste?",
                    }

        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Error conectando con Meta: {str(e)[:100]}")

    finally:
        _db.close()


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
        # Meta submission status
        "meta_template_name": config.get("meta_template_name", ""),
        "meta_template_status": config.get("meta_template_status", "draft"),
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
