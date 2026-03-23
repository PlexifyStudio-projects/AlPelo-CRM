"""
Plexify Studio — Campaign Management Endpoints
Full lifecycle: create → AI copy → segment → submit Meta → send mass WhatsApp
"""

import os
import re
import json
import httpx
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.connection import get_db, SessionLocal
from database.models import (
    Campaign, Client, VisitHistory, Staff, Service, Tenant, MessageTemplate,
    WhatsAppConversation, WhatsAppMessage,
)
from schemas import CampaignCreate, CampaignUpdate, CampaignResponse
from routes._helpers import (
    safe_tid, get_wa_token, get_wa_phone_id, normalize_phone, compute_status
)
from middleware.auth_middleware import get_current_user

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


# ============================================================================
# HELPERS
# ============================================================================

def _serialize(c: Campaign) -> dict:
    return {
        "id": c.id,
        "tenant_id": c.tenant_id,
        "name": c.name,
        "campaign_type": c.campaign_type,
        "status": c.status,
        "message_body": c.message_body,
        "meta_template_name": c.meta_template_name,
        "meta_template_id": c.meta_template_id,
        "meta_status": c.meta_status,
        "segment_filters": c.segment_filters or {},
        "audience_count": c.audience_count or 0,
        "sent_count": c.sent_count or 0,
        "failed_count": c.failed_count or 0,
        "responded_count": c.responded_count or 0,
        "ai_variants": c.ai_variants,
        "created_by": c.created_by,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _get_tenant(db: Session, user):
    """Get tenant_id from authenticated user."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no configurado")
    return tid


def _get_campaign(db: Session, campaign_id: int, tenant_id: int) -> Campaign:
    c = db.query(Campaign).filter(
        Campaign.id == campaign_id, Campaign.tenant_id == tenant_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    return c


# ============================================================================
# SEGMENTATION ENGINE — Build audience from filters
# ============================================================================

def _build_audience(db: Session, tenant_id: int, filters: dict) -> list[dict]:
    """Apply 20+ segment filters and return matching clients with computed stats."""
    q = db.query(Client).filter(
        Client.tenant_id == tenant_id,
        Client.is_active == True,
        Client.phone.isnot(None),
        Client.phone != "",
    )

    # ── Extract all filters ──
    status_filter = filters.get("status")
    days_inactive = filters.get("days_inactive")
    days_inactive_max = filters.get("days_inactive_max")
    staff_id = filters.get("staff_id")
    service_name = filters.get("service_name")
    min_spent = filters.get("min_spent")
    max_spent = filters.get("max_spent")
    min_visits = filters.get("min_visits")
    max_visits = filters.get("max_visits")
    min_avg_ticket = filters.get("min_avg_ticket")
    max_avg_ticket = filters.get("max_avg_ticket")
    birthday_month = filters.get("birthday_month")
    has_email = filters.get("has_email")
    has_birthday = filters.get("has_birthday")
    gender = filters.get("gender")
    tags_include = filters.get("tags_include")  # list of tags
    tags_exclude = filters.get("tags_exclude")  # list of tags
    last_visit_from = filters.get("last_visit_from")  # ISO date
    last_visit_to = filters.get("last_visit_to")  # ISO date
    payment_method = filters.get("payment_method")
    preferred_barber = filters.get("preferred_barber")
    top_spenders_pct = filters.get("top_spenders_pct")  # percentile, e.g. 20 = top 20%
    accepts_whatsapp = filters.get("accepts_whatsapp")
    created_from = filters.get("created_from")  # client registration date
    created_to = filters.get("created_to")
    no_show_count = filters.get("no_show_count")  # min no-shows

    clients = q.all()

    # ── Pre-compute visit stats for all clients in one pass ──
    all_client_ids = [c.id for c in clients]
    all_visits = db.query(VisitHistory).filter(
        VisitHistory.client_id.in_(all_client_ids) if all_client_ids else False,
    ).all() if all_client_ids else []

    # Group visits by client_id
    visits_map = {}
    for v in all_visits:
        visits_map.setdefault(v.client_id, []).append(v)

    # Build enriched results
    enriched = []
    for client in clients:
        client_visits = visits_map.get(client.id, [])
        completed = [v for v in client_visits if v.status == "completed"]
        no_shows = [v for v in client_visits if v.status == "no_show"]

        total_visits = len(completed)
        total_spent = sum(v.amount or 0 for v in completed)
        avg_ticket = round(total_spent / total_visits) if total_visits > 0 else 0
        last_visit_date = max((v.visit_date for v in completed), default=None)
        days_since = (date.today() - last_visit_date).days if last_visit_date else None
        computed = compute_status(total_visits, days_since, client.status_override)

        # Collect staff and services used
        staff_ids_used = list(set(v.staff_id for v in completed if v.staff_id))
        services_used = list(set((v.service_name or "").lower() for v in completed if v.service_name))
        payment_methods_used = list(set((v.payment_method or "").lower() for v in completed if v.payment_method))

        enriched.append({
            "client": client,
            "total_visits": total_visits,
            "total_spent": total_spent,
            "avg_ticket": avg_ticket,
            "last_visit": last_visit_date,
            "days_since": days_since,
            "status": computed,
            "no_show_count": len(no_shows),
            "staff_ids": staff_ids_used,
            "services": services_used,
            "payments": payment_methods_used,
        })

    # ── For top_spenders_pct, compute threshold ──
    spend_threshold = 0
    if top_spenders_pct:
        all_spends = sorted([e["total_spent"] for e in enriched if e["total_spent"] > 0], reverse=True)
        if all_spends:
            idx = max(0, int(len(all_spends) * int(top_spenders_pct) / 100) - 1)
            spend_threshold = all_spends[idx]

    # ── Apply filters ──
    result = []
    for e in enriched:
        client = e["client"]

        if status_filter and e["status"] != status_filter:
            continue
        if days_inactive:
            if e["days_since"] is None or e["days_since"] < int(days_inactive):
                continue
        if days_inactive_max:
            if e["days_since"] is not None and e["days_since"] > int(days_inactive_max):
                continue
        if min_spent and e["total_spent"] < int(min_spent):
            continue
        if max_spent and e["total_spent"] > int(max_spent):
            continue
        if min_visits and e["total_visits"] < int(min_visits):
            continue
        if max_visits and e["total_visits"] > int(max_visits):
            continue
        if min_avg_ticket and e["avg_ticket"] < int(min_avg_ticket):
            continue
        if max_avg_ticket and e["avg_ticket"] > int(max_avg_ticket):
            continue
        if staff_id:
            if int(staff_id) not in e["staff_ids"]:
                continue
        if service_name:
            if not any(service_name.lower() in s for s in e["services"]):
                continue
        if birthday_month:
            if not client.birthday:
                continue
            if isinstance(birthday_month, bool) and birthday_month is True:
                if client.birthday.month != date.today().month:
                    continue
            elif isinstance(birthday_month, int) or str(birthday_month).isdigit():
                if client.birthday.month != int(birthday_month):
                    continue
        if has_email:
            if not client.email or not client.email.strip():
                continue
        if has_birthday is not None:
            if has_birthday and not client.birthday:
                continue
            if not has_birthday and client.birthday:
                continue
        if tags_include:
            client_tags = client.tags or []
            if not any(t in client_tags for t in tags_include):
                continue
        if tags_exclude:
            client_tags = client.tags or []
            if any(t in client_tags for t in tags_exclude):
                continue
        if last_visit_from:
            d = date.fromisoformat(str(last_visit_from))
            if not e["last_visit"] or e["last_visit"] < d:
                continue
        if last_visit_to:
            d = date.fromisoformat(str(last_visit_to))
            if not e["last_visit"] or e["last_visit"] > d:
                continue
        if payment_method:
            if payment_method.lower() not in e["payments"]:
                continue
        if preferred_barber:
            if client.preferred_barber_id != int(preferred_barber):
                continue
        if top_spenders_pct:
            if e["total_spent"] < spend_threshold:
                continue
        if accepts_whatsapp is not None:
            if client.accepts_whatsapp != accepts_whatsapp:
                continue
        if created_from:
            d = date.fromisoformat(str(created_from))
            if not client.created_at or client.created_at.date() < d:
                continue
        if created_to:
            d = date.fromisoformat(str(created_to))
            if not client.created_at or client.created_at.date() > d:
                continue
        if no_show_count:
            if e["no_show_count"] < int(no_show_count):
                continue

        result.append(e)

    return result


def _audience_to_clients(audience: list[dict]) -> list[Client]:
    """Extract Client objects from enriched audience list."""
    return [e["client"] for e in audience]


# ============================================================================
# CRUD ENDPOINTS
# ============================================================================

@router.post("")
async def create_campaign(data: CampaignCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new campaign draft."""
    tid = _get_tenant(db, user)

    campaign = Campaign(
        tenant_id=tid,
        name=data.name,
        campaign_type=data.campaign_type,
        status="draft",
        message_body=data.message_body,
        segment_filters=data.segment_filters or {},
        created_by=data.created_by or user.username,
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return _serialize(campaign)


@router.get("")
async def list_campaigns(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """List all campaigns for current tenant."""
    tid = _get_tenant(db, user)
    campaigns = db.query(Campaign).filter(
        Campaign.tenant_id == tid
    ).order_by(Campaign.created_at.desc()).all()
    return [_serialize(c) for c in campaigns]


# ============================================================================
# AUDIENCE SEARCH — Advanced filters, full client list for selection
# Must be BEFORE /{campaign_id} routes to avoid FastAPI path conflicts
# ============================================================================

@router.post("/audience-search")
async def audience_search(filters: dict = Body(default={}), user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Search audience with advanced filters — returns FULL list with stats for contact selection."""
    tid = _get_tenant(db, user)
    audience = _build_audience(db, tid, filters)

    contacts = []
    for e in audience:
        cl = e["client"]
        contacts.append({
            "id": cl.id,
            "name": cl.name,
            "phone": cl.phone,
            "email": cl.email,
            "status": e["status"],
            "total_visits": e["total_visits"],
            "total_spent": e["total_spent"],
            "avg_ticket": e["avg_ticket"],
            "days_since": e["days_since"],
            "last_visit": e["last_visit"].isoformat() if e["last_visit"] else None,
            "no_show_count": e["no_show_count"],
            "tags": cl.tags or [],
            "favorite_service": cl.favorite_service,
            "birthday": cl.birthday.isoformat() if cl.birthday else None,
            "accepts_whatsapp": cl.accepts_whatsapp,
        })

    return {"count": len(contacts), "contacts": contacts}


@router.post("/send-one")
async def send_one_message(
    data: dict = Body(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a single template message to one client. Used for 1-by-1 campaign sending."""
    tid = _get_tenant(db, user)
    client_id = data.get("client_id")
    template_slug = data.get("template_slug")
    message_body = data.get("message_body")
    campaign_id = data.get("campaign_id")

    if not client_id or not message_body:
        raise HTTPException(status_code=400, detail="client_id y message_body son requeridos")

    wa_token = get_wa_token(db, tid)
    wa_phone_id = get_wa_phone_id(db, tid)
    if not wa_token or not wa_phone_id:
        raise HTTPException(status_code=400, detail="Credenciales de WhatsApp no configuradas")

    client_obj = db.query(Client).filter(Client.id == int(client_id), Client.tenant_id == tid).first()
    if not client_obj:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    phone = normalize_phone(client_obj.phone)
    if len(phone) < 10:
        return {"success": False, "client_id": client_id, "error": "Teléfono inválido"}

    first_name = (client_obj.name or "").split(" ")[0]
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()

    try:
        if template_slug:
            variables = re.findall(r'\{\{(\w+)\}\}', message_body or "")
            last_v = db.query(VisitHistory.visit_date).filter(
                VisitHistory.client_id == client_obj.id,
                VisitHistory.status == "completed",
            ).order_by(VisitHistory.visit_date.desc()).first()
            days_val = str((date.today() - last_v[0]).days) if last_v else "0"

            # Resolve ALL possible template variables
            var_values = {
                "nombre": first_name,
                "negocio": tenant.name if tenant else "nuestro negocio",
                "servicio": client_obj.favorite_service or "tu servicio",
                "dias": days_val,
                "hora": "la hora programada",
                "profesional": "tu profesional",
                "descuento": "10%",
                "fecha": date.today().strftime("%d/%m/%Y"),
                "telefono": tenant.phone if tenant and hasattr(tenant, 'phone') else "",
                "direccion": "",
                "precio": "",
                "link": "",
            }

            components_params = []
            if variables:
                params = [{"type": "text", "text": var_values.get(v, v)} for v in variables]
                components_params = [{"type": "body", "parameters": params}]

            payload = {
                "messaging_product": "whatsapp",
                "to": phone,
                "type": "template",
                "template": {
                    "name": template_slug,
                    "language": {"code": "es"},
                    "components": components_params,
                },
            }
        else:
            resolved_body = message_body.replace("{{nombre}}", first_name)
            payload = {
                "messaging_product": "whatsapp",
                "to": phone,
                "type": "text",
                "text": {"body": resolved_body},
            }

        async with httpx.AsyncClient(timeout=15) as client_http:
            resp = await client_http.post(
                f"https://graph.facebook.com/{WA_API_VERSION}/{wa_phone_id}/messages",
                headers={
                    "Authorization": f"Bearer {wa_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            try:
                resp_data = resp.json()
            except Exception:
                resp_data = {}
            has_messages = bool(resp_data.get("messages"))
            has_contacts = bool(resp_data.get("contacts"))
            has_error = bool(resp_data.get("error"))
            is_success = (resp.status_code < 300 or has_messages or has_contacts) and not has_error

            print(f"[SEND-ONE] {phone} → HTTP {resp.status_code} | success={is_success} | messages={has_messages} | error={has_error} | body={str(resp_data)[:300]}")

            if is_success:
                try:
                    from routes._usage_tracker import track_message_sent
                    track_message_sent(tid)
                except Exception:
                    pass

                if campaign_id:
                    camp = db.query(Campaign).filter(Campaign.id == int(campaign_id), Campaign.tenant_id == tid).first()
                    if camp:
                        camp.sent_count = (camp.sent_count or 0) + 1
                        camp.updated_at = datetime.utcnow()
                        db.commit()

                # ── Record in WhatsApp inbox (reuse existing conversation) ──
                try:
                    # First try by client_id (most reliable)
                    conv = db.query(WhatsAppConversation).filter(
                        WhatsAppConversation.tenant_id == tid,
                        WhatsAppConversation.client_id == int(client_id),
                    ).order_by(WhatsAppConversation.last_message_at.desc().nullslast()).first()

                    # Fallback: match by phone digits
                    if not conv:
                        clean_digits = re.sub(r'\D', '', phone)
                        phone_tail = clean_digits[-10:] if len(clean_digits) >= 10 else clean_digits
                        tenant_convs = db.query(WhatsAppConversation).filter(
                            WhatsAppConversation.tenant_id == tid,
                        ).all()
                        for tc in tenant_convs:
                            tc_digits = re.sub(r'\D', '', tc.wa_contact_phone or '')
                            if tc_digits[-10:] == phone_tail:
                                conv = tc
                                break
                    if not conv:
                        conv = WhatsAppConversation(
                            tenant_id=tid,
                            wa_contact_phone=phone,
                            wa_contact_name=client_obj.name,
                            client_id=int(client_id),
                            is_ai_active=False,
                        )
                        db.add(conv)
                        db.flush()

                    wa_msg_id = ""
                    msgs = resp_data.get("messages", [])
                    if msgs:
                        wa_msg_id = msgs[0].get("id", "")

                    resolved = message_body.replace("{{nombre}}", first_name)
                    msg = WhatsAppMessage(
                        conversation_id=conv.id,
                        wa_message_id=wa_msg_id or f"campaign_{campaign_id}_{client_id}",
                        direction="outbound",
                        content=resolved,
                        message_type="template",
                        status="sent",
                        sent_by="campaign",
                    )
                    db.add(msg)
                    conv.last_message_at = datetime.utcnow()
                    db.commit()
                except Exception as e:
                    print(f"[SEND-ONE] Error recording in inbox: {e}")
                    db.rollback()

                return {"success": True, "client_id": client_id, "name": client_obj.name, "phone": phone}
            else:
                error_msg = resp_data.get("error", {}).get("message", resp.text[:150])
                print(f"[SEND-ONE] FAILED {phone}: {error_msg}")
                if campaign_id:
                    camp = db.query(Campaign).filter(Campaign.id == int(campaign_id), Campaign.tenant_id == tid).first()
                    if camp:
                        camp.failed_count = (camp.failed_count or 0) + 1
                        db.commit()
                return {"success": False, "client_id": client_id, "name": client_obj.name, "error": str(error_msg)[:150]}

    except Exception as e:
        print(f"[SEND-ONE] EXCEPTION {phone}: {e}")
        return {"success": False, "client_id": client_id, "name": client_obj.name, "error": str(e)[:150]}


# ============================================================================
# CAMPAIGN BY ID ENDPOINTS
# ============================================================================

@router.get("/{campaign_id}")
async def get_campaign(campaign_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Get campaign details."""
    tid = _get_tenant(db, user)
    c = _get_campaign(db, campaign_id, tid)
    return _serialize(c)


@router.put("/{campaign_id}")
async def update_campaign(campaign_id: int, data: CampaignUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Update a campaign draft."""
    tid = _get_tenant(db, user)
    c = _get_campaign(db, campaign_id, tid)

    if data.name is not None:
        c.name = data.name
    if data.campaign_type is not None:
        c.campaign_type = data.campaign_type
    if data.status is not None:
        c.status = data.status
    if data.message_body is not None:
        c.message_body = data.message_body
    if data.meta_template_name is not None:
        c.meta_template_name = data.meta_template_name
    if data.segment_filters is not None:
        c.segment_filters = data.segment_filters

    c.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    return _serialize(c)


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a campaign."""
    tid = _get_tenant(db, user)
    c = _get_campaign(db, campaign_id, tid)
    db.delete(c)
    db.commit()
    return {"ok": True}


# ============================================================================
# AI COPY GENERATION
# ============================================================================

@router.post("/{campaign_id}/generate-copy")
async def generate_copy(campaign_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Use AI to generate 3 message variants based on business data."""
    tid = _get_tenant(db, user)
    c = _get_campaign(db, campaign_id, tid)
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()

    # Gather business context
    total_clients = db.query(func.count(Client.id)).filter(Client.tenant_id == tid, Client.is_active == True).scalar() or 0

    # Top services
    top_services = db.query(
        VisitHistory.service_name,
        func.count(VisitHistory.id).label("cnt"),
        func.sum(VisitHistory.amount).label("rev"),
    ).filter(
        VisitHistory.tenant_id == tid,
        VisitHistory.status == "completed",
    ).group_by(VisitHistory.service_name).order_by(func.count(VisitHistory.id).desc()).limit(5).all()

    services_info = ", ".join([f"{s[0]} ({s[1]} ventas, ${s[2]:,} COP)" for s in top_services]) if top_services else "sin datos aún"

    # Campaign type descriptions
    type_desc = {
        "recovery": "recuperar clientes que llevan tiempo sin venir",
        "promo": "promocionar servicios con descuento u oferta especial",
        "vip": "agradecer y fidelizar a los mejores clientes",
        "reactivation": "hacer un último intento con clientes casi perdidos",
        "followup": "seguimiento post-servicio y pedir feedback",
    }

    biz_name = tenant.name if tenant else "el negocio"
    biz_type = tenant.business_type if tenant else "servicios"
    campaign_goal = type_desc.get(c.campaign_type, "marketing general")

    # Segment info
    filters = c.segment_filters or {}
    segment_desc = []
    if filters.get("status"):
        segment_desc.append(f"estado: {filters['status']}")
    if filters.get("days_inactive"):
        segment_desc.append(f"+{filters['days_inactive']} días sin venir")
    if filters.get("min_spent"):
        segment_desc.append(f"gastaron +${filters['min_spent']:,}")
    segment_str = ", ".join(segment_desc) if segment_desc else "audiencia general"

    prompt = f"""Eres un experto en marketing para negocios de {biz_type} en Colombia.
El negocio se llama "{biz_name}" y tiene {total_clients} clientes.
Sus servicios top son: {services_info}.

Genera EXACTAMENTE 3 variantes de mensaje para WhatsApp Business.

REGLAS:
- Máximo 160 caracteres cada mensaje
- Tono cercano, colombiano, profesional pero no formal
- INCLUIR {{{{nombre}}}} al inicio del mensaje (variable que se reemplaza por el nombre del cliente)
- NO usar emojis excesivos (máximo 1-2 por mensaje)
- Cada variante debe tener enfoque diferente (emocional, directo, con oferta)

CAMPAÑA: {c.name}
OBJETIVO: {campaign_goal}
SEGMENTO: {segment_str}

Responde SOLO en JSON con este formato exacto (sin markdown, sin explicaciones):
[
  {{"body": "mensaje aquí", "reason": "por qué funciona este enfoque"}},
  {{"body": "mensaje aquí", "reason": "por qué funciona este enfoque"}},
  {{"body": "mensaje aquí", "reason": "por qué funciona este enfoque"}}
]"""

    # Call Claude API
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="API key de IA no configurada")

    try:
        async with httpx.AsyncClient(timeout=30) as client_http:
            resp = await client_http.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": tenant.ai_model if tenant else "claude-sonnet-4-20250514",
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            data = resp.json()

            if resp.status_code != 200:
                error_msg = data.get("error", {}).get("message", str(data)[:200])
                raise HTTPException(status_code=500, detail=f"Error de IA: {error_msg}")

            ai_text = data.get("content", [{}])[0].get("text", "[]")

            # Parse JSON from AI response (handle possible markdown wrapping)
            clean = ai_text.strip()
            if clean.startswith("```"):
                clean = re.sub(r'^```\w*\n?', '', clean)
                clean = re.sub(r'\n?```$', '', clean)

            variants = json.loads(clean.strip())
            if not isinstance(variants, list):
                variants = []

    except json.JSONDecodeError:
        variants = [{"body": ai_text[:160], "reason": "Respuesta no estructurada de la IA"}]
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error conectando con IA: {str(e)[:100]}")

    # Save variants to campaign
    c.ai_variants = variants
    if variants and not c.message_body:
        c.message_body = variants[0].get("body", "")
    c.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(c)

    return {"variants": variants, "campaign": _serialize(c)}


# ============================================================================
# AUDIENCE PREVIEW
# ============================================================================

@router.post("/{campaign_id}/preview-audience")
async def preview_audience(campaign_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Preview how many clients match the campaign filters."""
    tid = _get_tenant(db, user)
    c = _get_campaign(db, campaign_id, tid)

    audience = _build_audience(db, tid, c.segment_filters or {})

    # Update count on campaign
    c.audience_count = len(audience)
    c.updated_at = datetime.utcnow()
    db.commit()

    # Return summary + sample
    sample = []
    for e in audience[:20]:
        cl = e["client"]
        sample.append({
            "id": cl.id,
            "name": cl.name,
            "phone": cl.phone,
            "status": e["status"],
        })

    return {
        "count": len(audience),
        "sample": sample,
        "campaign": _serialize(c),
    }


# ============================================================================
# SUBMIT TO META — Create template for approval
# ============================================================================

_META_CATEGORY_MAP = {
    "recovery": "MARKETING",
    "promo": "MARKETING",
    "vip": "MARKETING",
    "reactivation": "MARKETING",
    "followup": "UTILITY",
}


def _convert_variables_to_meta(body):
    """Convert {{nombre}}, {{hora}} to Meta's {{1}}, {{2}} format."""
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


@router.post("/{campaign_id}/submit-to-meta")
async def submit_to_meta(campaign_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Submit campaign message as a Meta template for approval."""
    tid = _get_tenant(db, user)
    c = _get_campaign(db, campaign_id, tid)

    if not c.message_body:
        raise HTTPException(status_code=400, detail="La campaña no tiene mensaje. Genera uno primero.")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    wa_business_id = (tenant.wa_business_account_id if tenant else None) or os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    wa_token = get_wa_token(db, tid)

    if not wa_business_id or not wa_token:
        raise HTTPException(status_code=400, detail="Credenciales de WhatsApp no configuradas")

    # Generate slug from campaign name
    slug = re.sub(r'[^a-z0-9]+', '_', c.name.lower()).strip('_')
    slug = f"camp_{slug}"[:60]  # Meta limit

    # Convert body to Meta format
    meta_body, var_order = _convert_variables_to_meta(c.message_body)
    meta_category = _META_CATEGORY_MAP.get(c.campaign_type, "MARKETING")

    components = [{"type": "BODY", "text": meta_body}]

    if var_order:
        example_values = {
            "nombre": "Juan",
            "servicio": "Corte Clásico",
            "negocio": tenant.name if tenant else "Mi Negocio",
            "dias": "30",
            "descuento": "10%",
            "profesional": "Carlos",
            "hora": "10:00 AM",
        }
        examples = [example_values.get(v, f"valor_{v}") for v in var_order]
        components[0]["example"] = {"body_text": [examples]}

    payload = {
        "name": slug,
        "language": "es",
        "category": meta_category,
        "components": components,
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client_http:
            resp = await client_http.post(
                f"https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates",
                headers={
                    "Authorization": f"Bearer {wa_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            data = resp.json()

            if resp.status_code in (200, 201):
                meta_status = data.get("status", "PENDING")
                c.meta_template_name = slug
                c.meta_template_id = data.get("id")
                c.meta_status = meta_status.lower()
                c.status = "approved" if meta_status == "APPROVED" else "pending_meta"
                c.updated_at = datetime.utcnow()
                db.commit()

                # Also save as MessageTemplate for Automations sync
                _sync_to_message_template(db, c, tid)

                return {"success": True, "meta_status": meta_status, "campaign": _serialize(c)}
            else:
                error_msg = data.get("error", {}).get("message", str(data)[:200])
                error_code = data.get("error", {}).get("code", 0)

                if error_code == 2388023 or "already exists" in error_msg.lower():
                    c.meta_template_name = slug
                    c.meta_status = "pending"
                    c.status = "pending_meta"
                    c.updated_at = datetime.utcnow()
                    db.commit()
                    return {"success": True, "meta_status": "ALREADY_EXISTS", "campaign": _serialize(c)}

                raise HTTPException(status_code=400, detail=f"Meta rechazó: {error_msg}")

    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error conectando con Meta: {str(e)[:100]}")


def _sync_to_message_template(db: Session, campaign: Campaign, tenant_id: int):
    """Save approved campaign template to MessageTemplate for Automations."""
    try:
        existing = db.query(MessageTemplate).filter(
            MessageTemplate.tenant_id == tenant_id,
            MessageTemplate.slug == campaign.meta_template_name,
        ).first()

        if existing:
            existing.body = campaign.message_body
            existing.status = campaign.meta_status or "pending"
        else:
            variables = re.findall(r'\{\{(\w+)\}\}', campaign.message_body or "")
            tpl = MessageTemplate(
                tenant_id=tenant_id,
                name=campaign.name,
                slug=campaign.meta_template_name or f"camp_{campaign.id}",
                category="promocion",
                body=campaign.message_body,
                variables=list(set(variables)),
                status=campaign.meta_status or "pending",
                language="es",
            )
            db.add(tpl)

        db.commit()
    except Exception as e:
        print(f"[CAMPAIGN] Error syncing to MessageTemplate: {e}")
        db.rollback()


# ============================================================================
# CHECK META STATUS
# ============================================================================

@router.post("/{campaign_id}/check-meta-status")
async def check_meta_status(campaign_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Check if Meta approved/rejected the campaign template."""
    tid = _get_tenant(db, user)
    c = _get_campaign(db, campaign_id, tid)

    if not c.meta_template_name:
        raise HTTPException(status_code=400, detail="Esta campaña no ha sido enviada a Meta")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    wa_business_id = (tenant.wa_business_account_id if tenant else None) or os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    wa_token = get_wa_token(db, tid)

    if not wa_business_id or not wa_token:
        raise HTTPException(status_code=400, detail="Credenciales de WhatsApp no configuradas")

    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            resp = await client_http.get(
                f"https://graph.facebook.com/{WA_API_VERSION}/{wa_business_id}/message_templates",
                headers={"Authorization": f"Bearer {wa_token}"},
                params={"name": c.meta_template_name, "limit": 1},
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
                }
                new_meta = status_map.get(meta_status, c.meta_status)
                c.meta_status = new_meta

                if new_meta == "approved":
                    c.status = "approved"
                elif new_meta == "rejected":
                    c.status = "rejected"

                c.updated_at = datetime.utcnow()
                db.commit()

                # Sync approval status to MessageTemplate
                _sync_to_message_template(db, c, tid)

                return {"meta_status": meta_status, "campaign": _serialize(c)}
            else:
                return {"meta_status": "NOT_FOUND", "campaign": _serialize(c)}

    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Error conectando con Meta: {str(e)[:100]}")


# ============================================================================
# SEND CAMPAIGN — Mass WhatsApp send
# ============================================================================

@router.post("/{campaign_id}/send")
async def send_campaign(campaign_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Send the campaign to all matching clients via WhatsApp template."""
    tid = _get_tenant(db, user)
    c = _get_campaign(db, campaign_id, tid)

    if not c.message_body:
        raise HTTPException(status_code=400, detail="La campaña no tiene mensaje")

    wa_token = get_wa_token(db, tid)
    wa_phone_id = get_wa_phone_id(db, tid)

    if not wa_token or not wa_phone_id:
        raise HTTPException(status_code=400, detail="Credenciales de WhatsApp no configuradas")

    # Build audience
    audience_enriched = _build_audience(db, tid, c.segment_filters or {})
    audience = _audience_to_clients(audience_enriched)
    if not audience:
        raise HTTPException(status_code=400, detail="No hay clientes que coincidan con los filtros")

    c.status = "sending"
    c.audience_count = len(audience)
    db.commit()

    sent = 0
    failed = 0
    template_name = c.meta_template_name

    for client_obj in audience:
        phone = normalize_phone(client_obj.phone)
        if len(phone) < 10:
            failed += 1
            continue

        # Resolve variables for this client
        first_name = (client_obj.name or "").split(" ")[0]

        try:
            if template_name and c.meta_status == "approved":
                # Send via approved template
                variables = re.findall(r'\{\{(\w+)\}\}', c.message_body or "")
                var_values = {
                    "nombre": first_name,
                    "negocio": db.query(Tenant).filter(Tenant.id == tid).first().name if tid else "",
                    "servicio": client_obj.favorite_service or "tu servicio",
                    "dias": str((date.today() - max((v.visit_date for v in db.query(VisitHistory).filter(VisitHistory.client_id == client_obj.id, VisitHistory.status == "completed").all()), default=date.today())).days),
                }

                components_params = []
                if variables:
                    params = [{"type": "text", "text": var_values.get(v, v)} for v in variables]
                    components_params = [{"type": "body", "parameters": params}]

                payload = {
                    "messaging_product": "whatsapp",
                    "to": phone,
                    "type": "template",
                    "template": {
                        "name": template_name,
                        "language": {"code": "es"},
                        "components": components_params,
                    },
                }
            else:
                # Send as free-form text (only works within 24h window)
                resolved_body = c.message_body.replace("{{nombre}}", first_name)
                payload = {
                    "messaging_product": "whatsapp",
                    "to": phone,
                    "type": "text",
                    "text": {"body": resolved_body},
                }

            async with httpx.AsyncClient(timeout=15) as client_http:
                resp = await client_http.post(
                    f"https://graph.facebook.com/{WA_API_VERSION}/{wa_phone_id}/messages",
                    headers={
                        "Authorization": f"Bearer {wa_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                if resp.status_code in (200, 201):
                    sent += 1
                else:
                    failed += 1
                    print(f"[CAMPAIGN] Send failed to {phone}: {resp.text[:100]}")

        except Exception as e:
            failed += 1
            print(f"[CAMPAIGN] Error sending to {phone}: {e}")

    # Update stats
    c.sent_count = sent
    c.failed_count = failed
    c.status = "sent"
    c.updated_at = datetime.utcnow()
    db.commit()

    return {
        "sent": sent,
        "failed": failed,
        "total": len(audience),
        "campaign": _serialize(c),
    }
