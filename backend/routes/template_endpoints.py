from fastapi import APIRouter, HTTPException
from database.connection import SessionLocal
from database.models import MessageTemplate, Tenant
from datetime import datetime

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
        "status": "approved",
    },
    {
        "name": "Recordatorio de cita (1h)",
        "slug": "recordatorio_cita_1h",
        "category": "recordatorio",
        "body": "{{nombre}}, tu cita es en 1 hora a las {{hora}} con {{profesional}}.\n\n¡Te esperamos en {{negocio}}! Recuerda llegar 5 minuticos antes.",
        "variables": ["nombre", "hora", "profesional", "negocio"],
        "status": "approved",
    },
    {
        "name": "Confirmación de cita",
        "slug": "confirmacion_cita",
        "category": "recordatorio",
        "body": "Hola {{nombre}}! Tu cita en {{negocio}} ha sido confirmada:\n\n📅 {{fecha}}\n🕐 {{hora}}\n💇 {{servicio}}\n👤 {{profesional}}\n\n¡Te esperamos!",
        "variables": ["nombre", "negocio", "fecha", "hora", "servicio", "profesional"],
        "status": "approved",
    },
    {
        "name": "Tu cita es hoy",
        "slug": "cita_hoy",
        "category": "recordatorio",
        "body": "Hola {{nombre}}! Hoy tienes cita en {{negocio}} a las {{hora}}. Recuerda llegar 5 minuticos antes para que {{profesional}} te atienda puntual. ¡Te esperamos!",
        "variables": ["nombre", "negocio", "hora", "profesional"],
        "status": "approved",
    },
    # === POST-SERVICIO (3) ===
    {
        "name": "¿Cómo te fue?",
        "slug": "como_te_fue",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Gracias por tu visita hoy en {{negocio}}. ¿Cómo te fue con tu {{servicio}}? ¿Quedaste contento/a? Cuéntanos, tu opinión nos importa mucho!",
        "variables": ["nombre", "negocio", "servicio"],
        "status": "approved",
    },
    {
        "name": "Califícanos del 1 al 5",
        "slug": "calificanos",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Gracias por visitarnos en {{negocio}}. Del 1 al 5, ¿cómo calificas tu experiencia? Si hay algo que mejorar, cuéntanos con confianza.",
        "variables": ["nombre", "negocio"],
        "status": "approved",
    },
    {
        "name": "Déjanos tu reseña en Google",
        "slug": "resena_google",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Si te gustó tu visita a {{negocio}}, nos ayudaría mucho una reseña en Google. Es rápido y nos ayuda a que más gente nos conozca:\n\n{{link_resena}}\n\n¡Gracias!",
        "variables": ["nombre", "negocio", "link_resena"],
        "status": "approved",
    },
    # === REACTIVACIÓN (3) ===
    {
        "name": "Hace rato no vienes",
        "slug": "hace_rato_no_vienes",
        "category": "reactivacion",
        "body": "Hola {{nombre}}! Vemos que llevas un tiempito sin venir a {{negocio}}. Queremos regalarte un 10% de descuento en el servicio que elijas. ¿Te gustaría venir esta semana?",
        "variables": ["nombre", "negocio"],
        "status": "approved",
    },
    {
        "name": "Te extrañamos + regalo",
        "slug": "te_extranamos",
        "category": "reactivacion",
        "body": "Hola {{nombre}}! Llevas {{dias}} días sin visitarnos en {{negocio}} y te extrañamos! Te regalamos un 10% de descuento + una bebida gratis. ¿Te gustaría venir esta semana?",
        "variables": ["nombre", "dias", "negocio"],
        "status": "approved",
    },
    {
        "name": "Último intento",
        "slug": "ultimo_intento",
        "category": "reactivacion",
        "body": "Hola {{nombre}}! Hace bastante no sabemos de ti y te echamos de menos en {{negocio}}. Tenemos un 15% de descuento esperándote en cualquier servicio. Solo hasta esta semana. ¿Te animas?",
        "variables": ["nombre", "negocio"],
        "status": "approved",
    },
    # === CUMPLEAÑOS / FIDELIZACIÓN (3) ===
    {
        "name": "Feliz cumpleaños",
        "slug": "feliz_cumpleanos",
        "category": "fidelizacion",
        "body": "¡Feliz cumpleaños, {{nombre}}! 🎂🎉\n\nDe parte de todo el equipo de {{negocio}}, te deseamos un día increíble. Te regalamos un 20% de descuento en el servicio que quieras durante esta semana. ¡Pasa cuando gustes!",
        "variables": ["nombre", "negocio"],
        "status": "approved",
    },
    {
        "name": "Gracias cliente VIP",
        "slug": "gracias_vip",
        "category": "fidelizacion",
        "body": "Hola {{nombre}}! Quería agradecerte por ser parte de nuestros clientes más fieles en {{negocio}}. Llevas {{visitas}} visitas con nosotros y eso para nosotros vale mucho. ¡Te esperamos pronto!",
        "variables": ["nombre", "negocio", "visitas"],
        "status": "approved",
    },
    {
        "name": "Tu profesional te extraña",
        "slug": "profesional_te_extrana",
        "category": "fidelizacion",
        "body": "Hola {{nombre}}! {{profesional}} me pidió que te saludara. Dice que hace rato no te ve y quiere saber cómo estás. Cuando quieras venir a {{negocio}}, aquí te esperamos con los brazos abiertos!",
        "variables": ["nombre", "profesional", "negocio"],
        "status": "approved",
    },
    # === PROMOCIONES (3) ===
    {
        "name": "Promo de la semana",
        "slug": "promo_semana",
        "category": "promocion",
        "body": "Hola {{nombre}}! Esta semana en {{negocio}} tenemos promo especial: {{servicio}} con 15% de descuento. Solo hasta el sábado. ¡Agenda antes de que se acaben los cupos!",
        "variables": ["nombre", "negocio", "servicio"],
        "status": "approved",
    },
    {
        "name": "2x1 especial",
        "slug": "dos_por_uno",
        "category": "promocion",
        "body": "Hola {{nombre}}! En {{negocio}} esta semana tenemos 2x1 en {{servicio}}. Ven con un amigo y pagan uno solo. ¡No te lo pierdas!",
        "variables": ["nombre", "negocio", "servicio"],
        "status": "approved",
    },
    {
        "name": "Trae un amigo",
        "slug": "trae_amigo",
        "category": "promocion",
        "body": "Hola {{nombre}}! En {{negocio}} tenemos algo para ti: trae a un amigo y los dos reciben 10% de descuento. Solo muestra este mensaje al llegar. ¡Te esperamos!",
        "variables": ["nombre", "negocio"],
        "status": "approved",
    },
    # === BIENVENIDA / SEGUIMIENTO (4) ===
    {
        "name": "Bienvenida nuevo cliente",
        "slug": "bienvenida",
        "category": "bienvenida",
        "body": "¡Bienvenido/a a {{negocio}}, {{nombre}}! Estamos felices de tenerte. Puedes agendar tu próxima cita escribiéndonos aquí. ¿En qué te podemos ayudar?",
        "variables": ["nombre", "negocio"],
        "status": "approved",
    },
    {
        "name": "Seguimiento no-show",
        "slug": "seguimiento_no_show",
        "category": "bienvenida",
        "body": "Hola {{nombre}}, notamos que no pudiste asistir a tu cita de {{servicio}} en {{negocio}}. ¿Todo bien? ¿Te gustaría reagendar? Estamos para ayudarte.",
        "variables": ["nombre", "servicio", "negocio"],
        "status": "approved",
    },
    {
        "name": "Gracias por tu visita",
        "slug": "gracias_visita",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Gracias por tu visita hoy en {{negocio}}. Fue un placer atenderte. ¿Quieres agendar tu próxima cita? Escríbenos y te ayudamos.",
        "variables": ["nombre", "negocio"],
        "status": "approved",
    },
    {
        "name": "Resumen diario",
        "slug": "resumen_diario",
        "category": "interno",
        "body": "📊 Resumen del día en {{negocio}}:\n\n✅ Citas completadas: {{completadas}}\n❌ No-shows: {{no_shows}}\n💰 Ingresos: ${{ingresos}}\n👥 Clientes nuevos: {{nuevos}}\n\n¡Buen trabajo! 💪",
        "variables": ["negocio", "completadas", "no_shows", "ingresos", "nuevos"],
        "status": "approved",
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
