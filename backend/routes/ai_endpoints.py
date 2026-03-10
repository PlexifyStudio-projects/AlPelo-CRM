import os
import re
import json
import httpx

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta

from database.connection import get_db, SessionLocal
from database.models import AIConfig, Staff, Client, VisitHistory, ClientNote, WhatsAppConversation, WhatsAppMessage, Service, Appointment
from schemas import (
    AIConfigCreate, AIConfigUpdate, AIConfigResponse,
    AIChatRequest, AIChatResponse,
)
from routes._helpers import compute_client_list_item, compute_client_fields, find_client, find_conversation, normalize_phone

# Colombia timezone offset (UTC-5)
COL_OFFSET = timedelta(hours=-5)

def _now_colombia() -> datetime:
    """Current datetime in Colombia (UTC-5)."""
    return datetime.utcnow() + COL_OFFSET

def _today_colombia() -> date:
    """Current date in Colombia (UTC-5)."""
    return _now_colombia().date()

_DIAS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]
_MESES_ES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

def _fecha_colombia_str() -> str:
    """'lunes 10 de marzo de 2026' in Spanish, using Colombia timezone."""
    now = _now_colombia()
    dia_sem = _DIAS_ES[now.weekday()]
    mes = _MESES_ES[now.month]
    return f"{dia_sem} {now.day} de {mes} de {now.year}"

router = APIRouter()


# ============================================================================
# AI CONFIG — CRUD
# ============================================================================

@router.get("/ai/config", response_model=AIConfigResponse)
def get_active_ai_config(db: Session = Depends(get_db)):
    config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    if not config:
        raise HTTPException(status_code=404, detail="No hay configuracion de IA activa")
    return AIConfigResponse.model_validate(config)


@router.post("/ai/config", response_model=AIConfigResponse)
def create_ai_config(data: AIConfigCreate, db: Session = Depends(get_db)):
    db.query(AIConfig).filter(AIConfig.is_active == True).update({"is_active": False})
    config = AIConfig(**data.model_dump())
    db.add(config)
    db.commit()
    db.refresh(config)
    return AIConfigResponse.model_validate(config)


@router.put("/ai/config/{config_id}", response_model=AIConfigResponse)
def update_ai_config(config_id: int, data: AIConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(AIConfig).filter(AIConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuracion no encontrada")
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

def _build_business_context(db: Session) -> str:
    """Build a rich context string from the database for the AI."""

    sections = []

    # --- KPIs ---
    clients_all = db.query(Client).filter(Client.is_active == True).all()
    enriched = [compute_client_list_item(c, db) for c in clients_all]
    total = len(enriched)
    by_status = {}
    for c in enriched:
        by_status.setdefault(c.status, []).append(c)

    total_revenue = sum(c.total_spent for c in enriched)
    sections.append(f"""=== METRICAS DEL NEGOCIO ===
Total clientes activos: {total}
- VIP (10+ visitas): {len(by_status.get('vip', []))}
- Activos: {len(by_status.get('activo', []))}
- Nuevos: {len(by_status.get('nuevo', []))}
- En riesgo (30+ dias sin venir): {len(by_status.get('en_riesgo', []))}
- Inactivos (90+ dias): {len(by_status.get('inactivo', []))}
Ingreso total registrado: ${total_revenue:,} COP""")

    # --- Client list (compact) ---
    client_lines = []
    for c in sorted(enriched, key=lambda x: x.name):
        days_str = f"{c.days_since_last_visit}d" if c.days_since_last_visit is not None else "nunca"
        client_lines.append(
            f"  - {c.name} (ID:{c.client_id}, tel:{c.phone}, estado:{c.status}, "
            f"visitas:{c.total_visits}, gastado:${c.total_spent:,}, ultima visita:{days_str})"
        )
    sections.append("=== LISTA DE CLIENTES ===\n" + "\n".join(client_lines) if client_lines else "=== CLIENTES ===\nNo hay clientes registrados.")

    # --- Staff (compact) ---
    staff_all = db.query(Staff).filter(Staff.is_active == True).all()
    staff_lines = [f"  - ID:{s.id} {s.name} ({s.role})" for s in staff_all]
    sections.append("=== EQUIPO ===\n" + "\n".join(staff_lines) if staff_lines else "=== EQUIPO ===\nNo hay staff.")

    # --- Recent visits (last 10) ---
    recent_visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .order_by(VisitHistory.visit_date.desc())
        .limit(10)
        .all()
    )
    if recent_visits:
        visit_lines = []
        for v in recent_visits:
            client = db.query(Client).filter(Client.id == v.client_id).first()
            staff = db.query(Staff).filter(Staff.id == v.staff_id).first()
            visit_lines.append(
                f"  - {v.visit_date}: {client.name if client else '?'} | "
                f"{v.service_name} | ${v.amount:,} | por {staff.name if staff else '?'}"
            )
        sections.append("=== ULTIMAS VISITAS ===\n" + "\n".join(visit_lines))

    # --- Top services ---
    top_services = (
        db.query(VisitHistory.service_name, func.count().label("cnt"), func.sum(VisitHistory.amount).label("total"))
        .filter(VisitHistory.status == "completed")
        .group_by(VisitHistory.service_name)
        .order_by(func.count().desc())
        .limit(10)
        .all()
    )
    if top_services:
        svc_lines = [f"  - {s.service_name}: {s.cnt} veces, ${s.total:,} COP" for s in top_services]
        sections.append("=== SERVICIOS MAS POPULARES ===\n" + "\n".join(svc_lines))

    # --- Service catalog (compact: name, price, duration only) ---
    all_services = db.query(Service).filter(Service.is_active == True).order_by(Service.category, Service.name).all()
    if all_services:
        catalog_lines = []
        current_cat = None
        for svc in all_services:
            if svc.category != current_cat:
                current_cat = svc.category
                catalog_lines.append(f"\n  [{current_cat}]")
            duration = f" {svc.duration_minutes}min" if svc.duration_minutes else ""
            catalog_lines.append(f"  - {svc.name}: ${svc.price:,}{duration}")
        sections.append(f"=== SERVICIOS ({len(all_services)}) ===\n" + "\n".join(catalog_lines))

    # --- Upcoming appointments (today + next 3 days) ---
    today = _today_colombia()
    upcoming_end = today + timedelta(days=3)
    upcoming_apts = db.query(Appointment).filter(
        Appointment.date >= today,
        Appointment.date <= upcoming_end
    ).order_by(Appointment.date, Appointment.time).all()
    if upcoming_apts:
        apt_lines = []
        current_day = None
        for a in upcoming_apts:
            day_str = str(a.date)
            if day_str != current_day:
                current_day = day_str
                label = "HOY" if a.date == today else ("MANANA" if a.date == today + timedelta(days=1) else day_str)
                apt_lines.append(f"\n  [{label} — {day_str}]")
            staff_obj = db.query(Staff).filter(Staff.id == a.staff_id).first()
            svc_obj = db.query(Service).filter(Service.id == a.service_id).first()
            apt_lines.append(f"  - ID:{a.id} {a.time} | {a.client_name} | {svc_obj.name if svc_obj else '?'} | {staff_obj.name if staff_obj else '?'} | ${a.price or 0:,} | {a.status}")
        total_today = len([a for a in upcoming_apts if a.date == today])
        sections.append(f"=== AGENDA PROXIMA ({len(upcoming_apts)} citas, {total_today} hoy) ===\n" + "\n".join(apt_lines))

    return "\n\n".join(sections)


def _build_inbox_context(db: Session) -> str:
    """Build WhatsApp inbox summary for AI context — includes last messages."""
    convs = db.query(WhatsAppConversation).order_by(WhatsAppConversation.last_message_at.desc()).limit(20).all()
    if not convs:
        return "=== INBOX WHATSAPP ===\nNo hay conversaciones activas."

    total_unread = sum(c.unread_count or 0 for c in convs)
    ai_active = sum(1 for c in convs if c.is_ai_active)

    lines = [f"=== INBOX WHATSAPP — TU PUEDES VER ESTO EN TIEMPO REAL ({len(convs)} conversaciones, {total_unread} sin leer, IA activa en {ai_active}) ==="]
    lines.append("NOTA: Estos son los chats REALES de WhatsApp. Tu SI tienes acceso a ellos.")
    lines.append("")

    for c in convs:
        name = c.wa_contact_name or "Sin nombre"
        phone = c.wa_contact_phone
        unread = f" [{c.unread_count} sin leer]" if c.unread_count else ""
        ai = "IA:ON" if c.is_ai_active else "IA:OFF"
        tags = f" | tags:{','.join(c.tags)}" if c.tags else ""
        last_col = (c.last_message_at + COL_OFFSET) if c.last_message_at else None
        last = last_col.strftime("%d/%m %I:%M %p") if last_col else "nunca"

        # Client link
        client_info = ""
        if c.client_id:
            client = db.query(Client).filter(Client.id == c.client_id).first()
            if client:
                client_info = f" | CRM:{client.name} (ID:{client.client_id})"

        # Last inbound message timestamp (for 24h window check)
        last_inbound = db.query(WhatsAppMessage).filter(
            WhatsAppMessage.conversation_id == c.id,
            WhatsAppMessage.direction == "inbound"
        ).order_by(WhatsAppMessage.created_at.desc()).first()

        if last_inbound and last_inbound.created_at:
            hours_since_client = (datetime.utcnow() - last_inbound.created_at).total_seconds() / 3600
            if hours_since_client < 24:
                window_status = f"VENTANA ABIERTA ({hours_since_client:.0f}h) — texto libre OK"
            else:
                days_since = hours_since_client / 24
                window_status = f"VENTANA CERRADA ({days_since:.0f} dias) — SOLO PLANTILLA"
        else:
            window_status = "SIN MENSAJES DEL CLIENTE — SOLO PLANTILLA"

        # Last 5 messages for better context
        last_msgs = db.query(WhatsAppMessage).filter(
            WhatsAppMessage.conversation_id == c.id
        ).order_by(WhatsAppMessage.created_at.desc()).limit(5).all()

        msg_preview = ""
        if last_msgs:
            previews = []
            for m in reversed(last_msgs):
                direction = "CLIENTE" if m.direction == "inbound" else "LINA" if m.sent_by == "lina_ia" else "ADMIN"
                content = m.content[:120] if m.content else "[media]"
                previews.append(f"{direction}: {content}")
            msg_preview = "\n    " + "\n    ".join(previews)

        lines.append(f"  - Conv#{c.id}: {name} (tel:{phone}){unread} | {ai} | {window_status} | ultimo:{last}{client_info}{tags}{msg_preview}")

    return "\n".join(lines)


# ============================================================================
# ACTION EXECUTOR — Executes actions requested by the AI
# ============================================================================

def _execute_action(action: dict, db: Session) -> str:
    """Execute a business action and return a result message."""
    action_type = action.get("action")

    # ---- CLIENTS ----
    if action_type == "create_client":
        name = action.get("name", "").strip()
        phone = action.get("phone", "").strip()
        if not name or not phone:
            return "ERROR: Necesito al menos nombre y telefono para crear un cliente."

        last = db.query(Client).order_by(Client.id.desc()).first()
        next_num = (last.id + 1) if last else 1
        client_id = f"M{20200 + next_num}"

        existing = db.query(Client).filter(Client.phone == phone, Client.is_active == True).first()
        if existing:
            return f"Ya existe un cliente con ese telefono: {existing.name} ({existing.client_id})"

        client = Client(
            client_id=client_id,
            name=name,
            phone=phone,
            email=action.get("email"),
            favorite_service=action.get("favorite_service"),
            accepts_whatsapp=action.get("accepts_whatsapp", True),
        )
        db.add(client)
        db.commit()
        db.refresh(client)
        return f"Cliente creado: {client.name} (ID: {client.client_id}, Tel: {client.phone})"

    elif action_type == "update_client":
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""))
        if not client:
            return "ERROR: No encontre al cliente. Verifica el nombre o ID."

        allowed = ("name", "phone", "email", "favorite_service", "tags", "accepts_whatsapp", "status_override")
        updates = {k: v for k, v in action.items() if k in allowed and v is not None}
        for key, value in updates.items():
            setattr(client, key, value)
        db.commit()
        return f"Cliente {client.name} actualizado."

    elif action_type == "delete_client":
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""))
        if not client:
            return "ERROR: No encontre al cliente."
        client.is_active = False
        db.commit()
        return f"Cliente {client.name} desactivado."

    # ---- NOTES ----
    elif action_type == "add_note":
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""))
        if not client:
            return "ERROR: No encontre al cliente."
        note = ClientNote(client_id=client.id, content=action.get("content", ""), created_by="Lina IA")
        db.add(note)
        db.commit()
        return f"Nota agregada al perfil de {client.name}."

    # ---- STAFF ----
    elif action_type == "update_staff":
        staff = None
        staff_id = action.get("staff_id")
        if staff_id:
            staff = db.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            name = action.get("search_name", "")
            if name:
                staff = db.query(Staff).filter(Staff.name.ilike(f"%{name}%")).first()
        if not staff:
            return "ERROR: No encontre al miembro del equipo."

        allowed = ("name", "phone", "email", "role", "specialty", "bio", "skills", "rating", "is_active")
        updates = {k: v for k, v in action.items() if k in allowed and v is not None}
        for key, value in updates.items():
            setattr(staff, key, value)
        db.commit()
        return f"Staff {staff.name} actualizado."

    elif action_type == "create_staff":
        name = action.get("name", "").strip()
        if not name:
            return "ERROR: Necesito al menos el nombre."
        staff = Staff(
            name=name,
            phone=action.get("phone"),
            email=action.get("email"),
            role=action.get("role", "Barbero"),
            specialty=action.get("specialty"),
            bio=action.get("bio"),
            skills=action.get("skills", []),
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)
        return f"Staff creado: {staff.name} (ID: {staff.id}, Rol: {staff.role})"

    # ---- VISITS ----
    elif action_type == "add_visit":
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""))
        if not client:
            return "ERROR: No encontre al cliente."
        staff_id = action.get("staff_id")
        staff = db.query(Staff).filter(Staff.id == staff_id).first() if staff_id else None
        visit = VisitHistory(
            client_id=client.id,
            staff_id=staff.id if staff else None,
            service_name=action.get("service_name", "Corte"),
            amount=action.get("amount", 0),
            visit_date=date.today(),
            status="completed",
        )
        db.add(visit)
        db.commit()
        return f"Visita registrada para {client.name}: {visit.service_name} (${visit.amount:,})"

    # ---- WHATSAPP ----
    elif action_type == "send_whatsapp":
        # Accept multiple field names for search flexibility
        search_name = (action.get("search_name") or action.get("name") or action.get("client") or action.get("to") or action.get("contact") or "").strip()
        phone = (action.get("phone") or action.get("number") or action.get("telefono") or "").strip()
        message_text = (action.get("message") or action.get("text") or action.get("msg") or "").strip()

        if not message_text:
            return "ERROR: Necesito el texto del mensaje."

        # Find conversation by client name or phone
        conv = find_conversation(db, search_name=search_name, phone=phone)

        if not conv:
            return f"ERROR: No encontre una conversacion de WhatsApp para '{search_name or phone}'. Verifica que exista un chat activo."

        # Send via Meta WhatsApp API
        wa_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
        wa_phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        wa_api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")
        wa_base = f"https://graph.facebook.com/{wa_api_version}/{wa_phone_id}"

        wa_message_id = None
        status = "sent"
        try:
            resp = httpx.post(
                f"{wa_base}/messages",
                headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp",
                    "to": normalize_phone(conv.wa_contact_phone),
                    "type": "text",
                    "text": {"body": message_text},
                },
                timeout=15,
            )
            data = resp.json()
            if resp.status_code == 200 and "messages" in data:
                wa_message_id = data["messages"][0].get("id")
            else:
                status = "failed"
                return f"ERROR: No se pudo enviar el mensaje. {data.get('error', {}).get('message', '')}"
        except Exception as e:
            return f"ERROR: Fallo la conexion con WhatsApp: {str(e)}"

        # Store in DB
        msg = WhatsAppMessage(
            conversation_id=conv.id,
            wa_message_id=wa_message_id,
            direction="outbound",
            content=message_text,
            message_type="text",
            status=status,
            sent_by="lina_ia",
        )
        db.add(msg)
        conv.last_message_at = datetime.utcnow()
        db.commit()

        contact_name = conv.wa_contact_name or conv.wa_contact_phone
        return f"Mensaje enviado a {contact_name} por WhatsApp: \"{message_text[:60]}...\""

    # ---- SEND WHATSAPP TEMPLATE (for first contact / outside 24h window) ----
    elif action_type == "send_whatsapp_template":
        search_name = (action.get("search_name") or action.get("name") or action.get("client") or action.get("to") or "").strip()
        phone = (action.get("phone") or action.get("number") or "").strip()
        template_name = action.get("template_name", "hello_world")
        language_code = action.get("language_code", "en_US")

        # Find client phone
        target_phone = phone
        client_name = search_name
        if search_name and not phone:
            client = db.query(Client).filter(Client.name.ilike(f"%{search_name}%"), Client.is_active == True).first()
            if client:
                target_phone = client.phone
                client_name = client.name
            else:
                return f"ERROR: No encontre al cliente '{search_name}'."

        if not target_phone:
            return "ERROR: Necesito el telefono o nombre del cliente."

        phone_clean = normalize_phone(target_phone)
        wa_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
        wa_phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        wa_api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")
        wa_base = f"https://graph.facebook.com/{wa_api_version}/{wa_phone_id}"

        try:
            resp = httpx.post(
                f"{wa_base}/messages",
                headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
                json={
                    "messaging_product": "whatsapp",
                    "to": phone_clean,
                    "type": "template",
                    "template": {"name": template_name, "language": {"code": language_code}},
                },
                timeout=15,
            )
            data = resp.json()
            if resp.status_code == 200 and "messages" in data:
                wa_message_id = data["messages"][0].get("id")
            else:
                error_msg = data.get("error", {}).get("message", str(data))
                return f"ERROR: No se pudo enviar la plantilla a {client_name}. {error_msg}"
        except Exception as e:
            return f"ERROR: Fallo la conexion con WhatsApp: {str(e)}"

        # Get or create conversation
        conv = db.query(WhatsAppConversation).filter(
            WhatsAppConversation.wa_contact_phone.contains(phone_clean[-10:])
        ).first()
        if not conv:
            cl = db.query(Client).filter(Client.phone.contains(phone_clean[-10:])).first()
            conv = WhatsAppConversation(
                wa_contact_phone=target_phone,
                wa_contact_name=client_name or (cl.name if cl else None),
                client_id=cl.id if cl else None,
                is_ai_active=True,
                unread_count=0,
            )
            db.add(conv)
            db.flush()

        msg = WhatsAppMessage(
            conversation_id=conv.id,
            wa_message_id=wa_message_id,
            direction="outbound",
            content=f"[Plantilla: {template_name}]",
            message_type="template",
            status="sent",
            sent_by="lina_ia",
        )
        db.add(msg)
        conv.last_message_at = datetime.utcnow()
        db.commit()
        return f"Plantilla '{template_name}' enviada a {client_name} ({target_phone})."

    # ---- BULK SEND TEMPLATE ----
    elif action_type == "bulk_send_template":
        template_name = action.get("template_name", "hello_world")
        language_code = action.get("language_code", "en_US")
        min_days = action.get("min_days_since_visit")
        max_days = action.get("max_days_since_visit")
        status_filter = action.get("status")
        limit = action.get("limit", 50)

        # Build client query
        clients_all = db.query(Client).filter(Client.is_active == True).all()
        enriched = [compute_client_list_item(c, db) for c in clients_all]

        # Apply filters
        filtered = enriched
        if status_filter:
            filtered = [c for c in filtered if c.status == status_filter]
        if min_days is not None:
            filtered = [c for c in filtered if c.days_since_last_visit is not None and c.days_since_last_visit >= min_days]
        if max_days is not None:
            filtered = [c for c in filtered if c.days_since_last_visit is not None and c.days_since_last_visit <= max_days]

        filtered = filtered[:limit]
        if not filtered:
            return "No encontre clientes que coincidan con esos filtros."

        wa_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
        wa_phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        wa_api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")
        wa_base = f"https://graph.facebook.com/{wa_api_version}/{wa_phone_id}"

        sent_count = 0
        failed_count = 0
        results_detail = []

        for c in filtered:
            phone_clean = normalize_phone(c.phone)
            try:
                resp = httpx.post(
                    f"{wa_base}/messages",
                    headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
                    json={
                        "messaging_product": "whatsapp",
                        "to": phone_clean,
                        "type": "template",
                        "template": {"name": template_name, "language": {"code": language_code}},
                    },
                    timeout=15,
                )
                data = resp.json()
                if resp.status_code == 200 and "messages" in data:
                    wa_msg_id = data["messages"][0].get("id")
                    sent_count += 1

                    # Get or create conversation
                    conv = db.query(WhatsAppConversation).filter(
                        WhatsAppConversation.wa_contact_phone.contains(phone_clean[-10:])
                    ).first()
                    if not conv:
                        real_client = db.query(Client).filter(Client.id == c.id).first()
                        conv = WhatsAppConversation(
                            wa_contact_phone=c.phone,
                            wa_contact_name=c.name,
                            client_id=real_client.id if real_client else None,
                            is_ai_active=True,
                            unread_count=0,
                        )
                        db.add(conv)
                        db.flush()

                    msg = WhatsAppMessage(
                        conversation_id=conv.id,
                        wa_message_id=wa_msg_id,
                        direction="outbound",
                        content=f"[Plantilla: {template_name}]",
                        message_type="template",
                        status="sent",
                        sent_by="lina_ia",
                    )
                    db.add(msg)
                    conv.last_message_at = datetime.utcnow()
                    results_detail.append(f"OK: {c.name}")
                else:
                    failed_count += 1
                    err = data.get("error", {}).get("message", "")
                    results_detail.append(f"FALLO: {c.name} — {err[:50]}")
            except Exception as e:
                failed_count += 1
                results_detail.append(f"FALLO: {c.name} — {str(e)[:50]}")

        db.commit()
        summary = f"Plantilla '{template_name}' enviada a {sent_count}/{len(filtered)} clientes."
        if failed_count:
            summary += f" {failed_count} fallaron."
        return summary

    # ---- LIST CLIENTS BY FILTER ----
    elif action_type == "list_clients_by_filter":
        min_days = action.get("min_days_since_visit")
        max_days = action.get("max_days_since_visit")
        status_filter = action.get("status")
        limit = action.get("limit", 20)

        clients_all = db.query(Client).filter(Client.is_active == True).all()
        enriched = [compute_client_list_item(c, db) for c in clients_all]

        filtered = enriched
        if status_filter:
            filtered = [c for c in filtered if c.status == status_filter]
        if min_days is not None:
            filtered = [c for c in filtered if c.days_since_last_visit is not None and c.days_since_last_visit >= min_days]
        if max_days is not None:
            filtered = [c for c in filtered if c.days_since_last_visit is not None and c.days_since_last_visit <= max_days]

        filtered = sorted(filtered, key=lambda x: x.days_since_last_visit or 0, reverse=True)[:limit]
        if not filtered:
            return "No encontre clientes con esos filtros."

        lines = [f"Encontre {len(filtered)} clientes:"]
        for c in filtered:
            days_str = f"{c.days_since_last_visit}d" if c.days_since_last_visit is not None else "nunca"
            lines.append(f"  - {c.name} (tel:{c.phone}, estado:{c.status}, ultima:{days_str}, visitas:{c.total_visits}, gastado:${c.total_spent:,})")
        return "\n".join(lines)

    # ---- DELETE STAFF ----
    elif action_type == "delete_staff":
        staff = None
        staff_id = action.get("staff_id")
        if staff_id:
            staff = db.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            name = action.get("search_name", "")
            if name:
                staff = db.query(Staff).filter(Staff.name.ilike(f"%{name}%")).first()
        if not staff:
            return "ERROR: No encontre al miembro del equipo."
        staff.is_active = False
        db.commit()
        return f"Staff {staff.name} desactivado."

    # ---- DELETE CONVERSATION ----
    elif action_type == "delete_conversation":
        search_name = (action.get("search_name") or action.get("name") or action.get("client") or "").strip()
        phone = (action.get("phone") or action.get("number") or "").strip()

        conv = find_conversation(db, search_name=search_name, phone=phone)

        if not conv:
            return f"ERROR: No encontre la conversacion de '{search_name or phone}'."

        contact = conv.wa_contact_name or conv.wa_contact_phone
        db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv.id).delete()
        db.delete(conv)
        db.commit()
        return f"Conversacion con {contact} eliminada."

    # ---- INBOX SUMMARY ----
    elif action_type == "get_chat_messages":
        # Read full chat history of a conversation — Lina processes INTERNALLY
        search_name = (action.get("search_name") or action.get("name") or action.get("client") or "").strip()
        phone = (action.get("phone") or action.get("number") or "").strip()

        conv = find_conversation(db, search_name=search_name, phone=phone)
        if not conv:
            return f"ERROR: No encontre la conversacion de '{search_name or phone}'."

        # Get ALL messages for analysis but only send a compact summary
        msgs = db.query(WhatsAppMessage).filter(
            WhatsAppMessage.conversation_id == conv.id
        ).order_by(WhatsAppMessage.created_at.asc()).all()

        if not msgs:
            return f"No hay mensajes en la conversacion con {conv.wa_contact_name or conv.wa_contact_phone}."

        contact = conv.wa_contact_name or conv.wa_contact_phone

        # --- SERVER-SIDE ANALYSIS: extract key facts so we don't dump raw chat ---
        client_requests = []   # Things the client asked for
        lina_promises = []     # Things Lina committed to
        pending_items = []     # Unresolved items
        last_topic = ""
        visit_mentions = []
        appointment_mentions = []
        payment_mentions = []

        for m in msgs:
            content = (m.content or "").lower().strip()
            col_time = (m.created_at + COL_OFFSET) if m.created_at else None
            time_str = col_time.strftime("%d/%m %I:%M %p") if col_time else "?"

            if m.direction == "inbound":
                # Client requests
                if any(w in content for w in ["agendar", "agendam", "cita", "reserv", "quiero ir", "puedo ir"]):
                    appointment_mentions.append(f"{time_str}: {m.content[:120]}")
                if any(w in content for w in ["pago", "pagar", "bancolombia", "efectivo", "transferencia", "cuanto", "cuánto", "debo", "total"]):
                    payment_mentions.append(f"{time_str}: {m.content[:120]}")
                if any(w in content for w in ["visita", "corte", "barba", "servicio"]):
                    visit_mentions.append(f"{time_str}: {m.content[:120]}")
            elif m.sent_by == "lina_ia":
                if any(w in content for w in ["te agendo", "confirmad", "agendamos", "reserv"]):
                    lina_promises.append(f"{time_str}: {m.content[:120]}")
                if any(w in content for w in ["pendiente", "verificar", "confirmar", "te aviso"]):
                    pending_items.append(f"{time_str}: {m.content[:120]}")

        # Last 10 messages as recent context (compact)
        recent = msgs[-10:]
        recent_lines = []
        for m in recent:
            direction = "CLIENTE" if m.direction == "inbound" else ("LINA" if m.sent_by == "lina_ia" else "ADMIN")
            col_time = (m.created_at + COL_OFFSET) if m.created_at else None
            time_str = col_time.strftime("%d/%m %I:%M %p") if col_time else "?"
            content = (m.content or "[sin contenido]")[:150]
            recent_lines.append(f"  [{time_str}] {direction}: {content}")

        # Build ULTRA-COMPACT internal summary — the AI must NOT show this to admin
        # Only key facts that inform actions
        facts = []
        if appointment_mentions:
            facts.append(f"CITAS: {len(appointment_mentions)} mencionadas")
        if payment_mentions:
            facts.append(f"PAGOS: {len(payment_mentions)} mencionados")
        if visit_mentions:
            facts.append(f"SERVICIOS: {len(visit_mentions)} mencionados")
        if pending_items:
            facts.append(f"PENDIENTES: {len(pending_items)}")

        # Only the LAST 5 messages for immediate context
        recent = msgs[-5:]
        recent_lines = []
        for m in recent:
            direction = "C" if m.direction == "inbound" else "L"
            content = (m.content or "")[:80]
            recent_lines.append(f"{direction}: {content}")

        return (
            f"[INTERNO — Chat de {contact}, {len(msgs)} msgs]\n"
            f"{' | '.join(facts) if facts else 'Sin items pendientes'}\n"
            f"Contexto reciente:\n" + "\n".join(recent_lines) + "\n"
            f"---\n"
            f"INSTRUCCION CRITICA: Este resultado es SOLO para tu memoria interna. "
            f"NO muestres este analisis al admin. Responde con UN RESUMEN de maximo 2 lineas "
            f"y luego EJECUTA las acciones (add_visit, create_appointment, add_note, etc). "
            f"Si el admin pidio que hagas algo, HAZLO AHORA con bloques ```action```."
        )

    elif action_type == "get_inbox_summary":
        convs = db.query(WhatsAppConversation).order_by(WhatsAppConversation.last_message_at.desc()).all()
        if not convs:
            return "No hay conversaciones de WhatsApp."

        total_unread = sum(c.unread_count or 0 for c in convs)
        ai_active = sum(1 for c in convs if c.is_ai_active)
        ai_off = len(convs) - ai_active

        lines = [f"Inbox: {len(convs)} conversaciones, {total_unread} sin leer, IA activa en {ai_active}, IA apagada en {ai_off}."]
        for c in convs[:10]:
            name = c.wa_contact_name or c.wa_contact_phone
            unread = f" ({c.unread_count} sin leer)" if c.unread_count else ""
            ai = "IA ON" if c.is_ai_active else "IA OFF"
            tags = ", ".join(c.tags) if c.tags else ""
            last_col = (c.last_message_at + COL_OFFSET) if c.last_message_at else None
            last = last_col.strftime("%d/%m %I:%M %p") if last_col else "nunca"
            lines.append(f"  - {name}{unread} | {ai} | ultimo: {last}" + (f" | tags: {tags}" if tags else ""))
        return "\n".join(lines)

    # ---- TOGGLE AI FOR CONVERSATION ----
    elif action_type == "toggle_conversation_ai":
        search_name = (action.get("search_name") or action.get("name") or action.get("client") or "").strip()
        phone = (action.get("phone") or action.get("number") or "").strip()
        enable = action.get("enable", True)

        conv = find_conversation(db, search_name=search_name, phone=phone)

        if not conv:
            return f"ERROR: No encontre la conversacion de '{search_name or phone}'."

        conv.is_ai_active = enable
        db.commit()
        state = "activada" if enable else "desactivada"
        contact = conv.wa_contact_name or conv.wa_contact_phone
        return f"IA {state} para la conversacion con {contact}."

    # ---- TAG CONVERSATION ----
    elif action_type == "tag_conversation":
        search_name = (action.get("search_name") or action.get("name") or action.get("client") or "").strip()
        phone = (action.get("phone") or action.get("number") or "").strip()
        tags = action.get("tags", [])

        conv = find_conversation(db, search_name=search_name, phone=phone)

        if not conv:
            return f"ERROR: No encontre la conversacion de '{search_name or phone}'."

        conv.tags = tags
        db.commit()
        contact = conv.wa_contact_name or conv.wa_contact_phone
        return f"Etiquetas de {contact} actualizadas: {', '.join(tags) if tags else 'sin etiquetas'}."

    # ---- PERSONALITY ----
    elif action_type == "update_personality":
        new_prompt = action.get("system_prompt", "").strip()
        if not new_prompt:
            return "ERROR: No recibi el nuevo prompt de personalidad."
        config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
        if config:
            config.system_prompt = new_prompt
            db.commit()
            return "Personalidad actualizada. Los cambios ya estan activos."
        else:
            config = AIConfig(name="Lina IA", system_prompt=new_prompt)
            db.add(config)
            db.commit()
            return "Configuracion de personalidad creada y activada."

    # ---- AI CONFIG ----
    elif action_type == "update_ai_config":
        config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
        if not config:
            return "ERROR: No hay configuracion activa."
        allowed = ("temperature", "max_tokens", "model", "provider")
        for k in allowed:
            if k in action and action[k] is not None:
                setattr(config, k, action[k])
        db.commit()
        return f"Configuracion de IA actualizada."

    # ---- SERVICES ----
    elif action_type == "list_services":
        category_filter = action.get("category")
        query = db.query(Service).filter(Service.is_active == True)
        if category_filter:
            query = query.filter(Service.category.ilike(f"%{category_filter}%"))
        services = query.order_by(Service.category, Service.name).all()
        if not services:
            return "No encontre servicios con esos filtros."
        lines = [f"Encontre {len(services)} servicios:"]
        current_cat = None
        for s in services:
            if s.category != current_cat:
                current_cat = s.category
                lines.append(f"\n[{current_cat}]")
            dur = f", {s.duration_minutes}min" if s.duration_minutes else ""
            lines.append(f"  - ID:{s.id} {s.name}: ${s.price:,}{dur}")
        return "\n".join(lines)

    elif action_type == "create_service":
        name = action.get("name", "").strip()
        category = action.get("category", "").strip()
        price = action.get("price", 0)
        if not name or not category:
            return "ERROR: Necesito al menos nombre y categoria."
        svc = Service(
            name=name,
            category=category,
            price=int(price),
            duration_minutes=action.get("duration_minutes"),
            description=action.get("description"),
            staff_ids=action.get("staff_ids", []),
        )
        db.add(svc)
        db.commit()
        db.refresh(svc)
        return f"Servicio creado: {svc.name} (ID:{svc.id}, {svc.category}, ${svc.price:,})"

    elif action_type == "update_service":
        svc = None
        svc_id = action.get("service_id")
        if svc_id:
            svc = db.query(Service).filter(Service.id == svc_id).first()
        if not svc:
            name = action.get("search_name", "")
            if name:
                svc = db.query(Service).filter(Service.name.ilike(f"%{name}%"), Service.is_active == True).first()
        if not svc:
            return "ERROR: No encontre el servicio."
        allowed = ("name", "category", "price", "duration_minutes", "description", "staff_ids", "is_active")
        updates = {k: v for k, v in action.items() if k in allowed and v is not None}
        if "price" in updates:
            updates["price"] = int(updates["price"])
        for key, value in updates.items():
            setattr(svc, key, value)
        db.commit()
        return f"Servicio '{svc.name}' actualizado."

    elif action_type == "delete_service":
        svc = None
        svc_id = action.get("service_id")
        if svc_id:
            svc = db.query(Service).filter(Service.id == svc_id).first()
        if not svc:
            name = action.get("search_name", "")
            if name:
                svc = db.query(Service).filter(Service.name.ilike(f"%{name}%"), Service.is_active == True).first()
        if not svc:
            return "ERROR: No encontre el servicio."
        svc.is_active = False
        db.commit()
        return f"Servicio '{svc.name}' desactivado."

    # ── APPOINTMENTS ──────────────────────────────────
    elif action_type == "list_appointments":
        q = db.query(Appointment)
        if action.get("date"):
            q = q.filter(Appointment.date == action["date"])
        if action.get("date_from"):
            q = q.filter(Appointment.date >= action["date_from"])
        if action.get("date_to"):
            q = q.filter(Appointment.date <= action["date_to"])
        if action.get("staff_name"):
            st = db.query(Staff).filter(Staff.name.ilike(f"%{action['staff_name']}%")).first()
            if st:
                q = q.filter(Appointment.staff_id == st.id)
        if action.get("status"):
            q = q.filter(Appointment.status == action["status"])
        if action.get("client_name"):
            q = q.filter(Appointment.client_name.ilike(f"%{action['client_name']}%"))
        apts = q.order_by(Appointment.date, Appointment.time).limit(action.get("limit", 30)).all()
        if not apts:
            return "No encontre citas con esos filtros."
        lines = []
        for a in apts:
            staff_obj = db.query(Staff).filter(Staff.id == a.staff_id).first()
            svc_obj = db.query(Service).filter(Service.id == a.service_id).first()
            lines.append(f"- ID:{a.id} | {a.date} {a.time} | {a.client_name} ({a.client_phone}) | {svc_obj.name if svc_obj else '?'} | {staff_obj.name if staff_obj else '?'} | ${a.price or 0:,} | {a.status}")
        return f"Encontre {len(apts)} cita(s):\n" + "\n".join(lines)

    elif action_type == "create_appointment":
        # Required: client_name, client_phone, staff (name or id), service (name or id), date, time
        client_name = action.get("client_name")
        client_phone = action.get("client_phone", "")
        if not client_name:
            return "ERROR: Necesito client_name para crear la cita."

        # Find or resolve staff
        staff_obj = None
        if action.get("staff_id"):
            staff_obj = db.query(Staff).filter(Staff.id == action["staff_id"]).first()
        elif action.get("staff_name"):
            staff_obj = db.query(Staff).filter(Staff.name.ilike(f"%{action['staff_name']}%"), Staff.is_active == True).first()
        if not staff_obj:
            return "ERROR: No encontre al profesional."

        # Find or resolve service
        svc_obj = None
        if action.get("service_id"):
            svc_obj = db.query(Service).filter(Service.id == action["service_id"]).first()
        elif action.get("service_name"):
            svc_obj = db.query(Service).filter(Service.name.ilike(f"%{action['service_name']}%"), Service.is_active == True).first()
        if not svc_obj:
            return "ERROR: No encontre el servicio."

        apt_date = action.get("date")
        apt_time = action.get("time")
        if not apt_date or not apt_time:
            return "ERROR: Necesito date (YYYY-MM-DD) y time (HH:MM)."

        # Find client_id if exists
        client_obj = db.query(Client).filter(Client.name.ilike(f"%{client_name}%")).first()

        new_apt = Appointment(
            client_id=client_obj.id if client_obj else None,
            client_name=client_name,
            client_phone=client_phone or (client_obj.phone if client_obj else ""),
            staff_id=staff_obj.id,
            service_id=svc_obj.id,
            date=date.fromisoformat(apt_date) if isinstance(apt_date, str) else apt_date,
            time=apt_time,
            duration_minutes=svc_obj.duration_minutes,
            price=svc_obj.price,
            status=action.get("status", "confirmed"),
            notes=action.get("notes"),
            created_by="lina_ia",
        )
        db.add(new_apt)
        db.commit()
        db.refresh(new_apt)
        return f"Cita creada (ID:{new_apt.id}): {client_name} con {staff_obj.name} para {svc_obj.name} el {apt_date} a las {apt_time}. Precio: ${svc_obj.price:,}."

    elif action_type == "update_appointment":
        apt = None
        apt_id = action.get("appointment_id")
        if apt_id:
            apt = db.query(Appointment).filter(Appointment.id == apt_id).first()
        if not apt:
            return "ERROR: No encontre la cita. Necesito appointment_id."

        changed = []
        if action.get("status"):
            apt.status = action["status"]
            changed.append(f"estado={action['status']}")
        if action.get("date"):
            apt.date = date.fromisoformat(action["date"]) if isinstance(action["date"], str) else action["date"]
            changed.append(f"fecha={action['date']}")
        if action.get("time"):
            apt.time = action["time"]
            changed.append(f"hora={action['time']}")
        if action.get("staff_name"):
            st = db.query(Staff).filter(Staff.name.ilike(f"%{action['staff_name']}%"), Staff.is_active == True).first()
            if st:
                apt.staff_id = st.id
                changed.append(f"profesional={st.name}")
        if action.get("staff_id"):
            apt.staff_id = action["staff_id"]
            changed.append(f"staff_id={action['staff_id']}")
        if action.get("notes"):
            apt.notes = action["notes"]
            changed.append("notas")
        if action.get("service_name"):
            svc = db.query(Service).filter(Service.name.ilike(f"%{action['service_name']}%"), Service.is_active == True).first()
            if svc:
                apt.service_id = svc.id
                apt.duration_minutes = svc.duration_minutes
                apt.price = svc.price
                changed.append(f"servicio={svc.name}")
        if not changed:
            return "No se especificaron cambios."
        db.commit()
        return f"Cita ID:{apt.id} actualizada: {', '.join(changed)}."

    elif action_type == "delete_appointment":
        apt_id = action.get("appointment_id")
        if not apt_id:
            return "ERROR: Necesito appointment_id para eliminar."
        apt = db.query(Appointment).filter(Appointment.id == apt_id).first()
        if not apt:
            return "ERROR: No encontre cita con ID {}.".format(apt_id)
        info = f"{apt.client_name} - {apt.date} {apt.time}"
        db.delete(apt)
        db.commit()
        return f"Cita eliminada: {info}."

    return f"ERROR: Accion desconocida '{action_type}'"



# ============================================================================
# SYSTEM PROMPT BUILDER
# ============================================================================

DEFAULT_PERSONALITY = """Eres Lina, asistente ejecutiva de AlPelo Peluqueria (Cabecera, Bucaramanga). Bumanguesa, profesional, calida, directa. Tuteas al admin. Max 2-3 lineas. 1 emoji si aporta. Texto plano sin markdown.

Estilo: "Tienes 3 en riesgo, el peor es Miguel Torres — 45 dias sin venir." / "Listo, cliente creado. Juan Perez, M20231." / "Hoy van $450.000 en 12 servicios."

Reservas: https://book.weibook.co/alpelo-peluqueria | Ubicacion: Cabecera, Bucaramanga."""


def _build_whatsapp_context(db: Session, conv_id: int = None) -> str:
    """Build context for WhatsApp — client-specific data if conv_id provided, plus staff."""
    from database.models import WhatsAppConversation
    sections = []

    if conv_id:
        conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
        if conv and conv.client_id:
            # Linked CRM client — fetch full data
            client = db.query(Client).filter(Client.id == conv.client_id).first()
            if client:
                computed = compute_client_fields(client, db)

                total_visits = len(client.visits) if client.visits else 0
                total_spent = sum(v.amount for v in client.visits) if client.visits else 0
                last_visit = client.visits[0].visit_date if client.visits else None
                days_since = (datetime.now().date() - last_visit).days if last_visit else None

                # Favorite service from visits
                favorite_svc = client.favorite_service or "No definido"

                # Preferred barber
                preferred_barber = "No definido"
                if client.preferred_barber:
                    preferred_barber = client.preferred_barber.name

                status = computed.status if hasattr(computed, 'status') else "activo"
                tags = ", ".join(client.tags) if client.tags else "Sin etiquetas"

                client_section = f"""=== CLIENTE EN ESTA CONVERSACION ===
Nombre: {client.name}
Telefono: {client.phone}
ID: {client.client_id}
Estado: {status}
Etiquetas: {tags}
Total visitas: {total_visits}
Total gastado: ${total_spent:,} COP
Ultima visita: {last_visit or 'Nunca'}
Dias sin visita: {days_since if days_since is not None else 'N/A'}
Servicio favorito: {favorite_svc}
Barbero preferido: {preferred_barber}"""

                # Last 5 visits
                last_5 = client.visits[:5] if client.visits else []
                if last_5:
                    visit_lines = []
                    for v in last_5:
                        staff = db.query(Staff).filter(Staff.id == v.staff_id).first()
                        visit_lines.append(f"  - {v.visit_date}: {v.service_name} | ${v.amount:,} | {staff.name if staff else '?'}")
                    client_section += "\nUltimas visitas:\n" + "\n".join(visit_lines)

                # Notes
                notes = client.notes[:5] if client.notes else []
                if notes:
                    note_lines = [f"  - {n.created_at.strftime('%d/%m/%Y') if n.created_at else '?'}: {n.content[:100]}" for n in notes]
                    client_section += "\nNotas:\n" + "\n".join(note_lines)

                sections.append(client_section)

        elif conv:
            # No linked client
            phone = conv.wa_contact_phone
            sections.append(f"=== CONTACTO NO REGISTRADO ===\nEste numero ({phone}) NO esta en la base de datos de clientes. Es un contacto nuevo o no registrado.")

    # Staff names + specialty (always include)
    staff_all = db.query(Staff).filter(Staff.is_active == True).all()
    if staff_all:
        staff_lines = [f"  {s.name} ({s.specialty or s.role})" for s in staff_all]
        sections.append("EQUIPO:\n" + "\n".join(staff_lines))

    # Services catalog — COMPACT: top services per category (not all 98)
    all_services = db.query(Service).filter(Service.is_active == True).order_by(Service.category, Service.name).all()
    if all_services:
        # Group by category, show max 8 per category to save tokens
        from collections import defaultdict
        by_cat = defaultdict(list)
        for svc in all_services:
            by_cat[svc.category or "General"].append(svc)

        svc_lines = []
        for cat, svcs in by_cat.items():
            svc_lines.append(f"[{cat}] ({len(svcs)} servicios)")
            for svc in svcs[:8]:
                svc_lines.append(f"  {svc.name}: ${svc.price:,}")
            if len(svcs) > 8:
                svc_lines.append(f"  ... y {len(svcs) - 8} mas (usa list_services para ver todos)")
        sections.append(f"SERVICIOS ({len(all_services)} total):\n" + "\n".join(svc_lines))

    # Today's appointments (so Lina can check availability before scheduling)
    today = _today_colombia()
    todays_apts = db.query(Appointment).filter(
        Appointment.date == today,
        Appointment.status.in_(["confirmed", "completed"]),
    ).order_by(Appointment.time).all()
    if todays_apts:
        apt_lines = []
        for a in todays_apts:
            staff_obj = db.query(Staff).filter(Staff.id == a.staff_id).first()
            svc_obj = db.query(Service).filter(Service.id == a.service_id).first()
            apt_lines.append(f"  ID:{a.id} {a.time} | {a.client_name} | {svc_obj.name if svc_obj else '?'} | {staff_obj.name if staff_obj else '?'} | {a.status}")
        sections.append(f"AGENDA HOY ({today.strftime('%d/%m/%Y')}) — {len(todays_apts)} citas (ESTAS YA EXISTEN, no las crees de nuevo):\n" + "\n".join(apt_lines))
    else:
        sections.append(f"AGENDA HOY ({today.strftime('%d/%m/%Y')}): Sin citas agendadas.")

    # Tomorrow's appointments too (clients often book for tomorrow)
    tomorrow = today + timedelta(days=1)
    tomorrows_apts = db.query(Appointment).filter(
        Appointment.date == tomorrow,
        Appointment.status.in_(["confirmed", "completed"]),
    ).order_by(Appointment.time).all()
    if tomorrows_apts:
        apt_lines = []
        for a in tomorrows_apts:
            staff_obj = db.query(Staff).filter(Staff.id == a.staff_id).first()
            svc_obj = db.query(Service).filter(Service.id == a.service_id).first()
            apt_lines.append(f"  ID:{a.id} {a.time} | {a.client_name} | {svc_obj.name if svc_obj else '?'} | {staff_obj.name if staff_obj else '?'} | {a.status}")
        sections.append(f"AGENDA MAÑANA ({tomorrow.strftime('%d/%m/%Y')}) — {len(tomorrows_apts)} citas (ESTAS YA EXISTEN):\n" + "\n".join(apt_lines))

    # Pending tasks — notes with "PENDIENTE" across ALL clients (Lina's task memory)
    pending_notes = (
        db.query(ClientNote)
        .filter(ClientNote.content.ilike("%PENDIENTE:%"))
        .order_by(ClientNote.created_at.desc())
        .limit(15)
        .all()
    )
    if pending_notes:
        task_lines = []
        for n in pending_notes:
            client = db.query(Client).filter(Client.id == n.client_id).first()
            client_name = client.name if client else "?"
            created = n.created_at.strftime('%d/%m %H:%M') if n.created_at else "?"
            task_lines.append(f"  [{created}] {client_name}: {n.content[:150]}")
        sections.append(f"⚡ TAREAS PENDIENTES ({len(pending_notes)}):\n" + "\n".join(task_lines))

    return "\n\n".join(sections)


def _build_system_prompt(db: Session, is_whatsapp: bool = False, conv_id: int = None) -> str:
    """Build the full system prompt with personality + tools + context."""
    config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    personality = config.system_prompt if config else DEFAULT_PERSONALITY

    if is_whatsapp:
        wa_context = _build_whatsapp_context(db, conv_id=conv_id)

        return f"""Eres Lina de AlPelo Peluqueria (Cabecera, Bucaramanga). WhatsApp real, NO bot. Control total del CRM.

HOY: {_fecha_colombia_str()} | Hora: {_now_colombia().strftime('%I:%M %p')} | Mañana: {(_today_colombia() + timedelta(days=1)).strftime('%Y-%m-%d')} ({_DIAS_ES[(_today_colombia() + timedelta(days=1)).weekday()]})
Horario: Lun-Sab 9am-8pm. Dom CERRADO.
FUERA DE HORARIO: Si es de noche/domingo, igual atiende con amabilidad. Puedes agendar citas, responder precios, dar info. Solo di el horario si preguntan directamente. NO repitas "mañana abrimos" ni intentes cerrar la conversacion.

REGLA #1 — EJECUTA YA, CERO LARGAS
Tienes TODA la info abajo (agenda, servicios, equipo, precios). RESPONDE directo.
PROHIBIDO: "Voy a revisar/consultar/confirmar/verificar", "Te confirmo en un momento", "Dejame chequear", "Te paso el link"
EN VEZ: Cliente pide cita → CREALA con ```action```. Pregunta precio → DILO (esta abajo en SERVICIOS). Pregunta disponibilidad → MIRA la AGENDA abajo y responde.
Excepcion UNICA: pagos/comprobantes (admin verifica).

REGLA #2 — PERSISTENTE COMO UNA MAQUINA
Eres imparable. Si prometiste algo, HAZLO AHORA con acciones. Si fallo algo, REINTENTA. Si hay TAREAS PENDIENTES abajo, RESUELVELAS inmediatamente.
NO dejas NADA a medias. NO dices "te aviso luego". NO creas una tarea si puedes hacerlo YA.
Si falta info pregunta directo: "A que hora te viene bien?"
Si dices "te agendo", INCLUYE el bloque ```action``` de create_appointment. Si dices "te envio recordatorio", crea la nota PENDIENTE.
Cada tarea que creas DEBE tener sentido y ser ejecutable por el sistema automatico.

REGLA #3 — LEE TODO EL CONTEXTO
Lee COMPLETO el historial de la conversacion antes de responder. Si el cliente pregunto 3 cosas, responde LAS 3. Si hiciste una promesa en mensajes anteriores, CUMPLELA. No ignores mensajes previos.

REGLA #4 — DIFERENCIA INFORMAR vs CREAR
La seccion AGENDA ABAJO muestra citas YA EXISTENTES. Si el cliente pregunta "a que hora es mi cita?", responde con la info que ves — NO uses create_appointment.
SOLO usa create_appointment cuando el cliente pide una cita NUEVA que NO existe en la agenda.
Si una cita YA EXISTE, dile "Tienes tu cita a las X con Y". Si NO existe, dile "Te agendo" y CREA la accion.
NUNCA digas "te agendé" si la cita ya existia — di "tienes agendada" o "tu cita es a las...".

COMO HABLAS
2-4 lineas. Texto plano, NADA de markdown/**negritas**/##. Calida, cercana, servicial.
SIEMPRE muestra disposicion: "en que te puedo ayudar?", "con mucho gusto", "claro que si".
SIEMPRE responde a lo que el cliente PREGUNTO. Si pregunto por disponibilidad, DA la disponibilidad. Si pregunto precio, DA el precio. No respondas solo con un saludo.
NUNCA cierres la conversacion tu primero. No digas "Hasta luego" a menos que el cliente se despida.
Si el cliente pregunta "estas ahi?" → "Hola [nombre]! Si, aqui estoy, en que te puedo ayudar?" (NO "Si, estoy aca. Hasta luego!")
NO frases de bot. NO "Chau". NO "Ay". NO inventes info.
Si preguntan si eres IA: "No jaja, soy Lina del equipo"
Sticker/emoji sin texto: ignora.
ANTI-REPETICION ESTRICTA: Lee el historial — si ya saludaste, NO saludes de nuevo. Si ya preguntaste algo, NO lo preguntes otra vez. Responde DIRECTO al ultimo mensaje del cliente.
AUDIOS: Cuando recibes [Audio del cliente], ya tienes la transcripcion. Responde al CONTENIDO del audio.
Despedidas: SOLO si el CLIENTE se despide primero. Responde breve y calido: "Dale, que estes bien!" o "Con gusto, buena noche!"

IMAGENES: Puedes VER imagenes. Describe y responde. Comprobante de pago → tag "⚠️ Pago pendiente", di que verificas. VIDEOS: NO puedes ver, pide que explique.
PAGOS: Cliente PAGO/envia comprobante → tag "⚠️ Pago pendiente". Cliente PREGUNTA cuanto/como → responde precios normal.
Pago: Efectivo | Nequi | Daviplata | Bancolombia

CLIENTES
Nuevo (no registrado): "Hola! Soy Lina de AlPelo. Con quien tengo el gusto?" → create_client con telefono
Existente: Saluda por nombre, usa su info (servicio favorito, barbero, historial)

CITAS
1. Cliente pide cita → mira agenda + servicios abajo
2. Pregunta SOLO lo que falta (servicio/dia/hora/barbero)
3. CREA con create_appointment inmediatamente
4. "Listo! Te agende [servicio] con [barbero] el [fecha] a las [hora]"
Sin barbero especifico → asigna disponible. Sin hora → sugiere horario.

PENDIENTES: Guardar con add_note "PENDIENTE: [tarea]". Resolver con "RESUELTO: [tarea]". Si puedes hacerlo ahora, HAZLO, no crees PENDIENTE.
RECORDATORIOS: El sistema automatico envia recordatorio 10min antes de citas. Solo crea nota PENDIENTE.

ACCIONES (bloques ```action``` al FINAL):
create_client: name, phone | update_client: search_name, +campos | delete_client: search_name
add_note: search_name, content | list_clients_by_filter: status?, min_days_since_visit?, limit?
create_appointment: client_name, staff_name, service_name, date(YYYY-MM-DD), time(HH:MM) | update_appointment: appointment_id(NUMERO, ej: 42), +campos | delete_appointment: appointment_id(NUMERO) | list_appointments: date?, staff_name?, status?
IMPORTANTE: appointment_id SIEMPRE es un NUMERO entero (ej: 42, 157). Mira los IDs en la AGENDA abajo. NUNCA inventes IDs como "appointment_id_6:35pm".
list_services: category? | add_visit: search_name, staff_id, service_name, amount
tag_conversation: search_name|phone, tags(list)
VISITAS: Siempre add_visit + create_appointment(status=completed). Ambas.
Formato: ```action\n{{"action":"NOMBRE","param":"valor"}}\n```

SEGURIDAD: No expongas credenciales/DB. Solo datos reales. Pagos: NUNCA confirmes.

{wa_context}"""

    business_context = _build_business_context(db)
    inbox_summary = _build_inbox_context(db)

    return f"""{personality}

REGLA CRITICA: NUNCA ejecutes acciones sin permiso explicito del admin. Primero informa, luego pregunta, solo ejecuta cuando diga "si/hazlo/dale/procede". Si dice "revisa X", SOLO reportas — no envias ni modificas nada.

CAPACIDADES (tienes control total del CRM):
- Dashboard: metricas, KPIs, resumen del dia, tendencias
- Clientes: consultar/crear/editar/desactivar, notas, filtros por estado/dias/gasto
- Agenda: ver/crear/editar/eliminar citas, estados (confirmed/completed/cancelled/no_show), precio y duracion auto desde servicio
- Servicios: catalogo completo, crear/editar/desactivar, filtrar por categoria
- Equipo: datos del staff, crear/editar/desactivar
- WhatsApp: VER chats reales (estan en INBOX abajo), LEER chats completos (get_chat_messages), enviar mensajes, plantillas, masivos, toggle IA, etiquetar, eliminar conversaciones
- IMPORTANTE: Si el admin pide que revises un chat, usa get_chat_messages para leer el historial COMPLETO. El inbox solo muestra previews.
- CRITICO: El resultado de get_chat_messages es INTERNO — NUNCA lo muestres al admin. Solo di "Ya revisé el chat de [nombre]" y luego EJECUTA las acciones con bloques ```action```. PROHIBIDO mostrar listas de mensajes, analisis, timestamps, o cualquier detalle del chat. El admin NO quiere ver eso.
- REGLA ABSOLUTA: Si el admin te pide "lee el chat y haz X", despues de leer di "Listo, ya lo revisé" e INMEDIATAMENTE haz X con acciones. NUNCA te quedes solo leyendo o mostrando el analisis.
- Config: cambiar personalidad, modelo, temperatura, tokens

WHATSAPP — REGLA DE 24H:
- Cliente escribio hace <24h → texto libre OK (send_whatsapp), pero PREGUNTA al admin antes
- Cliente escribio hace >24h o sin conversacion → SOLO plantilla (send_whatsapp_template), INFORMA al admin
- Masivo → bulk_send_template con filtros
- Plantilla aprobada: hello_world (en_US)
- TU SI VES LOS CHATS. Estan en la seccion INBOX WHATSAPP. Nunca digas que no tienes acceso.
- Si un numero parcial coincide con un telefono del inbox/clientes, conectalo.

ACCIONES — Incluye bloques ```action``` al FINAL de tu respuesta. Puedes incluir varios.

Clientes:
  create_client: name, phone, email?, favorite_service?, accepts_whatsapp?
  update_client: search_name|client_id, + campos (name/phone/email/favorite_service/tags/accepts_whatsapp/status_override)
  delete_client: search_name|client_id
  add_note: search_name|client_id, content
  list_clients_by_filter: status?, min_days_since_visit?, max_days_since_visit?, limit?

Equipo:
  create_staff: name, role?, specialty?, phone?, email?
  update_staff: search_name|staff_id, + campos (name/phone/email/role/specialty/bio/skills/rating/is_active)
  delete_staff: search_name|staff_id

Visitas:
  add_visit: search_name|client_id, staff_id, service_name, amount

Servicios:
  list_services: category?
  create_service: name, category, price, duration_minutes?, description?, staff_ids?
  update_service: service_id|search_name, + campos (name/category/price/duration_minutes/description/staff_ids/is_active)
  delete_service: service_id|search_name

Agenda:
  list_appointments: date?|date_from+date_to?, staff_name?, status?, client_name?, limit?
  create_appointment: client_name, client_phone?, staff_name|staff_id, service_name|service_id, date (YYYY-MM-DD), time (HH:MM), notes?
  update_appointment: appointment_id, + campos (status/date/time/staff_name/staff_id/service_name/notes)
  delete_appointment: appointment_id

WhatsApp:
  get_chat_messages: search_name|phone, limit? (default 50) — LEE el chat completo de una conversacion
  send_whatsapp: search_name|phone, message
  send_whatsapp_template: search_name|phone, template_name, language_code
  bulk_send_template: template_name, language_code, min_days_since_visit?, max_days_since_visit?, status?, limit?
  get_inbox_summary
  toggle_conversation_ai: search_name|phone, enable (bool)
  tag_conversation: search_name|phone, tags (list)
  delete_conversation: search_name|phone

Config:
  update_personality: system_prompt
  update_ai_config: temperature?, max_tokens?, model?, provider?

Formato de accion:
```action
{{"action": "NOMBRE", "param": "valor"}}
```

SEGURIDAD: Nunca expongas credenciales/tokens/estructura DB. Nunca toques tabla admin. Solo datos reales — nunca inventes.
FORMATO: Texto plano, max 2-4 lineas. Listas: nombre — dato — dato. Montos COP sin decimales ($25.000). Sin markdown (**/#). Confirma acciones en 1 linea.

HOY: {_fecha_colombia_str()} | Hora: {_now_colombia().strftime('%I:%M %p')} (Colombia UTC-5)

{business_context}

{inbox_summary}"""


# ============================================================================
# PROVIDER CALL — Claude (Anthropic) only
# ============================================================================

async def _call_anthropic(api_key: str, model: str, system_prompt: str, messages: list, temperature: float, max_tokens: int):
    """Call Claude API. Messages can contain text strings or multi-content blocks (for vision)."""
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": messages,
        "temperature": temperature,
    }
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}

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


# ============================================================================
# AI CHAT — Main endpoint with context + action execution
# ============================================================================

ACTION_PATTERN = re.compile(r'```action\s*(.*?)```', re.DOTALL)

@router.post("/ai/chat", response_model=AIChatResponse)
async def ai_chat(data: AIChatRequest, db: Session = Depends(get_db)):
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY no configurada en el servidor.")

    config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    model = (config.model if config and config.model and "claude" in (config.model or "") else "claude-sonnet-4-5-20250929")
    temperature = config.temperature if config else 0.4
    max_tokens = config.max_tokens if config else 1024

    # Build system prompt with live business data
    system_prompt = _build_system_prompt(db)

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
    else:
        messages.append({"role": "user", "content": data.message})

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
            result = _execute_action(action, db)
            action_results.append(result)
        except json.JSONDecodeError:
            action_results.append("ERROR: No pude parsear la accion.")

    # Clean action blocks from response
    clean_text = ACTION_PATTERN.sub('', text).strip()

    if action_results:
        results_str = "\n".join(f"-> {r}" for r in action_results)
        clean_text += f"\n\n{results_str}"

    return AIChatResponse(response=clean_text, tokens_used=tokens)


# ============================================================================
# STANDALONE AI CALL — Used by WhatsApp auto-reply
# ============================================================================

async def _call_ai(system_prompt: str, history: list, user_message: str, image_b64: str = None, image_mime: str = None, model_override: str = None) -> str:
    """Standalone AI call for WhatsApp auto-reply. Uses Claude only. Supports image vision.
    model_override: if provided, use this model. Otherwise reads from AIConfig."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_key:
        return "Disculpa, no puedo responder en este momento. Contacta a Al Pelo directamente."

    # Resolve model: override > AIConfig > default Sonnet
    if not model_override:
        db_temp = SessionLocal()
        try:
            config = db_temp.query(AIConfig).filter(AIConfig.is_active == True).first()
            model_override = config.model if config and config.model and "claude" in (config.model or "") else "claude-sonnet-4-5-20250929"
        finally:
            db_temp.close()

    # Build the user message — with image if provided (Claude Vision)
    if image_b64 and image_mime:
        user_content = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image_mime,
                    "data": image_b64,
                },
            },
            {"type": "text", "text": user_message or "El cliente envio esta imagen. Describe lo que ves y responde."},
        ]
    else:
        user_content = user_message

    messages = list(history) + [{"role": "user", "content": user_content}]

    try:
        text, _ = await _call_anthropic(anthropic_key, model_override, system_prompt, messages, 0.4, 2048)
        return text.strip()
    except Exception as e:
        print(f"[AI WhatsApp] Claude ({model_override}) failed: {e}")
        return None


def _call_ai_sync(system_prompt: str, history: list, user_message: str) -> str:
    """Synchronous AI call for scheduler morning review (runs in background thread)."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_key:
        return None

    messages = list(history) + [{"role": "user", "content": user_message}]

    payload = {
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 2048,
        "system": system_prompt,
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
        return text.strip() if text else None
    except Exception as e:
        print(f"[AI Sync] Claude failed: {e}")
        return None
