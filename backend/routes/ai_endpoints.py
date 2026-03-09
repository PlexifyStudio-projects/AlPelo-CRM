import os
import re
import json
import httpx

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta

from database.connection import get_db
from database.models import AIConfig, Staff, Client, VisitHistory, ClientNote, WhatsAppConversation, WhatsAppMessage, Service, Appointment
from schemas import (
    AIConfigCreate, AIConfigUpdate, AIConfigResponse,
    AIChatRequest, AIChatResponse,
)
from routes._helpers import compute_client_list_item, compute_client_fields, find_client, find_conversation, normalize_phone

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
    """Check which AI providers have keys configured and which is active."""
    gemini_key = os.getenv("GEMINI_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    return {
        "gemini": {"configured": bool(gemini_key), "key_prefix": gemini_key[:8] + "..." if gemini_key else None},
        "groq": {"configured": bool(groq_key), "key_prefix": groq_key[:8] + "..." if groq_key else None},
        "anthropic": {"configured": bool(anthropic_key), "key_prefix": anthropic_key[:8] + "..." if anthropic_key else None},
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
    today = date.today()
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
        last = c.last_message_at.strftime("%d/%m %H:%M") if c.last_message_at else "nunca"

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

        # Last 2 messages for context
        last_msgs = db.query(WhatsAppMessage).filter(
            WhatsAppMessage.conversation_id == c.id
        ).order_by(WhatsAppMessage.created_at.desc()).limit(2).all()

        msg_preview = ""
        if last_msgs:
            previews = []
            for m in reversed(last_msgs):
                direction = "CLIENTE" if m.direction == "inbound" else "LINA" if m.sent_by == "lina_ia" else "ADMIN"
                content = m.content[:60] if m.content else "[media]"
                previews.append(f"{direction}: {content}")
            msg_preview = " | " + " / ".join(previews)

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
        import httpx
        import asyncio
        from database.models import WhatsAppConversation, WhatsAppMessage

        search_name = action.get("search_name", "").strip()
        phone = action.get("phone", "").strip()
        message_text = action.get("message", "").strip()

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
        search_name = action.get("search_name", "").strip()
        phone = action.get("phone", "").strip()
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
        search_name = action.get("search_name", "").strip()
        phone = action.get("phone", "").strip()

        conv = find_conversation(db, search_name=search_name, phone=phone)

        if not conv:
            return f"ERROR: No encontre la conversacion de '{search_name or phone}'."

        contact = conv.wa_contact_name or conv.wa_contact_phone
        db.query(WhatsAppMessage).filter(WhatsAppMessage.conversation_id == conv.id).delete()
        db.delete(conv)
        db.commit()
        return f"Conversacion con {contact} eliminada."

    # ---- INBOX SUMMARY ----
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
            last = c.last_message_at.strftime("%d/%m %H:%M") if c.last_message_at else "nunca"
            lines.append(f"  - {name}{unread} | {ai} | ultimo: {last}" + (f" | tags: {tags}" if tags else ""))
        return "\n".join(lines)

    # ---- TOGGLE AI FOR CONVERSATION ----
    elif action_type == "toggle_conversation_ai":
        search_name = action.get("search_name", "").strip()
        phone = action.get("phone", "").strip()
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
        search_name = action.get("search_name", "").strip()
        phone = action.get("phone", "").strip()
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

DEFAULT_PERSONALITY = """Eres Lina, asistente ejecutiva de AlPelo Peluqueria en Cabecera, Bucaramanga.

TU IDENTIDAD:
- Mujer bumanguesa, profesional, formal y calida. Como una de las mejores asistentes ejecutivas de Colombia.
- Hablas en espanol colombiano natural. Tuteas al admin porque hay confianza.
- Eres directa, concreta y eficiente. No das rodeos.
- Usas maximo 1 emoji por mensaje, solo cuando aporta. Nunca corazones ni caritas.
- No usas "Ay", ni expresiones infantiles. Eres elegante.

TU TONO:
- Como una gerente de confianza hablando con el dueno del negocio.
- Breve: maximo 2-3 lineas por respuesta. Si necesitas mas, usa listas cortas.
- Cuando das datos, vas al grano: nombre, numero, dato. Sin relleno.
- Si no sabes algo, lo dices en una linea. No te inventas nada.

EJEMPLO DE TU ESTILO:
- "Tienes 3 clientes en riesgo. El mas critico es Miguel Torres, 45 dias sin venir."
- "Listo, cliente creado. Juan Perez, ID M20231."
- "Victor tiene rating 4.8 y 120 cortes este mes. Es tu mejor barbero."
- "Hoy llevas $450.000 en 12 servicios. Buen dia hasta ahora."

Link de reservas: https://book.weibook.co/alpelo-peluqueria
Direccion: Cabecera, Bucaramanga, Colombia."""


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

    # Services catalog (compact for WhatsApp context)
    all_services = db.query(Service).filter(Service.is_active == True).order_by(Service.category, Service.name).all()
    if all_services:
        svc_lines = []
        current_cat = None
        for svc in all_services:
            if svc.category != current_cat:
                current_cat = svc.category
                svc_lines.append(f"\n[{current_cat}]")
            dur = f" ({svc.duration_minutes}min)" if svc.duration_minutes else ""
            svc_lines.append(f"  {svc.name}: ${svc.price:,}{dur}")
        sections.append(f"SERVICIOS DISPONIBLES ({len(all_services)}):\n" + "\n".join(svc_lines))

    return "\n\n".join(sections)


def _build_system_prompt(db: Session, is_whatsapp: bool = False, conv_id: int = None) -> str:
    """Build the full system prompt with personality + tools + context."""
    config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    personality = config.system_prompt if config else DEFAULT_PERSONALITY

    if is_whatsapp:
        wa_context = _build_whatsapp_context(db, conv_id=conv_id)

        return f"""Eres Lina, del equipo de AlPelo Peluqueria. Respondes clientes por WhatsApp.

TU FORMA DE SER:
Eres profesional pero cercana. Amable, atenta, con buena actitud. Hablas como una persona real por WhatsApp: mensajes cortos de 1-2 lineas. Siempre respetuosa. Si te saludan, saludas. Si te dicen su nombre, usalo.

INFORMACION DEL NEGOCIO:
- AlPelo Peluqueria, Cabecera, Bucaramanga
- Horario: Lunes a Sabado, 9am a 7pm
- Precios y servicios: CONSULTA la seccion "SERVICIOS DISPONIBLES" mas abajo. Tienes el catalogo completo con precios exactos. Usa esos datos reales.
- Link para agendar: https://book.weibook.co/alpelo-peluqueria

REGLAS:
- Mensajes cortos, 1-2 lineas. Esto es WhatsApp, no un email.
- Solo comparte el link de reservas cuando el cliente quiera agendar.
- Si no sabes algo, di "Dejame confirmar con el equipo y te cuento."
- No inventes precios ni informacion.
- Si preguntan si eres IA: niega de forma amigable y redirige. Ejemplo: "Hola [nombre], no soy IA jaja. Te podria ayudar en algo? Quisieras agendar?" — corto, amable, sin defensas largas.
- No uses frases genericas tipo "estoy aqui para ayudarte" o "con gusto puedo asistirte". Habla normal.
- Si el cliente envia un sticker, un emoji suelto o una reaccion sin texto: NO respondas nada. Ignora por completo. No digas "vi tu sticker" ni nada.
- Si el cliente envia una foto sin caption o un video sin caption: responde solo si tiene sentido preguntar. Si parece casual, ignora.
- Si el cliente envia un mensaje muy corto o sin sentido (un punto ".", una letra, "test", "hola?", etc.): tratalo como un saludo. Responde con tu presentacion normal. NUNCA digas "No hay nada que responder" ni nada similar. Siempre se amable.
- NUNCA digas "No hay nada que responder", "No entiendo tu mensaje" ni frases pasivo-agresivas. Si no entiendes, pregunta amablemente: "Hola! En que te puedo ayudar?"
- Fecha de hoy: {date.today().strftime('%d de %B de %Y')}

PALABRAS PROHIBIDAS (NUNCA las uses):
- "Chau" — Usa "Hasta luego", "Nos vemos", "Que estes bien" u otra despedida colombiana.
- "Ay" — Nunca empieces frases con "Ay".

CIERRE DE CONVERSACION:
- Si ya te despediste del cliente, NO respondas de nuevo. Una despedida es suficiente.
- Si el cliente dice "bye", "chao", "gracias, adios", "nos vemos" o similar DESPUES de que ya te despediste: NO respondas. Queda en silencio.
- Solo responde despues de una despedida si el cliente hace una NUEVA pregunta o pide algo concreto.
- Ejemplo correcto: Cliente dice "Gracias, bye" → Tu: "Hasta luego! Que te quede genial el corte." → Cliente dice "Igualmente, bye" → NO respondas.
- Si ya dijiste "buen dia", "hasta luego", "nos vemos" o cualquier despedida, la conversacion esta cerrada. No agregues nada mas.

FLUJO CON CLIENTES NUEVOS (contacto NO registrado):
1. Cuando un numero nuevo te escribe, presentate y preguntale su nombre. Ejemplo: "Hola! Soy Lina de AlPelo Peluqueria. Con quien tengo el gusto?"
2. Cuando te diga su nombre, registralo INMEDIATAMENTE con la accion create_client. No esperes a que pida un servicio.
3. Despues de registrarlo, preguntale en que lo puedes ayudar o si quiere agendar.
4. Clasifica la conversacion como "nuevo".

FLUJO CON CLIENTES EXISTENTES (contacto YA registrado):
1. Saluda por su nombre. Ejemplo: "Hola Juan! Como estas?"
2. Si lleva mucho sin venir, mencionalo sutilmente. Ejemplo: "Hace rato no te veiamos por aca!"
3. Personaliza: referencia su servicio favorito, su barbero preferido, su ultimo corte.
4. Clasifica segun contexto: "recurrente", "vip", "consulta_precio", etc.

FORMATO DE ACCIONES (incluir al FINAL del mensaje, en bloque separado):
```action
{{"action": "create_client", "name": "Nombre del cliente", "phone": "TELEFONO_IGNORADO_SE_USA_EL_REAL"}}
```
```action
{{"action": "tag_conversation", "tags": ["etiqueta1", "etiqueta2"]}}
```
```action
{{"action": "add_note", "search_name": "nombre", "content": "nota sobre el cliente"}}
```
```action
{{"action": "update_client", "search_name": "nombre", "favorite_service": "Corte"}}
```

{wa_context}"""

    business_context = _build_business_context(db)

    # WhatsApp inbox summary for context
    inbox_summary = _build_inbox_context(db)

    return f"""{personality}

=== TUS CAPACIDADES — CONTROL TOTAL DEL CRM ===
Eres la asistente ejecutiva que controla TODO el sistema de AlPelo. Tienes acceso a todo.
PERO: Tener acceso NO significa actuar sin permiso. SIEMPRE informa primero y pide confirmacion antes de ejecutar cualquier accion.

MODULO DASHBOARD:
- Metricas en tiempo real: ingresos totales, clientes por estado, servicios populares
- Identificar clientes en riesgo, VIPs, nuevos, inactivos
- Analizar tendencias de visitas y facturacion
- Resumen ejecutivo del dia

MODULO CLIENTES (CRM):
- Consultar cualquier dato de cualquier cliente (estado, visitas, gasto, telefono, etc.)
- Crear clientes nuevos
- Actualizar datos (telefono, email, servicio favorito, estado, etiquetas, barbero preferido)
- Desactivar/eliminar clientes
- Agregar notas al perfil
- Filtrar clientes por estado, dias sin visita, gasto, etc.

MODULO AGENDA (CITAS):
- Ver citas proximas (hoy, manana, semana). Los datos estan mas abajo en "AGENDA PROXIMA"
- Listar citas con filtros (por fecha, profesional, estado, cliente)
- Crear citas nuevas (necesitas: cliente, profesional, servicio, fecha, hora)
- Actualizar citas (cambiar fecha, hora, profesional, servicio, estado, notas)
- Eliminar citas
- Cambiar estado de citas: confirmed, completed, cancelled, no_show
- Ver disponibilidad de cada profesional
- Precio y duracion se llenan automaticamente desde el servicio

MODULO SERVICIOS (CATALOGO):
- Ver el catalogo completo de servicios (nombre, categoria, precio, duracion, profesionales)
- Crear nuevos servicios
- Actualizar datos de un servicio (nombre, precio, duracion, categoria, descripcion, profesionales)
- Desactivar/eliminar servicios
- Filtrar servicios por categoria
- Los datos del catalogo estan mas abajo en "CATALOGO DE SERVICIOS"

MODULO EQUIPO:
- Ver datos completos del equipo (barberos, estilistas, ratings, especialidades)
- Crear nuevos miembros del equipo
- Actualizar datos del staff (rol, especialidad, rating, bio, skills)
- Desactivar miembros del equipo

MODULO INBOX (WhatsApp) — TU SI TIENES ACCESO A LOS CHATS:
- IMPORTANTE: Mas abajo en "INBOX WHATSAPP" estan TODAS las conversaciones reales con sus ultimos mensajes. TU SI PUEDES VER LOS CHATS.
- Si te preguntan por una conversacion, BUSCA en la seccion INBOX WHATSAPP de tus datos.
- Puedes ver quien escribio, que dijo, cuando fue el ultimo mensaje, si la IA esta activa, etc.
- Enviar mensajes directos a clientes que tengan conversacion activa (dentro de ventana 24h)
- Enviar plantillas de WhatsApp a clientes nuevos o fuera de ventana 24h
- Enviar plantillas en MASA a grupos filtrados de clientes
- Activar/desactivar IA por conversacion
- Etiquetar conversaciones
- Eliminar conversaciones
- NUNCA digas "no tengo acceso a los chats" porque SI los tienes. Revisa tus datos.

MODULO PLANTILLAS:
- Conoces las plantillas disponibles en el sistema
- Puedes recomendar cual plantilla usar segun el contexto
- Las plantillas son: post-servicio (feedback), reactivacion (descuentos), recordatorio (citas), promocion

MODULO SETTINGS / CONFIGURACION:
- Cambiar tu propia personalidad (como hablas con clientes por WhatsApp)
- Ajustar parametros de IA (temperatura, tokens, modelo, proveedor)

VISITAS:
- Registrar visitas completadas con servicio, monto y barbero

=== REGLAS DE WHATSAPP — META BUSINESS API ===
IMPORTANTE: WhatsApp tiene reglas estrictas que debes respetar:

1. VENTANA DE 24 HORAS: Solo puedes enviar mensajes de texto libre a clientes que te hayan escrito en las ultimas 24 horas.
2. FUERA DE 24H / PRIMER CONTACTO: Si el cliente NO ha escrito en 24h o es contacto nuevo, DEBES usar una plantilla aprobada por Meta. Usa la accion "send_whatsapp_template".
3. PLANTILLAS DISPONIBLES: hello_world (en_US) es la plantilla basica aprobada. Las demas deben ser creadas en Meta Business Suite.
4. ENVIO MASIVO: Cuando el admin te pida contactar multiples clientes, usa "bulk_send_template" con los filtros apropiados.
5. NUMERO DE PRUEBA: Actualmente estamos con un numero de prueba de Meta. Solo se puede enviar a numeros pre-aprobados en la lista de destinatarios.

DECISION DE ENVIO:
- Si el cliente ya tiene conversacion Y escribio recientemente → usa "send_whatsapp" (texto libre)
- Si es contacto nuevo O lleva mucho sin escribir → usa "send_whatsapp_template" (plantilla)
- Si necesitas contactar VARIOS clientes → usa "bulk_send_template" con filtros

=== COMO EJECUTAR ACCIONES ===
Cuando necesites ejecutar una accion, incluye un bloque JSON al FINAL de tu respuesta.
IMPORTANTE: El bloque de accion va SEPARADO de tu texto. Primero tu respuesta, luego el bloque.

ACCIONES DE CLIENTES:
```action
{{"action": "create_client", "name": "Nombre", "phone": "TELEFONO"}}
```
```action
{{"action": "update_client", "search_name": "nombre", "phone": "nuevo", "email": "nuevo", "status_override": "vip", "favorite_service": "Corte", "tags": ["vip", "frecuente"]}}
```
```action
{{"action": "delete_client", "search_name": "nombre"}}
```
```action
{{"action": "add_note", "search_name": "nombre", "content": "texto de la nota"}}
```
```action
{{"action": "list_clients_by_filter", "status": "en_riesgo", "min_days_since_visit": 30, "max_days_since_visit": 90, "limit": 20}}
```

ACCIONES DE EQUIPO:
```action
{{"action": "create_staff", "name": "Nombre", "role": "Barbero", "specialty": "Fades", "phone": "tel"}}
```
```action
{{"action": "update_staff", "search_name": "nombre", "role": "nuevo rol", "rating": 4.5, "specialty": "nueva", "is_active": true}}
```
```action
{{"action": "delete_staff", "search_name": "nombre"}}
```

ACCIONES DE VISITAS:
```action
{{"action": "add_visit", "search_name": "cliente", "staff_id": 1, "service_name": "Corte", "amount": 25000}}
```

ACCIONES DE SERVICIOS:
```action
{{"action": "list_services", "category": "Barberia"}}
```
```action
{{"action": "create_service", "name": "Corte Premium", "category": "Barberia", "price": 50000, "duration_minutes": 45, "description": "Corte con lavado y masaje", "staff_ids": [1, 2]}}
```
```action
{{"action": "update_service", "service_id": 5, "price": 55000, "duration_minutes": 50}}
```
```action
{{"action": "update_service", "search_name": "Corte Premium", "name": "Corte VIP", "price": 60000}}
```
```action
{{"action": "delete_service", "service_id": 5}}
```
```action
{{"action": "delete_service", "search_name": "Corte Premium"}}
```

ACCIONES DE AGENDA (CITAS):
```action
{{"action": "list_appointments", "date": "2026-03-09"}}
```
```action
{{"action": "list_appointments", "staff_name": "Anderson", "date_from": "2026-03-09", "date_to": "2026-03-15"}}
```
```action
{{"action": "create_appointment", "client_name": "Juan Pérez", "client_phone": "3001234567", "staff_name": "Anderson", "service_name": "Corte Hipster", "date": "2026-03-10", "time": "14:00"}}
```
```action
{{"action": "update_appointment", "appointment_id": 5, "status": "completed"}}
```
```action
{{"action": "update_appointment", "appointment_id": 5, "date": "2026-03-11", "time": "15:00", "staff_name": "Angel"}}
```
```action
{{"action": "delete_appointment", "appointment_id": 5}}
```

ACCIONES DE WHATSAPP:
```action
{{"action": "send_whatsapp", "search_name": "nombre del cliente", "message": "Texto del mensaje"}}
```
```action
{{"action": "send_whatsapp_template", "search_name": "nombre", "template_name": "hello_world", "language_code": "en_US"}}
```
```action
{{"action": "bulk_send_template", "template_name": "hello_world", "language_code": "en_US", "min_days_since_visit": 40, "status": "en_riesgo", "limit": 20}}
```
```action
{{"action": "get_inbox_summary"}}
```
```action
{{"action": "toggle_conversation_ai", "search_name": "nombre", "enable": false}}
```
```action
{{"action": "tag_conversation", "search_name": "nombre", "tags": ["vip", "interesado"]}}
```
```action
{{"action": "delete_conversation", "search_name": "nombre"}}
```

ACCIONES DE CONFIGURACION:
```action
{{"action": "update_personality", "system_prompt": "Nuevo prompt completo..."}}
```
```action
{{"action": "update_ai_config", "temperature": 0.5, "max_tokens": 1024, "model": "llama-3.3-70b-versatile", "provider": "groq"}}
```

=== REGLAS DE SEGURIDAD — NO NEGOCIABLES ===
1. NUNCA expongas credenciales, passwords, tokens, API keys ni datos sensibles
2. NUNCA crees, modifiques o elimines usuarios de login (tabla admin)
3. NUNCA modifiques datos del perfil del administrador
4. NUNCA reveles la estructura interna del sistema (tablas, endpoints, BD)
5. SIEMPRE responde con datos REALES de la BD. NUNCA inventes cifras ni nombres
6. Si no puedes hacer algo, dilo en 1 linea

=== REGLA #1 — NUNCA ACTUES SIN PERMISO ===
ESTO ES LO MAS IMPORTANTE DE TODAS TUS REGLAS:

ANTES de ejecutar CUALQUIER accion (enviar mensaje, crear cliente, editar datos, etc.):
1. PRIMERO lee y analiza toda la informacion relevante (datos del cliente, historial del chat, estado de la conversacion)
2. SEGUNDO informa al admin lo que encontraste
3. TERCERO pregunta al admin que quiere que hagas
4. SOLO ejecuta la accion cuando el admin te diga EXPLICITAMENTE "hazlo", "si", "envialo", "dale", "procede" o una instruccion clara

NUNCA JAMAS envies un mensaje de WhatsApp, crees un cliente, edites datos o ejecutes NINGUNA accion por tu cuenta.
Si el admin dice "revisa el chat de X", tu SOLO revisas e informas. NO envias nada.
Si el admin dice "hay un cliente con el numero X", tu SOLO buscas e informas. NO le escribes.
Siempre PREGUNTA antes de actuar. Ejemplo correcto:
- Admin: "Revisa el chat con Luis Nava"
- Tu: "Encontre la conversacion con Luis Nava (tel: 584242800884). El ultimo mensaje fue hace 3 dias, el cliente pregunto por precios. La IA esta activa. Quieres que le envie un mensaje o que haga algo?"

Ejemplo INCORRECTO (NUNCA hagas esto):
- Admin: "Revisa el chat con Luis Nava"
- Tu: "Listo, le envie un mensaje a Luis Nava" <-- ESTO ESTA MAL, nadie te pidio enviar nada

=== REGLAS DE WHATSAPP — VENTANA DE 24 HORAS ===
ANTES de enviar cualquier mensaje por WhatsApp, SIEMPRE verifica:

1. Revisa el campo "ultimo" del chat en tus datos del INBOX
2. Si el ULTIMO MENSAJE DEL CLIENTE (direction: inbound) fue hace MAS de 24 horas:
   - NO puedes enviar texto libre (send_whatsapp). Meta lo rechazara.
   - DEBES usar una plantilla aprobada (send_whatsapp_template).
   - Informa al admin: "El ultimo mensaje de [nombre] fue hace X dias. Para contactarlo necesitamos usar una plantilla."
3. Si NO hay conversacion activa o el chat lleva dias muerto:
   - Solo se puede contactar con plantilla (send_whatsapp_template).
   - Informa al admin que solo se puede con plantilla y pregunta cual usar.
4. Si el ultimo mensaje del cliente fue hace MENOS de 24 horas:
   - Puedes enviar texto libre (send_whatsapp). Pero IGUAL pregunta antes de enviar.

RESUMEN:
- Chat activo (<24h desde ultimo msg del cliente) → texto libre OK, pero PREGUNTA antes
- Chat muerto (>24h) → SOLO plantilla, INFORMA al admin
- Sin conversacion → SOLO plantilla, INFORMA al admin

=== REGLAS DE COMPORTAMIENTO ===
- NUNCA digas "no tengo acceso a los chats" o "no puedo ver las conversaciones". TU SI TIENES ACCESO. Los datos estan en la seccion INBOX WHATSAPP abajo.
- NUNCA digas "no tengo acceso en tiempo real". Tus datos se actualizan cada vez que el admin te escribe.
- Si te preguntan por un chat o conversacion, BUSCA en tus datos del INBOX antes de decir que no existe.
- Si un numero parcial coincide con algun telefono del inbox o de clientes, conectalo. Ejemplo: "424280088" puede ser parte de "584242800884".
- Cuando el admin dice "revisa los chats", revisa la seccion INBOX WHATSAPP de tus datos.
- PIENSA antes de actuar. Lee toda la informacion disponible. Informa. Pregunta. Solo entonces ejecuta.

=== FORMATO DE RESPUESTA ===
- Texto plano, corto y directo. Maximo 2-4 lineas.
- Para listas: nombre — dato clave — dato secundario (una linea por item)
- Montos en COP sin decimales: $25.000
- NO uses HTML. NO uses markdown con ** ni ##. Solo texto limpio.
- Si haces una accion, confirma en 1 linea. No repitas todos los datos del bloque.
- Puedes ejecutar MULTIPLES acciones en una sola respuesta (varios bloques ```action```).

=== DATOS ACTUALES DEL NEGOCIO ===
Fecha: {date.today().strftime('%d de %B de %Y')}

{business_context}

{inbox_summary}"""


# ============================================================================
# PROVIDER CALLS
# ============================================================================

async def _call_openai_format(url: str, api_key: str, model: str, system_prompt: str, messages: list, temperature: float, max_tokens: int):
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()

    result = response.json()
    text = result["choices"][0]["message"]["content"]
    tokens = result.get("usage", {}).get("total_tokens", 0)
    return text, tokens


async def _call_anthropic(api_key: str, model: str, system_prompt: str, messages: list, temperature: float, max_tokens: int):
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": messages,
        "temperature": temperature,
    }
    headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
        response.raise_for_status()

    result = response.json()
    text = result.get("content", [{}])[0].get("text", "")
    tokens = result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0)
    return text, tokens


async def _call_gemini(api_key: str, model: str, system_prompt: str, messages: list, temperature: float, max_tokens: int):
    """Call Google Gemini API via REST (generateContent endpoint)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    # Build contents array: system instruction + conversation history
    contents = []
    for msg in messages:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()

    result = response.json()
    text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    tokens = result.get("usageMetadata", {}).get("totalTokenCount", 0)
    return text, tokens


# ============================================================================
# AI CHAT — Main endpoint with context + action execution
# ============================================================================

ACTION_PATTERN = re.compile(r'```action\s*(.*?)```', re.DOTALL)

@router.post("/ai/chat", response_model=AIChatResponse)
async def ai_chat(data: AIChatRequest, db: Session = Depends(get_db)):
    gemini_key = os.getenv("GEMINI_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    preferred_provider = config.provider if config else "gemini"
    cfg_model = config.model if config else None
    temperature = config.temperature if config else 0.4
    max_tokens = config.max_tokens if config else 1024

    # Build ordered list of providers to try (preferred first, then fallbacks)
    providers = []

    def _add(name, key, model_name, fn):
        if key:
            providers.append({"name": name, "key": key, "model": model_name, "fn": fn})

    if preferred_provider == "groq":
        _add("groq", groq_key, cfg_model if cfg_model and "llama" in (cfg_model or "") else "llama-3.3-70b-versatile", "openai")
        _add("gemini", gemini_key, "gemini-2.0-flash", "gemini")
        _add("anthropic", anthropic_key, "claude-sonnet-4-20250514", "anthropic")
    elif preferred_provider == "gemini":
        _add("gemini", gemini_key, cfg_model if cfg_model and "gemini" in (cfg_model or "") else "gemini-2.0-flash", "gemini")
        _add("groq", groq_key, "llama-3.3-70b-versatile", "openai")
        _add("anthropic", anthropic_key, "claude-sonnet-4-20250514", "anthropic")
    elif preferred_provider == "anthropic":
        _add("anthropic", anthropic_key, cfg_model or "claude-sonnet-4-20250514", "anthropic")
        _add("gemini", gemini_key, "gemini-2.0-flash", "gemini")
        _add("groq", groq_key, "llama-3.3-70b-versatile", "openai")
    else:
        _add("gemini", gemini_key, "gemini-2.0-flash", "gemini")
        _add("groq", groq_key, "llama-3.3-70b-versatile", "openai")
        _add("anthropic", anthropic_key, "claude-sonnet-4-20250514", "anthropic")

    if not providers:
        raise HTTPException(status_code=500, detail="No hay API key configurada. Agrega GEMINI_API_KEY, GROQ_API_KEY o ANTHROPIC_API_KEY.")

    # Build system prompt with live business data
    system_prompt = _build_system_prompt(db)

    # Build messages (full conversation history for context)
    messages = []
    for msg in data.conversation_history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": data.message})

    # Try each provider with retry on 429 (rate limit)
    import asyncio
    last_error = None
    text = None
    tokens = 0

    async def _try_call(prov):
        if prov["fn"] == "gemini":
            return await _call_gemini(prov["key"], prov["model"], system_prompt, messages, temperature, max_tokens)
        elif prov["fn"] == "openai":
            return await _call_openai_format("https://api.groq.com/openai/v1/chat/completions", prov["key"], prov["model"], system_prompt, messages, temperature, max_tokens)
        else:
            return await _call_anthropic(prov["key"], prov["model"], system_prompt, messages, temperature, max_tokens)

    for prov in providers:
        for attempt in range(3):  # Up to 3 attempts per provider (with backoff on 429)
            try:
                print(f"[AI] Trying {prov['name']} ({prov['model']}) attempt {attempt + 1}")
                text, tokens = await _try_call(prov)
                print(f"[AI] Success with {prov['name']}")
                break
            except httpx.HTTPStatusError as e:
                error_body = e.response.text
                status = e.response.status_code
                print(f"[AI] {prov['name']} failed ({status}): {error_body[:200]}")
                last_error = e
                # On 429, retry same provider after delay (rate limits are per-minute)
                if status == 429 and attempt < 2:
                    wait = (attempt + 1) * 2  # 2s, 4s
                    print(f"[AI] Rate limited, waiting {wait}s before retry...")
                    await asyncio.sleep(wait)
                    continue
                break  # Non-429 error or max retries → try next provider
            except httpx.RequestError as e:
                print(f"[AI] {prov['name']} connection error: {e}")
                last_error = e
                break  # Connection error → try next provider
        if text is not None:
            break

    if text is None:
        error_body = getattr(last_error, 'response', None)
        error_text = error_body.text if error_body else str(last_error)
        if "rate_limit" in error_text.lower() or "429" in error_text:
            raise HTTPException(status_code=429, detail="Todos los proveedores de IA agotaron sus limites. Intenta mas tarde.")
        raise HTTPException(status_code=502, detail="No pude conectarme a ningun proveedor de IA. Intenta de nuevo en unos minutos.")

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

async def _call_ai(system_prompt: str, history: list, user_message: str) -> str:
    """Standalone AI call for WhatsApp auto-reply. Returns plain text response."""
    gemini_key = os.getenv("GEMINI_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    messages = list(history) + [{"role": "user", "content": user_message}]

    try:
        if gemini_key:
            text, _ = await _call_gemini(
                gemini_key, "gemini-2.0-flash",
                system_prompt, messages, 0.4, 512
            )
        elif groq_key:
            text, _ = await _call_openai_format(
                "https://api.groq.com/openai/v1/chat/completions",
                groq_key, "llama-3.3-70b-versatile",
                system_prompt, messages, 0.4, 512
            )
        elif anthropic_key:
            text, _ = await _call_anthropic(
                anthropic_key, "claude-sonnet-4-20250514",
                system_prompt, messages, 0.4, 512
            )
        else:
            return "Disculpa, no puedo responder en este momento. Contacta a Al Pelo directamente."

        return text.strip()
    except Exception as e:
        print(f"[AI Call] Error: {e}")
        return None
