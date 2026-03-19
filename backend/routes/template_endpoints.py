import os
import re
import httpx
from fastapi import APIRouter, HTTPException
from database.connection import SessionLocal
from database.models import MessageTemplate, Tenant
from datetime import datetime

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")

router = APIRouter(prefix="/message-templates", tags=["Message Templates"])


# Templates universales para negocios de servicios — tono colombiano natural
# Meta requiere: categoría UTILITY o MARKETING, max 1024 chars, {{1}} formato
DEFAULT_TEMPLATES = [
    # ═══════════════════════════════════════════════════════
    # UTILITY — Recordatorios y confirmaciones (Meta aprueba rápido)
    # ═══════════════════════════════════════════════════════
    {
        "name": "Recordatorio de cita (24h)",
        "slug": "recordatorio_cita_24h",
        "category": "recordatorio",
        "body": "Hola {{nombre}}, te recuerdo que mañana tienes cita a las {{hora}} con {{profesional}} para tu {{servicio}}. ¿Todo bien para esa hora? Responde SI para confirmar o escríbeme si necesitas cambiarla.",
        "variables": ["nombre", "hora", "profesional", "servicio"],
        "status": "draft",
    },
    {
        "name": "Recordatorio de cita (1h)",
        "slug": "recordatorio_cita_1h",
        "category": "recordatorio",
        "body": "{{nombre}}, tu cita es en 1 hora a las {{hora}} con {{profesional}}. Llega 5 minuticos antes para que te atienda puntual. Te esperamos!",
        "variables": ["nombre", "hora", "profesional"],
        "status": "draft",
    },
    {
        "name": "Cita confirmada",
        "slug": "confirmacion_cita",
        "category": "recordatorio",
        "body": "Listo {{nombre}}! Tu cita quedo confirmada:\n\n{{fecha}} a las {{hora}}\n{{servicio}} con {{profesional}}\n\nTe esperamos!",
        "variables": ["nombre", "fecha", "hora", "servicio", "profesional"],
        "status": "draft",
    },
    {
        "name": "Cita reagendada",
        "slug": "cita_reagendada",
        "category": "recordatorio",
        "body": "Hola {{nombre}}, tu cita fue reagendada para el {{fecha}} a las {{hora}} con {{profesional}}. Si necesitas otro cambio escribeme sin problema.",
        "variables": ["nombre", "fecha", "hora", "profesional"],
        "status": "draft",
    },
    # ═══════════════════════════════════════════════════════
    # UTILITY — Post-servicio y seguimiento
    # ═══════════════════════════════════════════════════════
    {
        "name": "Gracias por venir",
        "slug": "gracias_visita",
        "category": "post_servicio",
        "body": "{{nombre}}, gracias por venir hoy! Fue un gusto atenderte. Si te gusto el resultado cuentanos, y si hay algo que mejorar tambien. Tu opinion nos importa mucho.",
        "variables": ["nombre"],
        "status": "draft",
    },
    {
        "name": "Como te fue (rating)",
        "slug": "como_te_fue",
        "category": "post_servicio",
        "body": "Hola {{nombre}}! Como te fue con tu {{servicio}}? Del 1 al 5, que nota nos pones? Si fue 5 estrellas nos ayudaria mucho una reseña en Google. Gracias!",
        "variables": ["nombre", "servicio"],
        "status": "draft",
    },
    {
        "name": "Seguimiento no-show",
        "slug": "seguimiento_no_show",
        "category": "recordatorio",
        "body": "Hola {{nombre}}, vimos que no pudiste venir a tu cita de {{servicio}}. Todo bien? Si quieres reagendarla escribeme y te busco un horario que te sirva.",
        "variables": ["nombre", "servicio"],
        "status": "draft",
    },
    # ═══════════════════════════════════════════════════════
    # MARKETING — Reactivación (clientes que no vienen)
    # ═══════════════════════════════════════════════════════
    {
        "name": "Te extrañamos",
        "slug": "te_extranamos",
        "category": "reactivacion",
        "body": "Hola {{nombre}}! Hace {{dias}} dias que no te vemos por aca y te extrañamos. Tenemos un detalle especial para ti: 10% en tu proximo servicio. Te animas a venir esta semana?",
        "variables": ["nombre", "dias"],
        "status": "draft",
    },
    {
        "name": "Tu profesional te espera",
        "slug": "profesional_te_espera",
        "category": "reactivacion",
        "body": "Hola {{nombre}}! {{profesional}} tiene horarios disponibles esta semana y queria saber si te gustaria agendar. Dime que dia y hora te queda bien y te cuadro.",
        "variables": ["nombre", "profesional"],
        "status": "draft",
    },
    {
        "name": "Oferta especial para volver",
        "slug": "oferta_volver",
        "category": "reactivacion",
        "body": "{{nombre}}, hace rato no sabemos de ti! Queremos que vuelvas: te regalamos un 15% de descuento en el servicio que quieras. Solo valido esta semana. Te espero?",
        "variables": ["nombre"],
        "status": "draft",
    },
    # ═══════════════════════════════════════════════════════
    # MARKETING — Cumpleaños y fidelización
    # ═══════════════════════════════════════════════════════
    {
        "name": "Feliz cumpleaños",
        "slug": "feliz_cumpleanos",
        "category": "fidelizacion",
        "body": "Feliz cumpleaños {{nombre}}! De parte de todo el equipo te deseamos un dia increible. Te regalamos un 20% de descuento en el servicio que quieras esta semana. Pasa cuando gustes!",
        "variables": ["nombre"],
        "status": "draft",
    },
    {
        "name": "Gracias cliente VIP",
        "slug": "gracias_vip",
        "category": "fidelizacion",
        "body": "{{nombre}}, queria darte las gracias por ser parte de nuestros clientes mas fieles. Llevas {{visitas}} visitas con nosotros y eso lo valoramos mucho. La proxima vez pregunta por tu beneficio VIP!",
        "variables": ["nombre", "visitas"],
        "status": "draft",
    },
    # ═══════════════════════════════════════════════════════
    # MARKETING — Promociones
    # ═══════════════════════════════════════════════════════
    {
        "name": "Promo de la semana",
        "slug": "promo_semana",
        "category": "promocion",
        "body": "Hola {{nombre}}! Esta semana tenemos promo: {{servicio}} con descuento especial. Cupos limitados, si te interesa escribeme y te agendo. No te lo pierdas!",
        "variables": ["nombre", "servicio"],
        "status": "draft",
    },
    {
        "name": "Trae un amigo",
        "slug": "trae_amigo",
        "category": "promocion",
        "body": "{{nombre}}, tenemos algo bueno: trae a un amigo y los dos se llevan 10% de descuento. Solo muestren este mensaje al llegar. Los espero!",
        "variables": ["nombre"],
        "status": "draft",
    },
    {
        "name": "Combo especial",
        "slug": "combo_especial",
        "category": "promocion",
        "body": "Hola {{nombre}}! Combo especial esta semana: {{servicio}} + barba por un precio unico. Escribeme si te interesa y te reservo horario.",
        "variables": ["nombre", "servicio"],
        "status": "draft",
    },
    # ═══════════════════════════════════════════════════════
    # UTILITY — Bienvenida
    # ═══════════════════════════════════════════════════════
    {
        "name": "Bienvenida nuevo cliente",
        "slug": "bienvenida",
        "category": "bienvenida",
        "body": "Bienvenido {{nombre}}! Soy Lina del equipo. Puedes escribirme aqui para agendar tu proxima cita, preguntar por precios o lo que necesites. En que te puedo ayudar?",
        "variables": ["nombre"],
        "status": "draft",
    },
    # ═══════════════════════════════════════════════════════
    # UTILITY — Interno (resumen para el dueño)
    # ═══════════════════════════════════════════════════════
    {
        "name": "Resumen diario",
        "slug": "resumen_diario",
        "category": "interno",
        "body": "Resumen del dia:\n\nCitas completadas: {{completadas}}\nNo-shows: {{no_shows}}\nIngresos: ${{ingresos}}\nClientes nuevos: {{nuevos}}\n\nBuen trabajo!",
        "variables": ["completadas", "no_shows", "ingresos", "nuevos"],
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
        tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
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
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first() if tenant_id else db.query(Tenant).filter(Tenant.is_active == True).first()
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
        tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
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

        # Meta requires specific language codes — "es" is valid for Spanish
        # Template name: only lowercase letters, numbers, underscores
        import re as _re
        clean_slug = _re.sub(r'[^a-z0-9_]', '_', tpl.slug.lower())

        payload = {
            "name": clean_slug,
            "language": tpl.language or "es",
            "category": meta_category,
            "components": components,
        }

        # Log the full payload for debugging
        print(f"[META SUBMIT] URL: https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates")
        print(f"[META SUBMIT] Payload: {payload}")
        print(f"[META SUBMIT] Token: {wa_token[:20]}...{wa_token[-10:]}" if wa_token else "[META SUBMIT] NO TOKEN")

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
                print(f"[META SUBMIT] Response {resp.status_code}: {data}")

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

                    # Category mismatch — auto-fix: delete old template in Meta, re-create
                    error_user_msg = data.get("error", {}).get("error_user_msg", "")
                    if "categor" in error_user_msg.lower() and "no coincide" in error_user_msg.lower():
                        print(f"[META SUBMIT] Category mismatch — deleting old template and re-creating...")
                        # Delete existing template in Meta
                        del_resp = await client.delete(
                            f"https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates",
                            headers={"Authorization": f"Bearer {wa_token}"},
                            params={"name": clean_slug},
                        )
                        print(f"[META SUBMIT] Delete: {del_resp.status_code} {del_resp.json()}")
                        if del_resp.status_code == 200:
                            # Re-submit with MARKETING (Meta forces this after delete)
                            payload["category"] = "MARKETING"
                            re_resp = await client.post(
                                f"https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates",
                                headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
                                json=payload,
                            )
                            re_data = re_resp.json()
                            print(f"[META SUBMIT] Re-create: {re_resp.status_code} {re_data}")
                            if re_resp.status_code in (200, 201):
                                re_status = re_data.get("status", "PENDING")
                                tpl.status = "approved" if re_status == "APPROVED" else "pending"
                                tpl.updated_at = datetime.utcnow()
                                db.commit()
                                return {
                                    "success": True,
                                    "meta_status": re_status,
                                    "meta_id": re_data.get("id"),
                                    "message": "Plantilla corregida y reenviada a Meta.",
                                    "template": _serialize_template(tpl),
                                }

                    raise HTTPException(status_code=400, detail=f"Meta rechazó: {error_msg}")

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
