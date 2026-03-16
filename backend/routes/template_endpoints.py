import os
import re
import httpx
from fastapi import APIRouter, HTTPException
from database.connection import SessionLocal
from database.models import MessageTemplate, Tenant
from datetime import datetime

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")

router = APIRouter(prefix="/message-templates", tags=["Message Templates"])


# 20 universal service business templates
DEFAULT_TEMPLATES = [
    # === RECORDATORIOS (4) ===
    {
        "name": "Recordatorio de cita (24h)",
        "slug": "recordatorio_cita_24h",
        "category": "recordatorio",
        "body": "Hola {{nombre}}, te recordamos tu cita mañana a las {{hora}} con {{profesional}} para {{servicio}} en {{negocio}}.\n\n¿Confirmas tu asistencia? Responde SI o NO.",
        "variables": ["nombre", "hora", "profesional", "servicio", "negocio"],
        "status": "draft",
    },
    {
        "name": "Recordatorio de cita (1h)",
        "slug": "recordatorio_cita_1h",
        "category": "recordatorio",
        "body": "{{nombre}}, tu cita es en 1 hora a las {{hora}} con {{profesional}}.\n\n¡Te esperamos en {{negocio}}! Recuerda llegar 5 minuticos antes.",
        "variables": ["nombre", "hora", "profesional", "negocio"],
        "status": "draft",
    },
    {
        "name": "Confirmación de cita",
        "slug": "confirmacion_cita",
        "category": "recordatorio",
        "body": "Hola {{nombre}}! Tu cita en {{negocio}} ha sido confirmada:\n\n📅 {{fecha}}\n🕐 {{hora}}\n💇 {{servicio}}\n👤 {{profesional}}\n\n¡Te esperamos!",
        "variables": ["nombre", "negocio", "fecha", "hora", "servicio", "profesional"],
        "status": "draft",
    },
    {
        "name": "Tu cita es hoy",
        "slug": "cita_hoy",
        "category": "recordatorio",
        "body": "Hola {{nombre}}! Hoy tienes cita en {{negocio}} a las {{hora}}. Recuerda llegar 5 minuticos antes para que {{profesional}} te atienda puntual. ¡Te esperamos!",
        "variables": ["nombre", "negocio", "hora", "profesional"],
        "status": "draft",
    },
    # === POST-SERVICIO (3) ===
    {
        "name": "¿Cómo te fue?",
        "slug": "como_te_fue",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Gracias por tu visita hoy en {{negocio}}. ¿Cómo te fue con tu {{servicio}}? ¿Quedaste contento/a? Cuéntanos, tu opinión nos importa mucho!",
        "variables": ["nombre", "negocio", "servicio"],
        "status": "draft",
    },
    {
        "name": "Califícanos del 1 al 5",
        "slug": "calificanos",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Gracias por visitarnos en {{negocio}}. Del 1 al 5, ¿cómo calificas tu experiencia? Si hay algo que mejorar, cuéntanos con confianza.",
        "variables": ["nombre", "negocio"],
        "status": "draft",
    },
    {
        "name": "Déjanos tu reseña en Google",
        "slug": "resena_google",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Si te gustó tu visita a {{negocio}}, nos ayudaría mucho una reseña en Google. Es rápido y nos ayuda a que más gente nos conozca:\n\n{{link_resena}}\n\n¡Gracias!",
        "variables": ["nombre", "negocio", "link_resena"],
        "status": "draft",
    },
    # === REACTIVACIÓN (3) ===
    {
        "name": "Hace rato no vienes",
        "slug": "hace_rato_no_vienes",
        "category": "reactivacion",
        "body": "Hola {{nombre}}! Vemos que llevas un tiempito sin venir a {{negocio}}. Queremos regalarte un 10% de descuento en el servicio que elijas. ¿Te gustaría venir esta semana?",
        "variables": ["nombre", "negocio"],
        "status": "draft",
    },
    {
        "name": "Te extrañamos + regalo",
        "slug": "te_extranamos",
        "category": "reactivacion",
        "body": "Hola {{nombre}}! Llevas {{dias}} días sin visitarnos en {{negocio}} y te extrañamos! Te regalamos un 10% de descuento + una bebida gratis. ¿Te gustaría venir esta semana?",
        "variables": ["nombre", "dias", "negocio"],
        "status": "draft",
    },
    {
        "name": "Último intento",
        "slug": "ultimo_intento",
        "category": "reactivacion",
        "body": "Hola {{nombre}}! Hace bastante no sabemos de ti y te echamos de menos en {{negocio}}. Tenemos un 15% de descuento esperándote en cualquier servicio. Solo hasta esta semana. ¿Te animas?",
        "variables": ["nombre", "negocio"],
        "status": "draft",
    },
    # === CUMPLEAÑOS / FIDELIZACIÓN (3) ===
    {
        "name": "Feliz cumpleaños",
        "slug": "feliz_cumpleanos",
        "category": "fidelizacion",
        "body": "¡Feliz cumpleaños, {{nombre}}! 🎂🎉\n\nDe parte de todo el equipo de {{negocio}}, te deseamos un día increíble. Te regalamos un 20% de descuento en el servicio que quieras durante esta semana. ¡Pasa cuando gustes!",
        "variables": ["nombre", "negocio"],
        "status": "draft",
    },
    {
        "name": "Gracias cliente VIP",
        "slug": "gracias_vip",
        "category": "fidelizacion",
        "body": "Hola {{nombre}}! Quería agradecerte por ser parte de nuestros clientes más fieles en {{negocio}}. Llevas {{visitas}} visitas con nosotros y eso para nosotros vale mucho. ¡Te esperamos pronto!",
        "variables": ["nombre", "negocio", "visitas"],
        "status": "draft",
    },
    {
        "name": "Tu profesional te extraña",
        "slug": "profesional_te_extrana",
        "category": "fidelizacion",
        "body": "Hola {{nombre}}! {{profesional}} me pidió que te saludara. Dice que hace rato no te ve y quiere saber cómo estás. Cuando quieras venir a {{negocio}}, aquí te esperamos con los brazos abiertos!",
        "variables": ["nombre", "profesional", "negocio"],
        "status": "draft",
    },
    # === PROMOCIONES (3) ===
    {
        "name": "Promo de la semana",
        "slug": "promo_semana",
        "category": "promocion",
        "body": "Hola {{nombre}}! Esta semana en {{negocio}} tenemos promo especial: {{servicio}} con 15% de descuento. Solo hasta el sábado. ¡Agenda antes de que se acaben los cupos!",
        "variables": ["nombre", "negocio", "servicio"],
        "status": "draft",
    },
    {
        "name": "2x1 especial",
        "slug": "dos_por_uno",
        "category": "promocion",
        "body": "Hola {{nombre}}! En {{negocio}} esta semana tenemos 2x1 en {{servicio}}. Ven con un amigo y pagan uno solo. ¡No te lo pierdas!",
        "variables": ["nombre", "negocio", "servicio"],
        "status": "draft",
    },
    {
        "name": "Trae un amigo",
        "slug": "trae_amigo",
        "category": "promocion",
        "body": "Hola {{nombre}}! En {{negocio}} tenemos algo para ti: trae a un amigo y los dos reciben 10% de descuento. Solo muestra este mensaje al llegar. ¡Te esperamos!",
        "variables": ["nombre", "negocio"],
        "status": "draft",
    },
    # === BIENVENIDA / SEGUIMIENTO (4) ===
    {
        "name": "Bienvenida nuevo cliente",
        "slug": "bienvenida",
        "category": "bienvenida",
        "body": "¡Bienvenido/a a {{negocio}}, {{nombre}}! Estamos felices de tenerte. Puedes agendar tu próxima cita escribiéndonos aquí. ¿En qué te podemos ayudar?",
        "variables": ["nombre", "negocio"],
        "status": "draft",
    },
    {
        "name": "Seguimiento no-show",
        "slug": "seguimiento_no_show",
        "category": "bienvenida",
        "body": "Hola {{nombre}}, notamos que no pudiste asistir a tu cita de {{servicio}} en {{negocio}}. ¿Todo bien? ¿Te gustaría reagendar? Estamos para ayudarte.",
        "variables": ["nombre", "servicio", "negocio"],
        "status": "draft",
    },
    {
        "name": "Gracias por tu visita",
        "slug": "gracias_visita",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Gracias por tu visita hoy en {{negocio}}. Fue un placer atenderte. ¿Quieres agendar tu próxima cita? Escríbenos y te ayudamos.",
        "variables": ["nombre", "negocio"],
        "status": "draft",
    },
    {
        "name": "Resumen diario",
        "slug": "resumen_diario",
        "category": "interno",
        "body": "📊 Resumen del día en {{negocio}}:\n\n✅ Citas completadas: {{completadas}}\n❌ No-shows: {{no_shows}}\n💰 Ingresos: ${{ingresos}}\n👥 Clientes nuevos: {{nuevos}}\n\n¡Buen trabajo! 💪",
        "variables": ["negocio", "completadas", "no_shows", "ingresos", "nuevos"],
        "status": "draft",
    },
]


def seed_templates_for_tenant(tenant_id: int):
    """Create default templates for a tenant if none exist."""
    db = SessionLocal()
    try:
        existing = db.query(MessageTemplate).filter(
            MessageTemplate.tenant_id == tenant_id
        ).count()
        if existing > 0:
            return existing

        for tpl in DEFAULT_TEMPLATES:
            db.add(MessageTemplate(tenant_id=tenant_id, **tpl))
        db.commit()
        print(f"[TEMPLATES] Seeded {len(DEFAULT_TEMPLATES)} templates for tenant {tenant_id}")
        return len(DEFAULT_TEMPLATES)
    except Exception as e:
        db.rollback()
        print(f"[TEMPLATES] Seed error: {e}")
        return 0
    finally:
        db.close()


@router.post("/reset")
async def reset_templates():
    """Delete all templates and re-seed with defaults (all as draft)."""
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="No tenant")
        db.query(MessageTemplate).filter(MessageTemplate.tenant_id == tenant.id).delete()
        db.commit()
        seed_templates_for_tenant(tenant.id)
        db.close()
        db = SessionLocal()
        templates = db.query(MessageTemplate).filter(
            MessageTemplate.tenant_id == tenant.id, MessageTemplate.is_active == True
        ).order_by(MessageTemplate.category, MessageTemplate.name).all()
        return [_serialize_template(t) for t in templates]
    finally:
        db.close()


@router.get("")
async def list_templates(tenant_id: int = None, status: str = None):
    """List all message templates. Auto-seeds if none exist."""
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first() if tenant_id else db.query(Tenant).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="No tenant")

        count = db.query(MessageTemplate).filter(MessageTemplate.tenant_id == tenant.id).count()
        if count == 0:
            seed_templates_for_tenant(tenant.id)
            db.close()
            db = SessionLocal()

        q = db.query(MessageTemplate).filter(
            MessageTemplate.tenant_id == tenant.id,
            MessageTemplate.is_active == True,
        )
        if status:
            q = q.filter(MessageTemplate.status == status)

        templates = q.order_by(MessageTemplate.category, MessageTemplate.name).all()
        return [_serialize_template(t) for t in templates]
    finally:
        db.close()


@router.post("")
async def create_template(data: dict):
    """Create a new template (starts as draft)."""
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="No tenant")

        name = data.get("name", "").strip()
        body = data.get("body", "").strip()
        if not name or not body:
            raise HTTPException(status_code=400, detail="Nombre y mensaje son requeridos")

        # Auto-generate slug from name
        import re
        slug = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')

        # Extract variables from body
        import re as re2
        variables = re2.findall(r'\{\{(\w+)\}\}', body)

        tpl = MessageTemplate(
            tenant_id=tenant.id,
            name=name,
            slug=slug,
            category=data.get("category", "general"),
            body=body,
            variables=list(set(variables)),
            status="draft",
            language=data.get("language", "es"),
        )
        db.add(tpl)
        db.commit()
        db.refresh(tpl)
        return _serialize_template(tpl)
    finally:
        db.close()


@router.put("/{template_id}")
async def update_template(template_id: int, data: dict):
    """Update a template — name, body, category, or status."""
    db = SessionLocal()
    try:
        tpl = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
        if not tpl:
            raise HTTPException(status_code=404, detail="Template not found")

        if "name" in data:
            tpl.name = data["name"]
        if "body" in data:
            tpl.body = data["body"]
            # Re-extract variables
            import re
            tpl.variables = list(set(re.findall(r'\{\{(\w+)\}\}', data["body"])))
        if "category" in data:
            tpl.category = data["category"]
        if "status" in data:
            tpl.status = data["status"]
        if "slug" in data:
            tpl.slug = data["slug"]

        tpl.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(tpl)
        return _serialize_template(tpl)
    finally:
        db.close()


@router.put("/{template_id}/approve")
async def approve_template(template_id: int):
    """Mark a template as approved (after Meta approves it)."""
    db = SessionLocal()
    try:
        tpl = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
        if not tpl:
            raise HTTPException(status_code=404, detail="Template not found")
        tpl.status = "approved"
        tpl.updated_at = datetime.utcnow()
        db.commit()
        return _serialize_template(tpl)
    finally:
        db.close()


# ═══════════════════════════════════════════════
# META INTEGRATION — Submit & check template status
# ═══════════════════════════════════════════════

# Map our categories to Meta's required categories
_META_CATEGORY_MAP = {
    "recordatorio": "UTILITY",
    "post_servicio": "MARKETING",
    "reactivacion": "MARKETING",
    "fidelizacion": "MARKETING",
    "promocion": "MARKETING",
    "bienvenida": "UTILITY",
    "interno": "UTILITY",
    "general": "MARKETING",
}


def _convert_variables_to_meta(body):
    """Convert {{nombre}}, {{hora}} to Meta's {{1}}, {{2}} format.
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


@router.post("/{template_id}/submit-to-meta")
async def submit_to_meta(template_id: int):
    """Submit a template to Meta for approval. Changes status to 'pending'."""
    db = SessionLocal()
    try:
        tpl = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
        if not tpl:
            raise HTTPException(status_code=404, detail="Template not found")

        # Get tenant's WA credentials
        tenant = db.query(Tenant).filter(Tenant.id == tpl.tenant_id).first()
        wa_business_id = None
        wa_token = None

        if tenant:
            wa_business_id = tenant.wa_business_account_id
            wa_token = tenant.wa_access_token

        # Fallback to env vars
        if not wa_business_id:
            wa_business_id = os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
        if not wa_token:
            wa_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")

        if not wa_business_id or not wa_token:
            raise HTTPException(
                status_code=400,
                detail="WhatsApp Business Account ID o Token no configurados"
            )

        # Convert body variables to Meta format
        meta_body, var_order = _convert_variables_to_meta(tpl.body)
        meta_category = _META_CATEGORY_MAP.get(tpl.category, "MARKETING")

        # Build Meta API payload
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
                "negocio": tenant.name if tenant else "Mi Negocio",
                "fecha": "15 de marzo",
                "dias": "30",
                "visitas": "12",
                "link_resena": "https://g.page/review/example",
                "google_review_link": "https://g.page/review/example",
                "completadas": "15",
                "no_shows": "2",
                "ingresos": "1.250.000",
                "nuevos": "3",
            }
            examples = [example_values.get(v, f"valor_{v}") for v in var_order]
            components[0]["example"] = {"body_text": [examples]}

        payload = {
            "name": tpl.slug,
            "language": tpl.language or "es",
            "category": meta_category,
            "components": components,
        }

        # Submit to Meta API
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

                if resp.status_code in (200, 201):
                    # Success — Meta accepted for review
                    meta_status = data.get("status", "PENDING")
                    if meta_status == "APPROVED":
                        tpl.status = "approved"
                    else:
                        tpl.status = "pending"

                    tpl.updated_at = datetime.utcnow()
                    db.commit()

                    return {
                        "success": True,
                        "meta_status": meta_status,
                        "meta_id": data.get("id"),
                        "template": _serialize_template(tpl),
                    }
                else:
                    error_msg = data.get("error", {}).get("message", str(data)[:200])
                    error_code = data.get("error", {}).get("code", 0)

                    # If template already exists, try to get its current status
                    if error_code == 2388023 or "already exists" in error_msg.lower():
                        tpl.status = "pending"
                        tpl.updated_at = datetime.utcnow()
                        db.commit()
                        return {
                            "success": True,
                            "meta_status": "ALREADY_EXISTS",
                            "message": "La plantilla ya existe en Meta. Verificando estado...",
                            "template": _serialize_template(tpl),
                        }

                    raise HTTPException(status_code=400, detail=f"Meta rechazó la solicitud: {error_msg}")

        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Error conectando con Meta: {str(e)[:100]}")

    finally:
        db.close()


@router.post("/{template_id}/check-status")
async def check_meta_status(template_id: int):
    """Check the current approval status of a template in Meta."""
    db = SessionLocal()
    try:
        tpl = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
        if not tpl:
            raise HTTPException(status_code=404, detail="Template not found")

        tenant = db.query(Tenant).filter(Tenant.id == tpl.tenant_id).first()
        wa_business_id = (tenant.wa_business_account_id if tenant else None) or os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
        wa_token = (tenant.wa_access_token if tenant else None) or os.getenv("WHATSAPP_ACCESS_TOKEN", "")

        if not wa_business_id or not wa_token:
            raise HTTPException(status_code=400, detail="Credenciales de WhatsApp no configuradas")

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates",
                    headers={"Authorization": f"Bearer {wa_token}"},
                    params={"name": tpl.slug, "limit": 1},
                )
                data = resp.json()

                templates = data.get("data", [])
                if templates:
                    meta_tpl = templates[0]
                    meta_status = meta_tpl.get("status", "").upper()

                    # Map Meta status to our status
                    status_map = {
                        "APPROVED": "approved",
                        "PENDING": "pending",
                        "REJECTED": "rejected",
                        "PAUSED": "inactive",
                        "DISABLED": "inactive",
                    }
                    new_status = status_map.get(meta_status, tpl.status)

                    if new_status != tpl.status:
                        tpl.status = new_status
                        tpl.updated_at = datetime.utcnow()
                        db.commit()

                    return {
                        "meta_status": meta_status,
                        "plexify_status": new_status,
                        "template": _serialize_template(tpl),
                    }
                else:
                    return {
                        "meta_status": "NOT_FOUND",
                        "plexify_status": tpl.status,
                        "message": "Plantilla no encontrada en Meta. ¿Ya la enviaste?",
                    }

        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Error conectando con Meta: {str(e)[:100]}")

    finally:
        db.close()


@router.delete("/{template_id}")
async def delete_template(template_id: int):
    """Soft-delete a template."""
    db = SessionLocal()
    try:
        tpl = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
        if not tpl:
            raise HTTPException(status_code=404, detail="Template not found")
        tpl.is_active = False
        db.commit()
        return {"ok": True}
    finally:
        db.close()


def _serialize_template(t):
    return {
        "id": t.id,
        "name": t.name,
        "slug": t.slug,
        "category": t.category,
        "body": t.body,
        "variables": t.variables or [],
        "status": t.status,
        "language": t.language,
        "times_sent": t.times_sent or 0,
        "response_rate": t.response_rate or 0,
        "last_sent": t.last_sent_at.isoformat() if t.last_sent_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }
