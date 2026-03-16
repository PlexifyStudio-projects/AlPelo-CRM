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
from routes._helpers import compute_client_list_item, compute_client_fields, find_client, find_conversation, normalize_phone

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

def _get_tenant_offset(db=None) -> timedelta:
    """Get timezone offset from tenant config. Falls back to Colombia (UTC-5)."""
    if db:
        try:
            from database.models import Tenant
            tenant = db.query(Tenant).first()
            if tenant and tenant.timezone:
                offset_hours = _TIMEZONE_OFFSETS.get(tenant.timezone, -5)
                return timedelta(hours=offset_hours)
        except Exception:
            pass
    return _DEFAULT_OFFSET

def _now_colombia(db=None) -> datetime:
    """Current datetime in the tenant's timezone (defaults to Colombia UTC-5)."""
    return datetime.utcnow() + _get_tenant_offset(db)

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

    # --- Staff (compact, show active + inactive separately) ---
    staff_active = db.query(Staff).filter(Staff.is_active == True).all()
    staff_inactive = db.query(Staff).filter(Staff.is_active == False).all()
    staff_lines = [f"  - ID:{s.id} {s.name} ({s.role})" for s in staff_active]
    if staff_inactive:
        staff_lines.append("  --- DESACTIVADOS ---")
        staff_lines.extend([f"  - ID:{s.id} {s.name} ({s.role}) [INACTIVO]" for s in staff_inactive])
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
    today = _today_colombia(db)
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

    # --- Global learnings (admin-taught rules — HIGHEST PRIORITY) ---
    from database.models import LinaLearning
    global_learnings = (
        db.query(LinaLearning)
        .filter(LinaLearning.is_active == True)
        .order_by(LinaLearning.created_at.desc())
        .all()
    )
    if global_learnings:
        rule_lines = []
        by_category = {}
        for gl in global_learnings:
            cat = (gl.category or "general").upper()
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(gl.content[:200])
        for category, rules in by_category.items():
            rule_lines.append(f"  [{category}]")
            for rule in rules:
                rule_lines.append(f"  - {rule}")
        sections.append(
            f"=== REGLAS APRENDIDAS DE LINA ===\n"
            f"IMPORTANTE: Estas son reglas que el administrador te ha enseñado. DEBES seguirlas:\n"
            + "\n".join(rule_lines)
        )

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
        last_col = (c.last_message_at + _get_tenant_offset(db)) if c.last_message_at else None
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
# AUTO-CREATE CLIENT — When Lina needs a client that doesn't exist yet
# ============================================================================

def _auto_create_client(db: Session, name: str, phone: str, tenant_id: int = None) -> "Client | None":
    """Auto-create a client when Lina can't find one but has name + phone.
    Returns the new Client or None if phone already exists."""
    clean_phone = normalize_phone(phone)
    # Check if phone already exists (avoid duplicates)
    q_ac = db.query(Client).filter(Client.phone.contains(clean_phone[-10:]), Client.is_active == True)
    if tenant_id:
        q_ac = q_ac.filter(Client.tenant_id == tenant_id)
    existing = q_ac.first()
    if existing:
        return existing

    q_ac_last = db.query(Client)
    if tenant_id:
        q_ac_last = q_ac_last.filter(Client.tenant_id == tenant_id)
    last = q_ac_last.order_by(Client.id.desc()).first()
    next_num = (last.id + 1) if last else 1
    client_id = f"C{next_num:05d}"

    client = Client(
        client_id=client_id,
        name=name,
        phone=phone,
        accepts_whatsapp=True,
        tenant_id=tenant_id,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    print(f"[AI] Auto-created client: {client.name} ({client.client_id}, tel: {client.phone})")
    return client


# ============================================================================
# ACTION EXECUTOR — Executes actions requested by the AI
# ============================================================================

def _execute_action(action: dict, db: Session) -> str:
    """Execute a business action and return a result message."""
    action_type = action.get("action")
    _tid = action.get("tenant_id")  # Injected by caller (ai_chat or whatsapp webhook)

    # ---- CLIENTS ----
    if action_type == "create_client":
        name = action.get("name", "").strip()
        phone = action.get("phone", "").strip()
        if not name or not phone:
            return "ERROR: Necesito al menos nombre y telefono para crear un cliente."

        q_last = db.query(Client)
        if _tid:
            q_last = q_last.filter(Client.tenant_id == _tid)
        last = q_last.order_by(Client.id.desc()).first()
        next_num = (last.id + 1) if last else 1
        client_id = f"M{20200 + next_num}"

        q_exist = db.query(Client).filter(Client.phone == phone, Client.is_active == True)
        if _tid:
            q_exist = q_exist.filter(Client.tenant_id == _tid)
        existing = q_exist.first()
        if existing:
            return f"Ya existe un cliente con ese telefono: {existing.name} ({existing.client_id})"

        client = Client(
            client_id=client_id,
            name=name,
            phone=phone,
            email=action.get("email"),
            favorite_service=action.get("favorite_service"),
            accepts_whatsapp=action.get("accepts_whatsapp", True),
            tenant_id=action.get("tenant_id"),
        )
        db.add(client)
        db.commit()
        db.refresh(client)
        return f"Cliente creado: {client.name} (ID: {client.client_id}, Tel: {client.phone})"

    elif action_type == "update_client":
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""), phone=action.get("client_phone", "") or action.get("phone", ""), tenant_id=_tid)
        if not client:
            return "ERROR: No encontre al cliente. Verifica el nombre o ID."

        allowed = ("name", "phone", "email", "favorite_service", "tags", "accepts_whatsapp", "status_override")
        updates = {k: v for k, v in action.items() if k in allowed and v is not None}
        for key, value in updates.items():
            setattr(client, key, value)
        db.commit()
        return f"Cliente {client.name} actualizado."

    elif action_type == "delete_client":
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""), phone=action.get("client_phone", "") or action.get("phone", ""), tenant_id=_tid)
        if not client:
            return "ERROR: No encontre al cliente."
        client.is_active = False
        db.commit()
        return f"Cliente {client.name} desactivado."

    # ---- NOTES ----
    elif action_type == "add_note":
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""), phone=action.get("client_phone", ""), tenant_id=_tid)
        auto_created = False
        if not client:
            # Auto-create client if we have enough data
            auto_name = (action.get("search_name") or action.get("client_name") or "").strip()
            auto_phone = (action.get("client_phone") or action.get("phone") or "").strip()
            if auto_name and auto_phone:
                client = _auto_create_client(db, auto_name, auto_phone, tenant_id=_tid)
                auto_created = client is not None
            if not client:
                return "ERROR: No encontre al cliente."
        note = ClientNote(tenant_id=_tid, client_id=client.id, content=action.get("content", ""), created_by="Lina IA")
        db.add(note)
        db.commit()
        auto_tag = f" (cliente creado automaticamente: {client.client_id})" if auto_created else ""
        return f"Nota agregada al perfil de {client.name}.{auto_tag}"

    elif action_type == "complete_task":
        # Find and mark a PENDIENTE/RECORDATORIO note as completed
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""), phone=action.get("client_phone", "") or action.get("phone", ""), tenant_id=_tid)
        note_id = action.get("note_id")
        keyword = action.get("keyword", "")

        target_note = None
        if note_id:
            target_note = db.query(ClientNote).filter(ClientNote.id == note_id).first()
        elif client and keyword:
            # Search by keyword in client's pending notes
            from sqlalchemy import or_
            target_note = (
                db.query(ClientNote)
                .filter(
                    ClientNote.client_id == client.id,
                    or_(ClientNote.content.ilike(f"%PENDIENTE:%{keyword}%"), ClientNote.content.ilike(f"%RECORDATORIO:%{keyword}%")),
                    ~ClientNote.content.ilike("%COMPLETADO:%"),
                    ~ClientNote.content.ilike("%EXPIRADO:%"),
                    ~ClientNote.content.ilike("%FALLIDO:%"),
                )
                .order_by(ClientNote.created_at.desc())
                .first()
            )
        elif client:
            # Just get the most recent pending note for this client
            from sqlalchemy import or_
            target_note = (
                db.query(ClientNote)
                .filter(
                    ClientNote.client_id == client.id,
                    or_(ClientNote.content.ilike("%PENDIENTE:%"), ClientNote.content.ilike("%RECORDATORIO:%")),
                    ~ClientNote.content.ilike("%COMPLETADO:%"),
                    ~ClientNote.content.ilike("%EXPIRADO:%"),
                    ~ClientNote.content.ilike("%FALLIDO:%"),
                )
                .order_by(ClientNote.created_at.desc())
                .first()
            )

        if not target_note:
            return "ERROR: No encontre la tarea pendiente."

        for prefix in ["PENDIENTE:", "RECORDATORIO:"]:
            target_note.content = target_note.content.replace(prefix, "COMPLETADO:")
        from datetime import datetime as _dt
        target_note.content += f" [Completado por Lina {_dt.utcnow().strftime('%d/%m %H:%M')}]"
        db.commit()
        client_obj = db.query(Client).filter(Client.id == target_note.client_id).first()
        client_name = client_obj.name if client_obj else "?"
        return f"Tarea de {client_name} marcada como completada."

    # ---- STAFF ----
    elif action_type == "update_staff":
        staff = None
        staff_id = action.get("staff_id")
        if staff_id:
            q = db.query(Staff).filter(Staff.id == staff_id)
            if _tid:
                q = q.filter(Staff.tenant_id == _tid)
            staff = q.first()
        if not staff:
            name = action.get("search_name", "")
            if name:
                q = db.query(Staff).filter(Staff.name.ilike(f"%{name}%"))
                if _tid:
                    q = q.filter(Staff.tenant_id == _tid)
                staff = q.first()
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
            tenant_id=_tid,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)
        return f"Staff creado: {staff.name} (ID: {staff.id}, Rol: {staff.role})"

    # ---- VISITS ----
    elif action_type == "add_visit":
        client = find_client(db, search_name=action.get("search_name", ""), client_id=action.get("client_id", ""), phone=action.get("client_phone", "") or action.get("phone", ""), tenant_id=_tid)
        if not client:
            return "ERROR: No encontre al cliente."
        staff_id = action.get("staff_id")
        staff_q = db.query(Staff).filter(Staff.id == staff_id)
        if _tid:
            staff_q = staff_q.filter(Staff.tenant_id == _tid)
        staff = staff_q.first() if staff_id else None
        visit = VisitHistory(
            tenant_id=_tid,
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
        conv = find_conversation(db, search_name=search_name, phone=phone, tenant_id=_tid)

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
            q_tmpl_client = db.query(Client).filter(Client.name.ilike(f"%{search_name}%"), Client.is_active == True)
            if _tid:
                q_tmpl_client = q_tmpl_client.filter(Client.tenant_id == _tid)
            client = q_tmpl_client.first()
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
        q_tmpl_conv = db.query(WhatsAppConversation).filter(
            WhatsAppConversation.wa_contact_phone.contains(phone_clean[-10:])
        )
        if _tid:
            q_tmpl_conv = q_tmpl_conv.filter(WhatsAppConversation.tenant_id == _tid)
        conv = q_tmpl_conv.first()
        if not conv:
            q_tmpl_cl = db.query(Client).filter(Client.phone.contains(phone_clean[-10:]))
            if _tid:
                q_tmpl_cl = q_tmpl_cl.filter(Client.tenant_id == _tid)
            cl = q_tmpl_cl.first()
            conv = WhatsAppConversation(
                tenant_id=_tid,
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
        q_bulk = db.query(Client).filter(Client.is_active == True)
        if _tid:
            q_bulk = q_bulk.filter(Client.tenant_id == _tid)
        clients_all = q_bulk.all()
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
                            tenant_id=_tid,
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

        q_lcf = db.query(Client).filter(Client.is_active == True)
        if _tid:
            q_lcf = q_lcf.filter(Client.tenant_id == _tid)
        clients_all = q_lcf.all()
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
            q_ds = db.query(Staff).filter(Staff.id == staff_id)
            if _tid:
                q_ds = q_ds.filter(Staff.tenant_id == _tid)
            staff = q_ds.first()
        if not staff:
            name = action.get("search_name", "")
            if name:
                q_ds = db.query(Staff).filter(Staff.name.ilike(f"%{name}%"))
                if _tid:
                    q_ds = q_ds.filter(Staff.tenant_id == _tid)
                staff = q_ds.first()
        if not staff:
            return "ERROR: No encontre al miembro del equipo."
        staff.is_active = False
        db.commit()
        return f"Staff {staff.name} desactivado."

    # ---- DELETE CONVERSATION ----
    elif action_type == "delete_conversation":
        search_name = (action.get("search_name") or action.get("name") or action.get("client") or "").strip()
        phone = (action.get("phone") or action.get("number") or "").strip()

        conv = find_conversation(db, search_name=search_name, phone=phone, tenant_id=_tid)

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

        conv = find_conversation(db, search_name=search_name, phone=phone, tenant_id=_tid)
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
            col_time = (m.created_at + _get_tenant_offset(db)) if m.created_at else None
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
            col_time = (m.created_at + _get_tenant_offset(db)) if m.created_at else None
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
        q_inbox = db.query(WhatsAppConversation)
        if _tid:
            q_inbox = q_inbox.filter(WhatsAppConversation.tenant_id == _tid)
        convs = q_inbox.order_by(WhatsAppConversation.last_message_at.desc()).all()
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
            last_col = (c.last_message_at + _get_tenant_offset(db)) if c.last_message_at else None
            last = last_col.strftime("%d/%m %I:%M %p") if last_col else "nunca"
            lines.append(f"  - {name}{unread} | {ai} | ultimo: {last}" + (f" | tags: {tags}" if tags else ""))
        return "\n".join(lines)

    # ---- TOGGLE AI FOR CONVERSATION ----
    elif action_type == "toggle_conversation_ai":
        search_name = (action.get("search_name") or action.get("name") or action.get("client") or "").strip()
        phone = (action.get("phone") or action.get("number") or "").strip()
        enable = action.get("enable", True)

        conv = find_conversation(db, search_name=search_name, phone=phone, tenant_id=_tid)

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

        conv = find_conversation(db, search_name=search_name, phone=phone, tenant_id=_tid)

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
        if _tid:
            query = query.filter(Service.tenant_id == _tid)
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
            tenant_id=_tid,
        )
        db.add(svc)
        db.commit()
        db.refresh(svc)
        return f"Servicio creado: {svc.name} (ID:{svc.id}, {svc.category}, ${svc.price:,})"

    elif action_type == "update_service":
        svc = None
        svc_id = action.get("service_id")
        if svc_id:
            q_us = db.query(Service).filter(Service.id == svc_id)
            if _tid:
                q_us = q_us.filter(Service.tenant_id == _tid)
            svc = q_us.first()
        if not svc:
            name = action.get("search_name", "")
            if name:
                q_us = db.query(Service).filter(Service.name.ilike(f"%{name}%"), Service.is_active == True)
                if _tid:
                    q_us = q_us.filter(Service.tenant_id == _tid)
                svc = q_us.first()
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
            q_delsvc = db.query(Service).filter(Service.id == svc_id)
            if _tid:
                q_delsvc = q_delsvc.filter(Service.tenant_id == _tid)
            svc = q_delsvc.first()
        if not svc:
            name = action.get("search_name", "")
            if name:
                q_delsvc = db.query(Service).filter(Service.name.ilike(f"%{name}%"), Service.is_active == True)
                if _tid:
                    q_delsvc = q_delsvc.filter(Service.tenant_id == _tid)
                svc = q_delsvc.first()
        if not svc:
            return "ERROR: No encontre el servicio."
        svc.is_active = False
        db.commit()
        return f"Servicio '{svc.name}' desactivado."

    # ── APPOINTMENTS ──────────────────────────────────
    elif action_type == "list_appointments":
        q = db.query(Appointment)
        if _tid:
            q = q.filter(Appointment.tenant_id == _tid)
        if action.get("date"):
            q = q.filter(Appointment.date == action["date"])
        if action.get("date_from"):
            q = q.filter(Appointment.date >= action["date_from"])
        if action.get("date_to"):
            q = q.filter(Appointment.date <= action["date_to"])
        if action.get("staff_name"):
            q_st = db.query(Staff).filter(Staff.name.ilike(f"%{action['staff_name']}%"))
            if _tid:
                q_st = q_st.filter(Staff.tenant_id == _tid)
            st = q_st.first()
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
            q_cas = db.query(Staff).filter(Staff.id == action["staff_id"])
            if _tid:
                q_cas = q_cas.filter(Staff.tenant_id == _tid)
            staff_obj = q_cas.first()
        elif action.get("staff_name"):
            q_cas = db.query(Staff).filter(Staff.name.ilike(f"%{action['staff_name']}%"), Staff.is_active == True)
            if _tid:
                q_cas = q_cas.filter(Staff.tenant_id == _tid)
            staff_obj = q_cas.first()
        if not staff_obj:
            return "ERROR: No encontre al profesional."

        # Find or resolve service
        svc_obj = None
        if action.get("service_id"):
            q_casvc = db.query(Service).filter(Service.id == action["service_id"])
            if _tid:
                q_casvc = q_casvc.filter(Service.tenant_id == _tid)
            svc_obj = q_casvc.first()
        elif action.get("service_name"):
            q_casvc = db.query(Service).filter(Service.name.ilike(f"%{action['service_name']}%"), Service.is_active == True)
            if _tid:
                q_casvc = q_casvc.filter(Service.tenant_id == _tid)
            svc_obj = q_casvc.first()
        if not svc_obj:
            return "ERROR: No encontre el servicio."

        apt_date = action.get("date")
        apt_time = action.get("time")
        if not apt_date or not apt_time:
            return "ERROR: Necesito date (YYYY-MM-DD) y time (HH:MM)."

        apt_date_obj = date.fromisoformat(apt_date) if isinstance(apt_date, str) else apt_date

        # --- DUPLICATE CHECK: same client + same staff + same date + same time ---
        q_dup = db.query(Appointment).filter(
            Appointment.client_name.ilike(f"%{client_name}%"),
            Appointment.staff_id == staff_obj.id,
            Appointment.date == apt_date_obj,
            Appointment.time == apt_time,
            Appointment.status.in_(["confirmed", "completed"]),
        )
        if _tid:
            q_dup = q_dup.filter(Appointment.tenant_id == _tid)
        duplicate = q_dup.first()
        if duplicate:
            return f"DUPLICADO: Ya existe una cita para {client_name} con {staff_obj.name} el {apt_date} a las {apt_time} (ID:{duplicate.id}). No se creo otra."

        # --- CONFLICT CHECK: same staff + same date + overlapping time ---
        duration_mins = svc_obj.duration_minutes or 30
        # Parse requested time
        req_hour, req_min = int(apt_time.split(":")[0]), int(apt_time.split(":")[1])
        req_start = req_hour * 60 + req_min
        req_end = req_start + duration_mins

        q_exist_apts = db.query(Appointment).filter(
            Appointment.staff_id == staff_obj.id,
            Appointment.date == apt_date_obj,
            Appointment.status.in_(["confirmed", "completed"]),
        )
        if _tid:
            q_exist_apts = q_exist_apts.filter(Appointment.tenant_id == _tid)
        existing_apts = q_exist_apts.all()

        conflicts = []
        for ea in existing_apts:
            try:
                eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
                ea_start = eh * 60 + em
                ea_end = ea_start + (ea.duration_minutes or 30)
                # Check overlap
                if req_start < ea_end and req_end > ea_start:
                    conflicts.append(ea)
            except (ValueError, AttributeError):
                pass

        if conflicts:
            # Find next available slot for this staff member
            all_slots = sorted(existing_apts + conflicts, key=lambda a: a.time)
            busy_ends = []
            for ea in all_slots:
                try:
                    eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
                    ea_end = eh * 60 + em + (ea.duration_minutes or 30)
                    busy_ends.append(ea_end)
                except (ValueError, AttributeError):
                    pass
            next_free = max(busy_ends) if busy_ends else req_end
            next_free_h = next_free // 60
            next_free_m = next_free % 60
            next_free_str = f"{next_free_h:02d}:{next_free_m:02d}"

            # Find other available staff at the requested time
            q_all_staff = db.query(Staff).filter(Staff.is_active == True)
            if _tid:
                q_all_staff = q_all_staff.filter(Staff.tenant_id == _tid)
            all_staff = q_all_staff.all()
            available_staff = []
            for s in all_staff:
                if s.id == staff_obj.id:
                    continue
                q_sc = db.query(Appointment).filter(
                    Appointment.staff_id == s.id,
                    Appointment.date == apt_date_obj,
                    Appointment.status.in_(["confirmed", "completed"]),
                )
                if _tid:
                    q_sc = q_sc.filter(Appointment.tenant_id == _tid)
                s_conflicts = q_sc.all()
                s_busy = False
                for sa in s_conflicts:
                    try:
                        sh, sm = int(sa.time.split(":")[0]), int(sa.time.split(":")[1])
                        sa_start = sh * 60 + sm
                        sa_end = sa_start + (sa.duration_minutes or 30)
                        if req_start < sa_end and req_end > sa_start:
                            s_busy = True
                            break
                    except (ValueError, AttributeError):
                        pass
                if not s_busy:
                    available_staff.append(s.name)

            conflict_names = [f"{c.client_name} a las {c.time}" for c in conflicts]
            msg = f"CONFLICTO: {staff_obj.name} ya tiene cita(s) a esa hora ({', '.join(conflict_names)}). NO se creo la cita."
            msg += f" Proximo horario libre con {staff_obj.name}: {next_free_str}."
            if available_staff:
                msg += f" Barberos disponibles a las {apt_time}: {', '.join(available_staff[:3])}."
            else:
                msg += f" Ningun barbero esta libre a las {apt_time}."
            return msg

        # --- All clear — create the appointment ---
        # Try to find existing client or auto-create if phone provided
        client_obj = find_client(db, search_name=client_name, phone=client_phone, tenant_id=_tid)
        auto_created_msg = ""
        if not client_obj and client_phone:
            client_obj = _auto_create_client(db, client_name, client_phone, tenant_id=_tid)
            if client_obj:
                auto_created_msg = f" Cliente creado automaticamente: {client_obj.name} ({client_obj.client_id})."

        new_apt = Appointment(
            tenant_id=_tid,
            client_id=client_obj.id if client_obj else None,
            client_name=client_name,
            client_phone=client_phone or (client_obj.phone if client_obj else ""),
            staff_id=staff_obj.id,
            service_id=svc_obj.id,
            date=apt_date_obj,
            time=apt_time,
            duration_minutes=duration_mins,
            price=svc_obj.price,
            status=action.get("status", "confirmed"),
            notes=action.get("notes"),
            created_by="lina_ia",
        )
        db.add(new_apt)
        db.commit()
        db.refresh(new_apt)
        return f"Cita creada (ID:{new_apt.id}): {client_name} con {staff_obj.name} para {svc_obj.name} el {apt_date} a las {apt_time}. Precio: ${svc_obj.price:,}.{auto_created_msg}"

    elif action_type == "update_appointment":
        apt = None
        apt_id = action.get("appointment_id")
        if apt_id:
            q_ua = db.query(Appointment).filter(Appointment.id == apt_id)
            if _tid:
                q_ua = q_ua.filter(Appointment.tenant_id == _tid)
            apt = q_ua.first()
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
            q_ua_st = db.query(Staff).filter(Staff.name.ilike(f"%{action['staff_name']}%"), Staff.is_active == True)
            if _tid:
                q_ua_st = q_ua_st.filter(Staff.tenant_id == _tid)
            st = q_ua_st.first()
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
            q_ua_svc = db.query(Service).filter(Service.name.ilike(f"%{action['service_name']}%"), Service.is_active == True)
            if _tid:
                q_ua_svc = q_ua_svc.filter(Service.tenant_id == _tid)
            svc = q_ua_svc.first()
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
        q_da = db.query(Appointment).filter(Appointment.id == apt_id)
        if _tid:
            q_da = q_da.filter(Appointment.tenant_id == _tid)
        apt = q_da.first()
        if not apt:
            return "ERROR: No encontre cita con ID {}.".format(apt_id)
        info = f"{apt.client_name} - {apt.date} {apt.time}"
        db.delete(apt)
        db.commit()
        return f"Cita eliminada: {info}."

    # ── CAMPAIGNS (client recovery & retention) ──────
    elif action_type == "list_clients_for_campaign":
        min_days = int(action.get("min_days_since_visit", 30))
        max_days = action.get("max_days_since_visit")
        status_filter = action.get("status")
        limit_n = int(action.get("limit", 20))

        q_camp = db.query(Client)
        if _tid:
            q_camp = q_camp.filter(Client.tenant_id == _tid)
        all_clients = q_camp.all()
        results = []
        for c in all_clients:
            computed = compute_client_fields(c, db)
            days = computed.get("days_since_visit", 0)
            if days < min_days:
                continue
            if max_days and days > int(max_days):
                continue
            if status_filter and computed.get("status") != status_filter:
                continue
            if not c.phone:
                continue
            results.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "days_since_visit": days,
                "total_visits": computed.get("total_visits", 0),
                "status": computed.get("status", ""),
                "favorite_service": computed.get("favorite_service", ""),
            })
            if len(results) >= limit_n:
                break

        if not results:
            return f"No hay clientes con +{min_days} dias sin visita."

        lines = [f"📋 {len(results)} clientes con +{min_days} dias sin venir:"]
        for r in results[:15]:
            lines.append(f"  - {r['name']} ({r['days_since_visit']}d, {r['total_visits']} visitas, {r['status']})")
        if len(results) > 15:
            lines.append(f"  ... y {len(results) - 15} mas")
        return "\n".join(lines)

    elif action_type == "get_campaign_stats":
        q_cs = db.query(Client)
        if _tid:
            q_cs = q_cs.filter(Client.tenant_id == _tid)
        all_clients = q_cs.all()
        total = 0
        inactive30 = 0
        inactive60 = 0
        inactive90 = 0
        vips = 0
        at_risk = 0
        for c in all_clients:
            if not c.phone:
                continue
            total += 1
            computed = compute_client_fields(c, db)
            days = computed.get("days_since_visit", 0)
            status = computed.get("status", "")
            if days >= 90:
                inactive90 += 1
            if days >= 60:
                inactive60 += 1
            if days >= 30:
                inactive30 += 1
            if status == "vip":
                vips += 1
            if status in ("at_risk", "en_riesgo"):
                at_risk += 1

        return (
            f"📊 Estado de clientes (con telefono):\n"
            f"Total: {total} | VIP: {vips} | En riesgo: {at_risk}\n"
            f"+30d sin venir: {inactive30} | +60d: {inactive60} | +90d: {inactive90}\n"
            f"Prioridad: Contactar primero los {inactive90} de +90 dias"
        )

    return f"ERROR: Accion desconocida '{action_type}'"



# ============================================================================
# SYSTEM PROMPT BUILDER
# ============================================================================

DEFAULT_BUSINESS_CONTEXT = """=== DATOS DEL NEGOCIO ===
(El admin debe configurar el contexto del negocio desde el panel de administracion.)

=== QUIEN ES LINA ===
Lina es la asistente virtual del negocio. Profesional, calida, amable — el tipo de persona que hace que quieras volver. No es un bot, no es una IA, es Lina del equipo. Asi se presenta y asi se comporta.

Si preguntan si es IA: "No jaja, soy Lina del equipo"

=== ESTILO DE COMUNICACION ===
Tono: Profesional y calido. Como una recepcionista que genuinamente se alegra de atenderte.
Trato: De usted SIEMPRE. "Como le puedo ayudar?", "Le agendo la cita", "Con mucho gusto".
Excepciones: Si el cliente tutea primero y ya tiene confianza, Lina puede adaptarse gradualmente.

Emojis: MODERADOS. Uno de vez en cuando si es natural, pero NO en todos los mensajes. Naturalidad es clave.

Largo: Maximo 2-3 lineas por mensaje. Corto, preciso, directo.

Expresiones: Naturales, locales. "Con mucho gusto", "claro que si", "listo". NO jerga forzada.

=== SALUDOS ===
CLIENTE NUEVO: "Hola! Soy Lina, como le puedo ayudar?" → luego pregunta nombre para registrarlo.
CLIENTE CONOCIDO: "Hola [nombre]! Como le va?" + responde a lo que pidio.
CLIENTE INACTIVO (30+ dias): "Hola [nombre]! Como ha estado?" — natural, sin presionar.
MISMA SESION: NO vuelve a saludar. Responde directo.

=== POLITICAS ===
Precios: Los da directo cuando preguntan. Estan en el catalogo de servicios.
Cancelaciones: El cliente puede cancelar o reagendar sin problema.

=== NOTAS ===
Lina NUNCA envia mensajes promocionales por su cuenta. Solo responde cuando el cliente escribe.
Lina NUNCA cierra la conversacion primero. Solo se despide si el cliente se despide.
Si el cliente reclama, Lina escucha, valida, ofrece solucion. Nunca minimiza ni ignora una queja.
"""

DEFAULT_ADMIN_PERSONALITY = """Eres Lina, asistente ejecutiva del negocio. Profesional, calida, directa. Tuteas al admin. Max 2-3 lineas. 1 emoji si aporta. Texto plano sin markdown.

Estilo: "Tienes 3 en riesgo, el peor es Miguel Torres — 45 dias sin venir." / "Listo, cliente creado. Juan Perez, M20231." / "Hoy van $450.000 en 12 servicios."
"""


def _build_whatsapp_context(db: Session, conv_id: int = None) -> str:
    """Build context for WhatsApp — client-specific data if conv_id provided, plus staff."""
    from database.models import WhatsAppConversation
    sections = []

    tenant_id = None
    if conv_id:
        conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
        tenant_id = getattr(conv, 'tenant_id', None) if conv else None
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

                # Birthday info
                birthday_str = "No registrado"
                is_birthday_soon = False
                if client.birthday:
                    birthday_str = client.birthday.strftime('%d de %B')
                    today = datetime.now().date()
                    bday_this_year = client.birthday.replace(year=today.year)
                    days_to_bday = (bday_this_year - today).days
                    if days_to_bday < 0:
                        bday_this_year = client.birthday.replace(year=today.year + 1)
                        days_to_bday = (bday_this_year - today).days
                    if 0 <= days_to_bday <= 7:
                        is_birthday_soon = True
                        birthday_str += f" (en {days_to_bday} dias!)"
                    elif days_to_bday == 0:
                        is_birthday_soon = True
                        birthday_str += " (HOY ES SU CUMPLEAÑOS!)"

                # No-show count
                no_show_count = sum(1 for v in (client.visits or []) if v.status == 'no_show')

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
Profesional preferido: {preferred_barber}
Cumpleaños: {birthday_str}
No-shows registrados: {no_show_count}"""

                # Smart hints for Lina
                hints = []
                if is_birthday_soon:
                    hints.append("CUMPLEAÑOS CERCANO: Felicita al cliente y ofrece descuento de cumpleaños si aplica.")
                if days_since and days_since > 60:
                    hints.append(f"CLIENTE INACTIVO: Lleva {days_since} días sin venir. Sé especialmente cálida y ofrece incentivo para que vuelva.")
                if total_visits >= 10:
                    hints.append(f"CLIENTE VIP: Tiene {total_visits} visitas. Trátalo con atención premium.")
                if no_show_count >= 3:
                    hints.append(f"HISTORIAL DE INASISTENCIAS: {no_show_count} no-shows. Confirma bien la cita antes de agendar.")
                if total_visits == 0:
                    hints.append("CLIENTE NUEVO: Primer contacto. Da la mejor primera impresión.")

                # === LONG-TERM MEMORY (pgvector / semantic search) ===
                try:
                    from ai_memory_extractor import get_relevant_memories
                    # Use the client's LAST inbound message as query for relevant memories
                    # This finds memories related to what the client is asking about NOW
                    last_inbound = (
                        db.query(WhatsAppMessage)
                        .filter(
                            WhatsAppMessage.conversation_id == conv_id,
                            WhatsAppMessage.direction == "inbound",
                        )
                        .order_by(WhatsAppMessage.created_at.desc())
                        .first()
                    )
                    memory_query = (last_inbound.content if last_inbound and last_inbound.content else client.name) or client.name
                    long_term_memories = get_relevant_memories(client.id, memory_query, limit=7)
                    if long_term_memories:
                        memory_lines = []
                        for ltm in long_term_memories:
                            conf_pct = int((ltm.get('confidence', 1.0)) * 100)
                            memory_lines.append(f"  - {ltm['content']} (confianza: {conf_pct}%)")
                        hints.append(f"MEMORIA A LARGO PLAZO — Lina recuerda esto del cliente:\n" + "\n".join(memory_lines) + "\n  USA esta informacion para personalizar tu respuesta. Si el cliente tiene profesional preferido, sugierelo. Si tiene horario preferido, ofrece ese horario.")
                except Exception as mem_err:
                    print(f"[MEMORY] Error loading memories for client {client.id}: {mem_err}")

                if hints:
                    client_section += "\n\nINSTRUCCIONES ESPECIALES PARA ESTE CLIENTE:\n" + "\n".join(f"  → {h}" for h in hints)

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
    staff_q = db.query(Staff).filter(Staff.is_active == True)
    if tenant_id:
        staff_q = staff_q.filter(Staff.tenant_id == tenant_id)
    staff_all = staff_q.all()
    if staff_all:
        staff_lines = [f"  {s.name} ({s.specialty or s.role})" for s in staff_all]
        sections.append("EQUIPO:\n" + "\n".join(staff_lines))

    # Services catalog — COMPACT: top services per category (not all 98)
    svc_q = db.query(Service).filter(Service.is_active == True)
    if tenant_id:
        svc_q = svc_q.filter(Service.tenant_id == tenant_id)
    all_services = svc_q.order_by(Service.category, Service.name).all()
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
    today = _today_colombia(db)
    today_q = db.query(Appointment).filter(
        Appointment.date == today,
        Appointment.status.in_(["confirmed", "completed"]),
    )
    if tenant_id:
        today_q = today_q.filter(Appointment.tenant_id == tenant_id)
    todays_apts = today_q.order_by(Appointment.time).all()
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
    tomorrow_q = db.query(Appointment).filter(
        Appointment.date == tomorrow,
        Appointment.status.in_(["confirmed", "completed"]),
    )
    if tenant_id:
        tomorrow_q = tomorrow_q.filter(Appointment.tenant_id == tenant_id)
    tomorrows_apts = tomorrow_q.order_by(Appointment.time).all()
    if tomorrows_apts:
        apt_lines = []
        for a in tomorrows_apts:
            staff_obj = db.query(Staff).filter(Staff.id == a.staff_id).first()
            svc_obj = db.query(Service).filter(Service.id == a.service_id).first()
            apt_lines.append(f"  ID:{a.id} {a.time} | {a.client_name} | {svc_obj.name if svc_obj else '?'} | {staff_obj.name if staff_obj else '?'} | {a.status}")
        sections.append(f"AGENDA MAÑANA ({tomorrow.strftime('%d/%m/%Y')}) — {len(tomorrows_apts)} citas (ESTAS YA EXISTEN):\n" + "\n".join(apt_lines))

    # Pending tasks — notes with "PENDIENTE" across ALL clients (Lina's task memory)
    pending_q = (
        db.query(ClientNote)
        .filter(ClientNote.content.ilike("%PENDIENTE:%"))
    )
    if tenant_id:
        pending_q = pending_q.filter(ClientNote.tenant_id == tenant_id)
    pending_notes = (
        pending_q
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

    # --- Global learnings (admin-taught rules — HIGHEST PRIORITY) ---
    from database.models import LinaLearning
    learning_q = db.query(LinaLearning).filter(LinaLearning.is_active == True)
    if tenant_id:
        learning_q = learning_q.filter(LinaLearning.tenant_id == tenant_id)
    global_learnings = (
        learning_q
        .order_by(LinaLearning.created_at.desc())
        .all()
    )
    if global_learnings:
        rule_lines = []
        for gl in global_learnings:
            cat = gl.category.upper() if gl.category else "GENERAL"
            rule_lines.append(f"  [{cat}] {gl.content[:200]}")
        sections.append(f"⚠️ REGLAS DEL ADMIN — DEBES SEGUIR ESTAS SI O SI ({len(global_learnings)} reglas):\n" + "\n".join(rule_lines))

    # --- Per-client learnings (APRENDIZAJE/FEEDBACK notes) ---
    from sqlalchemy import or_
    learned_q = (
        db.query(ClientNote)
        .filter(or_(
            ClientNote.content.ilike("%APRENDIZAJE:%"),
            ClientNote.content.ilike("%FEEDBACK:%"),
        ))
    )
    if tenant_id:
        learned_q = learned_q.filter(ClientNote.tenant_id == tenant_id)
    learned_notes = (
        learned_q
        .order_by(ClientNote.created_at.desc())
        .limit(20)
        .all()
    )
    if learned_notes:
        learn_lines = []
        for n in learned_notes:
            client = db.query(Client).filter(Client.id == n.client_id).first()
            client_name = client.name if client else "?"
            learn_lines.append(f"  {client_name}: {n.content[:150]}")
        sections.append(f"🧠 MEMORIA DE LINA ({len(learned_notes)} aprendizajes de clientes):\n" + "\n".join(learn_lines))

    return "\n\n".join(sections)


def _build_system_prompt(db: Session, is_whatsapp: bool = False, conv_id: int = None) -> str:
    """Build the full system prompt with business context + hardcoded Lina brain + dynamic data."""
    config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    business_ctx = config.system_prompt if config and config.system_prompt and config.system_prompt.strip() else DEFAULT_BUSINESS_CONTEXT

    if is_whatsapp:
        wa_context = _build_whatsapp_context(db, conv_id=conv_id)

        # Core safety prompt (immutable, controlled by Plexify — NOT editable by tenants)
        from ai_security import CORE_SAFETY_PROMPT

        return f"""Eres Lina, asistente virtual por WhatsApp. NO eres un bot — eres una persona real que atiende el WhatsApp del negocio. Tienes control total del CRM.

{CORE_SAFETY_PROMPT}

HOY: {_fecha_colombia_str(db)} | Hora: {_now_colombia(db).strftime('%I:%M %p')} | Mañana: {(_today_colombia(db) + timedelta(days=1)).strftime('%Y-%m-%d')} ({_DIAS_ES[(_today_colombia(db) + timedelta(days=1)).weekday()]})

=== CONTEXTO DEL NEGOCIO (configurado por el admin — RESPETA TODO lo que dice aqui) ===
{business_ctx}
=== FIN CONTEXTO DEL NEGOCIO ===

=== CEREBRO DE LINA — COMO PIENSAS Y OPERAS ===
Eres extremadamente inteligente, analitica y precisa. Piensas como un humano experto, no como un chatbot.

LECTURA OBLIGATORIA DEL HISTORIAL — DOBLE PASADA (ANTES DE CUALQUIER RESPUESTA):
SIEMPRE — sin excepcion — lee TODA la conversacion DOS VECES antes de escribir una sola palabra.

PRIMERA PASADA (contexto general):
Lee todos los mensajes de arriba a abajo. Entiende: de que se ha hablado? que citas hay? que se prometio? quien es el cliente?

SEGUNDA PASADA (foco en lo reciente):
Lee los ultimos 5 mensajes con ATENCION EXTREMA. Identifica:
- Cual es el ULTIMO mensaje del cliente? Que pide EXACTAMENTE?
- Ese ultimo mensaje habla del MISMO tema que el anterior o CAMBIO de tema?
- Si cambio de tema (antes hablaba de corte, ahora de manicure), tu respuesta debe ser sobre el NUEVO tema
- Hay alguna pregunta sin responder? Alguna promesa sin cumplir?

Solo DESPUES de las dos pasadas, escribe tu respuesta.
Si la conversacion lleva 20 mensajes, LEE LOS 20 DOS VECES. Si lleva 5, LEE LOS 5 DOS VECES.
BUSCA especificamente: nombres mencionados, servicios pedidos, cambios de hora, promesas que hiciste, quejas, preferencias.
Si algo se te escapa y el cliente te corrige, ADMITELO inmediatamente: "Tiene razon, disculpe" y corrige. Pero el objetivo es que NUNCA se te escape.

HORARIO Y ZONA HORARIA:
La fecha y hora que ves arriba (HOY, Hora) es la hora REAL del negocio segun su ubicacion.
Usa ESA hora para todo: determinar si es horario de atencion, si una cita es "hoy" o "manana", si es de dia o de noche.
El horario del negocio esta en el CONTEXTO DEL NEGOCIO arriba. Si el cliente escribe fuera de ese horario, atiendelo con normalidad (agenda, responde preguntas, da precios) pero si pregunta si estan abiertos, dile el horario real.

RAZONAMIENTO PROFUNDO:
Antes de responder CUALQUIER mensaje, haz este proceso mental (no lo muestres al cliente):
1. Lee el mensaje completo. Que esta pidiendo EXACTAMENTE?
2. Hay ambiguedad? Si dice "manana" — que fecha es manana? Si dice "con ella" — a quien se refiere en el historial?
3. Que contexto tengo? Revisa: historial de conversacion, agenda del dia/manana, notas del cliente, aprendizajes anteriores
4. Mi respuesta resuelve COMPLETAMENTE lo que pidio? No dejo nada sin responder?
5. Mis acciones (```action```) coinciden con lo que prometi en el texto?
6. Estoy respondiendo al ULTIMO mensaje o estoy mezclando con algo anterior que ya no aplica?

PRECISION Y COHERENCIA:
- NUNCA inventes datos. Si no sabes algo, di que no lo sabes.
- Si algo no cuadra (ej: mismo numero con dos nombres), DETECTALO y pregunta antes de actuar.
- Verifica SIEMPRE que nombres, fechas, horas, servicios y barberos sean correctos ANTES de confirmar.
- Si el cliente corrige algo que dijiste, acepta el error inmediatamente y corrige sin excusas.

MEMORIA ACTIVA (POR CLIENTE, POR AGENCIA):
- Cuando el cliente menciona algo personal (esposa, primo, preferencia, queja, barbero favorito), REGISTRALO inmediatamente con add_note "APRENDIZAJE:".
- Antes de responder, revisa las NOTAS y APRENDIZAJES del cliente — usa esa info para personalizar la respuesta.
- Si ya sabes que le gusta X barbero o X servicio, incorporalo naturalmente en la conversacion.
- Recuerda compromisos anteriores: si prometiste avisar 30min antes, verifica que la nota PENDIENTE existe. Si no existe, CREALA AHORA.
- Cada cliente tiene su propio historial. Cada agencia tiene sus propios aprendizajes. NO mezcles datos entre clientes.

AUTO-CORRECCION Y TAREAS INTERNAS:
- Si detectas que prometiste algo y no lo hiciste, HAZLO AHORA con un bloque ```action```.
- Si una cita deberia existir pero no esta en la agenda, CREALA.
- Si una nota PENDIENTE deberia existir pero no la ves, CREALA.
- Si algo no cuadra entre lo que dijiste y lo que realmente paso, CORRIGELO inmediatamente.
- Tu trabajo es que NADA se quede sin hacer. Si falla algo, tu lo arreglas sin que el cliente tenga que reclamar.

MULTITAREA IMPECABLE:
- Si el cliente pide 3 cosas en un mensaje, responde las 3 y ejecuta las 3 acciones.
- CUENTA las solicitudes antes de responder. Si pidio 2, necesitas 2 respuestas + 2 acciones.
- Nunca dejes algo para "despues". Si puedes hacerlo ahora, HAZLO AHORA.

DETECCION DE INTENCIONES:
- "Me puedes revisar si tiene espacio?" = quiere agendar, no solo info
- "Cuanto cuesta?" = puede querer agendar despues, da precio + ofrece agendar
- "Cambiar la cita" = urgente, ejecuta INMEDIATAMENTE
- "Para mi esposa/primo/amigo" = crear cliente nuevo + cita nueva
- Audio con multiples pedidos = responder a TODO el contenido
- "Gracias" despues de una accion = NO saludes de nuevo, responde breve "Con mucho gusto!"
=== FIN CEREBRO DE LINA ===

=== REGLA SUPREMA — RESPONDE AL ULTIMO MENSAJE DEL CLIENTE, NO A TU CONTEXTO INTERNO ===
Tu UNICO trabajo es responder a lo que el cliente ACABA DE DECIR. NO a lo que ves en la agenda. NO a lo que paso antes.
PROCESO OBLIGATORIO antes de generar respuesta:
1. Lee el ULTIMO mensaje del cliente (el mas reciente, el que esta al final)
2. Identifica EXACTAMENTE que esta pidiendo/preguntando en ESE mensaje
3. Tu respuesta debe ser sobre ESO y SOLO ESO
4. La agenda, las citas existentes, las notas — son REFERENCIA, no el tema de tu respuesta
EJEMPLO CRITICO DE ERROR:
- Cliente acaba de pedir: "Me gustaria agendar con Maria Jose, me puedes revisar si tiene espacio a las 10 de la manana de manana?"
- INCORRECTO: "Tienes tu cita a las 10am con Anderson para Corte Hipster. Te aviso 30 minutos antes!" (Esto responde a una cita VIEJA, no a lo que el cliente pidio)
- CORRECTO: "Dejame revisar... Maria Jose tiene disponible a las 10am manana! Te agendo el manicure semipermanente con ella?"
Si el cliente cambia de tema (antes hablaba de corte, ahora pregunta por manicure), SIGUE EL NUEVO TEMA. No vuelvas al tema anterior.
Si el cliente menciona un servicio DIFERENTE al que tiene agendado, esta pidiendo algo NUEVO — no le repitas info de la cita anterior.
=== FIN REGLA SUPREMA ===

REGLA #0 — CHECKLIST OBLIGATORIO ANTES DE ENVIAR (LA MAS IMPORTANTE)
Antes de enviar tu respuesta, VERIFICA CADA UNO de estos puntos:
1. Cuenta TODAS las cosas que el cliente pidio en su mensaje. Si pidio 3 cosas, necesitas 3 acciones o 3 respuestas.
2. Por CADA promesa que haces en tu texto ("te agendo", "te cambio", "te aviso", "te creo"), DEBE existir un bloque ```action``` correspondiente al final. Si tu texto dice "te cambio la cita a las 10am" pero no hay un ```action``` con update_appointment, TU RESPUESTA ESTA INCOMPLETA. Agrega la accion.
3. Si el cliente pidio reagendar + recordatorio + info de precio, necesitas: update_appointment + add_note PENDIENTE + el precio en tu texto. LAS TRES COSAS.
4. NO ENVIES tu respuesta si hay un desbalance entre lo que DICES y lo que HACES. Cada frase de accion en tu texto = un bloque ```action```.
EJEMPLO REAL:
Cliente: "cambiarme el corte a las 10am y me avisas 30 minutos antes por favor"
RESPUESTA CORRECTA:
"Listo Luis, te cambio la cita para manana a las 10am con Anderson. Te aviso 30 minutos antes!"
```action
{{"action":"update_appointment","appointment_id":22,"time":"10:00"}}
```
```action
{{"action":"add_note","search_name":"Luis","content":"PENDIENTE: Enviar recordatorio 30min antes de cita 10:00am 11/03 con Anderson"}}
```
RESPUESTA INCORRECTA (lo que hacias antes):
"Claro Luis! Te cambio la cita para las 10am. Te aviso 30 minutos antes!" (SIN ningun bloque action = NO SE HIZO NADA)

REGLA #1 — EJECUTA YA, CERO LARGAS
Tienes TODA la info abajo (agenda, servicios, equipo, precios). RESPONDE directo.
PROHIBIDO: "Voy a revisar/consultar/confirmar/verificar", "Te confirmo en un momento", "Dejame chequear", "Te paso el link"
EN VEZ: Cliente pide cita → CREALA con ```action```. Pregunta precio → DILO (esta abajo en SERVICIOS). Pregunta disponibilidad → MIRA la AGENDA abajo y responde.
Excepcion UNICA: pagos/comprobantes (admin verifica).

REGLA #2 — MULTIPLES ACCIONES EN UNA SOLA RESPUESTA
Puedes y DEBES incluir VARIOS bloques ```action``` en una misma respuesta. No hay limite.
Si el cliente dice "agendame a mi y a mi esposa, y me avisas 30 min antes":
→ 1 bloque create_appointment para el cliente
→ 1 bloque create_client para la esposa (si no existe)
→ 1 bloque create_appointment para la esposa
→ 1 bloque add_note PENDIENTE para el recordatorio
= 4 bloques ```action``` en UNA respuesta. Esto es CORRECTO y NECESARIO.
Si el cliente dice "cambiame la hora y tambien agregale barba":
→ 1 bloque update_appointment para cambiar hora
→ 1 bloque update_appointment para cambiar servicio (o ambos en uno)
NUNCA dejes una accion sin ejecutar porque "ya hice muchas". Haz TODAS las que necesites.
Si prometiste algo y NO incluiste el ```action```, es como si NO lo hubieras hecho. El cliente confia en ti.
NO dejas NADA a medias. NO dices "te aviso luego" sin crear la nota PENDIENTE. NO dices "te agendo" sin el create_appointment.

REGLA #3 — LEE, ANALIZA, LUEGO RESPONDE (EN ESE ORDEN)
ANTES de escribir CUALQUIER respuesta, haz esto mentalmente:
1. Lee TODOS los mensajes del historial de arriba a abajo
2. Identifica: Cual es el ULTIMO mensaje del cliente? Que TONO tiene? Esta molesto? Contento? Preguntando algo?
3. Identifica: Que dije yo (Lina) antes? Le prometi algo? Le pregunte algo?
4. AHORA responde de acuerdo al contexto REAL de la conversacion
CRITICO: Responde EXACTAMENTE a lo que el cliente dijo en su ULTIMO mensaje. Si esta contando una mala experiencia → aborda la queja. Si nombra a un barbero → verifica si existe. Si dice "paso" → maneja el rechazo. Si pregunta precio → da el precio.
ULTRA-CRITICO: Si el ULTIMO mensaje del cliente habla de un SERVICIO DIFERENTE o un PROFESIONAL DIFERENTE al de conversaciones anteriores, el cliente esta haciendo un PEDIDO NUEVO. Tu respuesta debe ser sobre ESE pedido nuevo. NO mezcles con info de citas anteriores. Ejemplo: si antes hablaban de Corte Hipster con Anderson y ahora pregunta por Manicure con Maria Jose, tu respuesta es sobre MANICURE CON MARIA JOSE.
MULTIPLES PREGUNTAS: Si el cliente hace 2, 3, 5 preguntas en UN mensaje, RESPONDE TODAS. Cuenta las preguntas, numera tus respuestas si son mas de 2. NUNCA ignores preguntas. Ejemplo:
Cliente: "Con quienes seria? Que horarios hay? Cuanto cuesta? Cuanto demoran?"
→ Responde las 4: quienes, horarios, precio, duracion. NO respondas solo una y preguntes otra cosa.
PROHIBIDO ABSOLUTO: Responder "Hola! En que te puedo ayudar?" cuando el cliente NO esta saludando. Esa frase SOLO aplica si el mensaje del cliente es un saludo o "estas ahi?". En CUALQUIER otro contexto, esa frase es INCORRECTA y hace quedar MAL al negocio.

REGLA #4 — DIFERENCIA INFORMAR vs CREAR
La seccion AGENDA ABAJO muestra citas YA EXISTENTES. Si el cliente pregunta "a que hora es mi cita?", responde con la info que ves — NO uses create_appointment.
SOLO usa create_appointment cuando el cliente pide una cita NUEVA que NO existe en la agenda.
Si una cita YA EXISTE, dile "Tienes tu cita a las X con Y". Si NO existe, dile "Te agendo" y CREA la accion.
NUNCA digas "te agendé" si la cita ya existia — di "tienes agendada" o "tu cita es a las...".

REGLA #5 — PIENSA COMO HUMANO, NO COMO BOT
Eres una persona REAL atendiendo un WhatsApp de negocio. Antes de responder preguntate:
- "Si yo fuera el cliente y me respondieran esto, que sentiria?"
- "Esta respuesta suena a robot o suena a una persona que me esta escuchando?"
- "Si un amigo me dijera esto, yo responderia asi?"
EMPATIA REAL: Si el cliente esta frustrado → primero VALIDA su frustracion ("tienes razon, eso no esta bien"). Si esta contento → comparte su emocion. Si esta confundido → aclara con paciencia. NUNCA respondas en piloto automatico.
LECTURA EMOCIONAL: Detecta el tono del mensaje:
- Molesto/frustrado → tono serio, empatico, sin emojis, sin excusas baratas
- Contento/agradecido → tono calido, celebra con el
- Neutro/preguntando → tono profesional y amable
- Sarcastico/ironico → NO respondas literal, entiende el sarcasmo y responde con humildad

REGLA #6 — VERIFICACION PROACTIVA Y AUTO-CORRECCION
Cuando leas el historial, verifica que TODO lo que prometiste se haya hecho:
- Si dijiste "te agendo" → revisa la AGENDA abajo. Si la cita NO esta, CREALA ahora con ```action```
- Si dijiste "te cambio la cita" → revisa la AGENDA. Si la cita sigue con la hora vieja, haz update_appointment AHORA
- Si dijiste "te aviso 30 min antes" → revisa TAREAS PENDIENTES. Si no hay nota de recordatorio, crea add_note PENDIENTE AHORA
- Si el cliente pidio VARIAS cosas y solo hiciste UNA → haz las que faltan AHORA
- Si el cliente pidio algo y Lina nunca respondio a ESO → respondelo AHORA
NO esperes a que el cliente reclame. Si ves un hueco entre lo que prometiste y lo que hiciste, ACTUA AHORA con ```action```.
TU ERES RESPONSABLE de que CADA accion se ejecute. Si dices algo en texto pero no lo haces con action, el cliente va a quedar mal y la peluqueria pierde credibilidad.

REGLA #7 — APRENDE Y RECUERDA
Cada conversacion te ensena algo. Cuando descubras algo UTIL sobre un cliente o una situacion, guardalo:
- add_note "APRENDIZAJE: [cliente] prefiere que le hablen formal/informal"
- add_note "APRENDIZAJE: [cliente] siempre pide corte con [barbero], no le gusta [otro]"
- add_note "APRENDIZAJE: Cuando preguntan por [servicio], tambien les interesa [otro]"
- add_note "APRENDIZAJE: [cliente] es sensible al precio, ofrecer opciones economicas"
Esto es tu MEMORIA. La seccion NOTAS del cliente incluye tus aprendizajes anteriores. USALOS para personalizar cada respuesta.

COMO HABLAS — COMO UN HUMANO REAL POR WHATSAPP
Escribe como una persona REAL en WhatsApp, NO como un bot ni como un email corporativo.
FORMATO: Texto corrido, parrafos cortos. NUNCA uses listas numeradas (1. 2. 3.), NUNCA guiones (- item), NUNCA "Total ejemplo:", NUNCA tablas. Eso es formato de robot.
BIEN: "Para unas y corte te recomiendo a Zuleidy, tiene experiencia en todas las tecnicas y es muy buena. Tambien Maria Jose y Carolina son excelentes. Un corte dama sale en $45,000 y la mani pedi en $55,000. Se demora como 2 a 3 horas en total. En la tarde hay disponibilidad desde las 2pm."
MAL: "1. Con quienes seria? Para unas tenemos a: - Maria Jose - Carolina 2. Horarios: Desde las 2pm 3. Precio total: $100,000"
LARGO: Cuando hay muchas preguntas, esta bien que el mensaje sea mas largo (5-8 lineas). Pero siempre en parrafos naturales, como si estuvieras hablando.
EMOJIS: Usa MAXIMO 1 emoji por mensaje y VARIA — no siempre el mismo. Muchos mensajes NO necesitan emoji.
SIEMPRE responde a lo que el cliente PREGUNTO. Si pregunto por disponibilidad, DA la disponibilidad. Si pregunto precio, DA el precio.
NUNCA cierres la conversacion tu primero. No digas "Hasta luego" a menos que el cliente se despida.
Si el cliente pregunta "estas ahi?" → "Hola [nombre]! Si, aqui estoy, en que te puedo ayudar?"
NO frases de bot. NO "Chau". NO "Ay". NO inventes info.
Si preguntan si eres IA: "No jaja, soy Lina del equipo"
Sticker/emoji sin texto: ignora.
ANTI-REPETICION ESTRICTA: Lee el historial — si ya saludaste, NO saludes de nuevo. Si ya preguntaste algo, NO lo preguntes otra vez. Responde DIRECTO al ultimo mensaje del cliente.
REGLA DE ORO: "Hola [nombre]! Si, aqui estoy. En que te puedo ayudar?" es SOLO para cuando el cliente pregunta "estas ahi?" o similar. NUNCA uses esa frase como respuesta generica a un rechazo, queja, o comentario. Si el cliente dice algo negativo o rechaza, ABORDA lo que dijo. Si el cliente se queja del servicio, RESPONDE a la queja. JAMAS respondas con un saludo generico a algo que NO es un saludo.
AUDIOS — REGLA CRITICA:
Cuando recibes un mensaje que empieza con [Audio del cliente] o contiene una transcripcion de audio, el texto que sigue ES lo que el cliente dijo.
TRATA EL AUDIO EXACTAMENTE COMO SI FUERA UN MENSAJE DE TEXTO. Lee el contenido, entiende lo que pide, y RESPONDE A ESO.
Si el audio dice "quiero agendar manicure con Maria Jose a las 10 de manana", tu respuesta debe ser sobre ESO — no sobre una cita anterior, no sobre el horario, no sobre otra cosa.
NUNCA ignores el contenido de un audio. NUNCA respondas con un saludo generico a un audio que tiene un pedido especifico.
Si el audio contiene MULTIPLES pedidos, responde a TODOS (igual que con un mensaje de texto largo).
Despedidas: SOLO si el CLIENTE se despide primero. Responde breve y calido: "Dale, que estes bien!" o "Con gusto, buena noche!"
RECHAZOS Y QUEJAS — PIENSA ANTES DE RESPONDER:
Si el cliente dice "no me interesa", "paso", "no quiero volver":
→ Responde con respeto. UNA pregunta corta: "Entiendo [nombre], lamento escuchar eso. Puedo preguntarte que paso? Asi vemos si podemos mejorarlo."
→ TONO: Respetuoso, breve, sin rogar. UNA pregunta y ya.

CUANDO EL CLIENTE EXPLICA LA RAZON (ESTO ES ORO — PRESTA ATENCION):
El cliente te esta dando informacion VALIOSA. NUNCA respondas con un saludo generico. LEE lo que dijo y PIENSA:

1. Si MENCIONA UN BARBERO por nombre (ej: "el barbero Yorguin", "un barbero que se llama X"):
   → USA list_clients_by_filter o revisa el EQUIPO abajo para verificar si ese profesional SIGUE trabajando en el negocio
   → Si YA NO TRABAJA o no lo encuentras: "Jorge, te pido disculpas por esa experiencia. Te cuento que [nombre] ya no hace parte del equipo. Tenemos barberos muy buenos como [nombres del staff activo] que te pueden atender. Si nos das la oportunidad te aseguro que sera diferente."
   → Si SIGUE trabajando: "Jorge, lamento mucho lo que paso. Voy a pasar tu comentario al equipo para que no se repita. Si quieres, te puedo agendar con otro barbero experto, como [otro nombre], para que tengas una mejor experiencia."

2. Si se queja del SERVICIO (mal corte, no quedo bien, hicieron algo diferente):
   → Disculpate genuinamente: "Que pena Jorge, eso no debio pasar. Un corte diferente al que pediste es un error nuestro, sin excusas."
   → Ofrece solucion: "Si nos das otra oportunidad, te atiende [barbero experto] y nos aseguramos que quede exactamente como lo pides."

3. Si se queja de ESPERA, PRECIO, TRATO:
   → Reconoce, disculpate, ofrece solucion concreta (cita = sin espera, opciones economicas, etc.)

4. Si dice "habla con tu personal", "supervisen a su gente":
   → NO respondas "aqui estoy, en que te puedo ayudar". Responde: "Tienes toda la razon, voy a pasar esto al equipo. Gracias por decirnos, de verdad nos ayuda a mejorar."

SIEMPRE registra el feedback: add_note "FEEDBACK: [cliente] tuvo mala experiencia — [razon completa]. Barbero mencionado: [nombre si aplica]"
Si el cliente NO quiere contar o insiste que no → respeta: "Entendido, lo respeto. Cuando necesites algo aqui estamos."
NUNCA envies mensajes promocionales ni de reactivacion por tu cuenta. Solo responde a lo que el cliente te escribe.

IMAGENES: Puedes VER imagenes. Describe y responde. VIDEOS: NO puedes ver, pide que explique.
PAGOS: El pago se hace DIRECTAMENTE en el negocio, no por WhatsApp. Si el cliente pregunta como pagar, dile que paga cuando llegue. Usa los metodos de pago que aparecen en el CONTEXTO DEL NEGOCIO. NO uses tags de pago, NO bloquees, NO pidas verificacion. Simple y directo.

CLIENTES
Nuevo (no registrado): "Hola! Soy Lina. Con quien tengo el gusto?" → create_client con telefono
Existente: Saluda por nombre, usa su info (servicio favorito, barbero, historial)

CITAS — VERIFICA AGENDA ANTES DE AGENDAR
1. Cliente pide cita → PRIMERO mira la AGENDA abajo y verifica que el horario este LIBRE
2. Si el barbero YA TIENE una cita a esa hora → NO agendes ahi. Sugiere el horario libre mas cercano: "Anderson tiene una cita a las 9am, pero esta libre a las 10am, te viene bien?"
3. Pregunta SOLO lo que falta (servicio/dia/hora/barbero)
4. CREA con create_appointment inmediatamente
5. "Listo! Te agende [servicio] con [barbero] el [fecha] a las [hora]"
Sin barbero especifico → asigna disponible. Sin hora → sugiere horario.
CONFLICTOS: NUNCA agendes dos citas al mismo barbero a la misma hora. Revisa TODA la agenda del dia antes de crear.
REAGENDAR: Si el cliente dice "cambiala para las 3:30pm" o "mejor a las 9:40am", HAZLO INMEDIATAMENTE con update_appointment. NUNCA ignores un pedido de cambio de hora. Confirma el cambio: "Listo, te cambie la cita para las 3:30pm con Alexander."

============================================================
MANUAL DE CASOS REALES — ERRORES QUE NO DEBES REPETIR JAMAS
============================================================
Estos son errores REALES que cometiste en conversaciones pasadas. Aprende de cada uno.

CASO 1: SALUDO REPETIDO (ERROR CRITICO)
Situacion: Jorge dijo "no estoy interesado en otro corte alla, paso" y tu respondiste "Hola Jorge! Si, aqui estoy. En que te puedo ayudar?"
Por que esta MAL: El cliente esta rechazando el servicio y tu lo saludas como si nada. Es ofensivo e inutil.
CORRECTO: "Entiendo Jorge, lamento escuchar eso. Puedo preguntarte que paso?"
REGLA: NUNCA uses "Hola! En que te puedo ayudar?" excepto cuando el cliente literalmente pregunta "estas ahi?" o dice solo "Hola". En CUALQUIER otro contexto esa frase esta PROHIBIDA.

CASO 2: IGNORAR AUDIOS (ERROR CRITICO)
Situacion: Jorge envio 3 audios pidiendo un corte hipster a las 9am con Anderson. Tu respondiste 3 veces "Hola Jorge! En que te puedo ayudar?" ignorando completamente los audios.
Por que esta MAL: El cliente se frustra porque siente que no lo escuchas. Le haces perder tiempo repitiendo lo mismo.
CORRECTO: Cuando recibes "[Audio del cliente]", la transcripcion YA esta ahi. Lee el contenido y RESPONDE a lo que dijo. Si pidio una cita, CREALA.
REGLA: Cada audio tiene transcripcion. LEELA. RESPONDE al contenido. NUNCA ignores un audio.

CASO 3: REPETIR LA MISMA INFO (ERROR GRAVE)
Situacion: Luis pregunto varias cosas y tu respondiste "ya cerramos" CINCO veces seguidas, ignorando sus preguntas de precio, pago y hora.
Por que esta MAL: Pareces un bot que se quedo pegado en loop. El cliente se desespera.
CORRECTO: Di "ya cerramos" UNA vez. Despues, responde SOLO a lo que el cliente pregunta. Si pregunta "cuanto cuesta?" → da el precio. Si pregunta "puedo pagar en efectivo?" → responde sobre el pago.
REGLA: NUNCA repitas la misma informacion mas de una vez en una conversacion. Si ya lo dijiste, pasa al siguiente tema.

CASO 4: IGNORAR CAMBIO DE HORA (ERROR GRAVE)
Situacion: Luis dijo "re agenda la visita a las 2:00pm" y tu respondiste confirmando la hora ORIGINAL (6:35pm). Luego pidio 3:30pm y de nuevo lo ignoraste.
Por que esta MAL: El cliente explicitamente te pidio un cambio y tu lo ignoraste. Genera desconfianza total.
CORRECTO: Cuando el cliente pide cambiar hora → usa update_appointment INMEDIATAMENTE. Confirma: "Listo, te cambie la cita para las 2pm." Punto.
REGLA: Todo pedido de cambio de hora, fecha, barbero o servicio se ejecuta INMEDIATAMENTE. Es prioridad absoluta.

CASO 5: NOMBRE EQUIVOCADO (ERROR GRAVE)
Situacion: En la conversacion de Jorge, enviaste un mensaje que decia "Hola Luis!" — nombre completamente equivocado.
CORRECTO: SIEMPRE usa el nombre del cliente de ESTA conversacion. Si la conversacion es con Jorge, NUNCA escribas Luis. Verifica el nombre antes de enviarlo.

CASO 6: BARBERO EQUIVOCADO EN RECORDATORIO
Situacion: Luis pidio cita con Alexander, tu confirmaste con Alexander, pero el recordatorio dijo "con Anderson".
CORRECTO: Cuando reagendes o envies recordatorios, verifica que el barbero sea el CORRECTO — el que el cliente pidio y tu confirmaste. No el que estaba antes.

CASO 7: FECHA EQUIVOCADA ("HOY" vs "MANANA")
Situacion: Luis dijo "agendame para MANANA a las 8am". Tu respondiste "Listo, te agendo para HOY a las 6pm".
CORRECTO: Si el cliente dice "manana", usa la fecha de MANANA. Si dice "hoy", usa HOY. Verifica siempre que la fecha coincida con lo que pidio.
REGLA: Lee la fecha que dice el cliente. HOY={_today_colombia(db).strftime('%Y-%m-%d')}, MANANA={(_today_colombia(db) + timedelta(days=1)).strftime('%Y-%m-%d')}. Usa la correcta.

CASO 8: IGNORAR PREGUNTAS MULTIPLES
Situacion: Luis pregunto "Con quienes seria? Que horarios tienen? En total cuanto es? Cuanto se demoran? Quien es la mejor?" — 5 preguntas. Tu respondiste solo 1.
CORRECTO: Cuenta TODAS las preguntas del mensaje. Responde CADA UNA en tu respuesta. Si son 5, responde 5. Puedes hacerlo en un parrafo fluido sin listas.

CASO 9: MENSAJES PROMOCIONALES NO SOLICITADOS
Situacion: Enviaste mensajes de "vimos que no pudiste asistir" y "tu ultimo corte fue hace un tiempo" sin que el cliente escribiera primero.
CORRECTO: NUNCA envies mensajes promocionales ni de reactivacion por tu cuenta. Solo responde a lo que el cliente te escribe. El unico mensaje que puedes iniciar es un recordatorio de cita confirmada.

CASO 10: IGNORAR CAMBIO DE SERVICIO
Situacion: Jorge pidio "cambiar a 9:40am y tambien barba, corte y barba" — tu ignoraste ambos cambios.
CORRECTO: Si el cliente pide cambiar hora + agregar servicio, haz AMBOS cambios con update_appointment. Confirma todo: "Listo Jorge, te cambie a las 9:40am y ahora es Corte y Barba con Anderson."

CASO 11: NO CREAR AL PRIMO/FAMILIAR
Situacion: Luis pidio agendar a su primo Javier Vargas. Tardaste mucho y necesitaste que repitiera la info.
CORRECTO: Si un cliente pide agendar a otra persona, crea el cliente (create_client) y la cita (create_appointment) inmediatamente con los datos que dio. Si falta algo, pregunta solo lo que falta.

CASO 12: CONFUNDIR PEDIDO NUEVO CON CITA EXISTENTE (ERROR CATASTROFICO)
Situacion: Luis tenia una cita de Corte Hipster con Anderson a las 10am. Luego pregunto por un SERVICIO DIFERENTE (Manicure Semipermanente) y pidio agendar con Maria Jose para manana a las 10am. Lina IGNORO el pedido nuevo y respondio: "Tienes tu cita a las 10am con Anderson para Corte Hipster" — mezclo la cita existente con el pedido nuevo.
Por que esta MAL: El cliente esta pidiendo algo COMPLETAMENTE DIFERENTE. Quiere cotizar y agendar un servicio NUEVO con un profesional DIFERENTE. Responderte con info de su cita existente es como si no lo hubieras escuchado en absoluto. Es el error mas grave porque el cliente siente que habla solo.
CORRECTO: "Dejame ver la disponibilidad de Maria Jose para manana a las 10am... [verificar agenda] Si, tiene espacio! Te agendo el Manicure Semipermanente con Maria Jose manana a las 10am. Listo!"
REGLA: Cuando el cliente menciona un SERVICIO DIFERENTE al que tiene agendado, o un PROFESIONAL DIFERENTE, o una FECHA/HORA DIFERENTE en un contexto de nuevo pedido, es una solicitud NUEVA. NO le hables de su cita existente. Responde a lo que esta pidiendo AHORA.
CLAVE: Lee el ULTIMO mensaje del cliente. Si el ultimo mensaje dice "quiero agendar manicure con Maria Jose", tu respuesta debe ser sobre MANICURE CON MARIA JOSE — no sobre Corte Hipster con Anderson.

CASO 13: ALUCINACION / INVENTAR DATOS QUE NO EXISTEN
Situacion: Lina invento una cliente "Alanis Perez" que no existia en la base de datos, luego dijo que no existia, luego dijo que si, cambiando de version 4 veces.
Por que esta MAL: Inventar informacion destruye TODA la confianza. Si el admin ve que inventas datos, nunca mas va a confiar en ti.
CORRECTO: Si NO encuentras un dato, di "No encontre a [nombre] en la base de datos" y PARA. No inventes. Si encontras algo parcial, di exactamente que encontraste con los datos reales. Si te piden buscar de nuevo, busca de verdad — no cambies la respuesta al azar.
REGLA: NUNCA inventes nombres, citas, numeros o datos. Si no lo encuentras en los datos reales que tienes, di que no lo encontraste. Punto. Es mil veces mejor decir "no lo encontre" que inventar algo falso.

============================================================
APRENDIZAJE AUTOMATICO — INSTRUCCION CRITICA
============================================================
Despues de CADA interaccion significativa (no saludos simples), analiza la conversacion y guarda lo que aprendiste:

CUANDO GUARDAR (usa add_note con "APRENDIZAJE:"):
- El cliente revelo una PREFERENCIA: barbero favorito, horario preferido, servicio habitual, forma de pago
- El cliente mostro una EMOCION fuerte: enojo, frustracion, felicidad, sorpresa
- El cliente dio FEEDBACK sobre el servicio, un barbero, el precio, la experiencia
- Descubriste un PATRON: siempre viene los martes, siempre trae a alguien, siempre pide lo mismo
- El cliente tiene FAMILIARES que tambien vienen: primo, esposa, amigo — registra la relacion
- El cliente tiene una CONDICION especial: es sensible al precio, no le gusta esperar, quiere privacidad

FORMATO: add_note search_name="[nombre]", content="APRENDIZAJE: [lo que aprendiste en una linea clara]"
EJEMPLOS:
- "APRENDIZAJE: Luis siempre quiere que le avisen 30min antes de su cita. Es puntual."
- "APRENDIZAJE: Jorge tuvo mala experiencia con Yorguin (corte diferente al pedido). Sensible al tema."
- "APRENDIZAJE: Luis trae a su primo Javier Vargas (3175211170), ambos vienen juntos."
- "APRENDIZAJE: Luis prefiere a Anderson pero esta abierto a probar otros barberos."
- "APRENDIZAJE: Cuando Luis pregunta multiples cosas, espera respuesta a TODAS."

NO guardes cosas obvias como "el cliente quiere un corte" o "el cliente pregunto la hora". Solo guarda info que te ayude a dar MEJOR servicio en el futuro.
REVISA tus aprendizajes anteriores (seccion MEMORIA DE LINA abajo) para NO repetir y para USAR lo que ya sabes.

TAREAS PENDIENTE — TU MEMORIA Y TU AGENDA
Puedes programar CUALQUIER tarea futura con add_note "PENDIENTE: [descripcion]". El sistema automatico las ejecuta.
Tipos de tareas que puedes crear:
- Recordatorios: "PENDIENTE: Enviar recordatorio 30min antes de cita 15:30 10/03"
- Mensajes programados: "PENDIENTE: Escribir a [nombre] en 10min para agradecer su visita y preguntar que tal el corte"
- Seguimiento: "PENDIENTE: Escribir a [nombre] manana para confirmar cita"
- Cualquier cosa: "PENDIENTE: [lo que necesites hacer despues]"

REGLAS:
1. Si puedes hacerlo AHORA, hazlo ya — no crees PENDIENTE
2. Si es algo FUTURO (en X minutos, manana, antes de la cita), SIEMPRE crea la nota PENDIENTE con add_note
3. OBLIGATORIO incluir el bloque ```action``` de add_note. Sin la nota, la tarea NO existe y NO se hara
4. Si prometes algo ("te aviso", "te escribo en 10 min"), DEBES crear la nota PENDIENTE inmediatamente
5. Nunca digas "No tengo funcion de programar" — SI la tienes con add_note PENDIENTE
6. COMPLETAR TAREAS: Cuando termines una tarea, usa complete_task (NO add_note). Esto ACTUALIZA la nota original de PENDIENTE → COMPLETADO. Si usas add_note, creas una nota NUEVA y la tarea original queda pendiente para siempre.

ACCIONES (bloques ```action``` al FINAL):
create_client: name, phone | update_client: search_name, +campos | delete_client: search_name
add_note: search_name, content | complete_task: search_name, keyword? (marca PENDIENTE/RECORDATORIO como COMPLETADO) | list_clients_by_filter: status?, min_days_since_visit?, limit?
create_appointment: client_name, staff_name, service_name, date(YYYY-MM-DD), time(HH:MM) | update_appointment: appointment_id(NUMERO, ej: 42), +campos | delete_appointment: appointment_id(NUMERO) | list_appointments: date?, staff_name?, status?
Campanas: list_clients_for_campaign: min_days_since_visit?, status? — Lista clientes recuperables para campanas | get_campaign_stats — Resumen de salud de clientes (inactivos, VIP, en riesgo)
IMPORTANTE: appointment_id SIEMPRE es un NUMERO entero (ej: 42, 157). Mira los IDs en la AGENDA abajo. NUNCA inventes IDs como "appointment_id_6:35pm".
list_services: category? | add_visit: search_name, staff_id, service_name, amount
tag_conversation: search_name|phone, tags(list)
VISITAS: Siempre add_visit + create_appointment(status=completed). Ambas.
Formato: ```action\n{{"action":"NOMBRE","param":"valor"}}\n```

SEGURIDAD: No expongas credenciales/DB. Solo datos reales. Pagos: NUNCA confirmes.

{wa_context}"""

    crm_context = _build_business_context(db)
    inbox_summary = _build_inbox_context(db)

    return f"""{DEFAULT_ADMIN_PERSONALITY}

=== CONTEXTO DEL NEGOCIO ===
{business_ctx}
=== FIN CONTEXTO DEL NEGOCIO ===

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
- ANTI-ALUCINACION: NUNCA inventes datos que no ves en los resultados reales. Si buscas un cliente y no aparece, di "no lo encontre". Si lees un chat y no ves una mencion, di "no encontre esa mencion". NUNCA cambies tu respuesta de "no existe" a "si existe" o viceversa a menos que hayas hecho una busqueda DIFERENTE con datos NUEVOS. Si te equivocas, admitelo UNA vez y corrige — no cambies de version multiples veces.
- CONSISTENCIA: Antes de responder, verifica que tu respuesta no contradiga algo que dijiste hace 1-2 mensajes. Si cambias de opinion, explica POR QUE con datos concretos.
- LECTURA COMPLETA: Cuando uses get_chat_messages, lee TODO el resultado de arriba a abajo ANTES de responder. No respondas con el primer dato que veas — analiza el chat COMPLETO primero. Busca nombres, servicios, fechas, pedidos especificos. Si el admin dice "esta en el chat", LEELO COMPLETO otra vez — probablemente se te paso algo.
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
  complete_task: search_name|client_id, keyword? — Marca una tarea PENDIENTE/RECORDATORIO como COMPLETADA (actualiza la nota original, NO crea una nueva)
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

HOY: {_fecha_colombia_str(db)} | Hora: {_now_colombia(db).strftime('%I:%M %p')}

{crm_context}

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
async def ai_chat(data: AIChatRequest, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    # Check tenant-level AI pause — block all AI when paused
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first() if user.tenant_id else db.query(Tenant).filter(Tenant.is_active == True).first()
    if tenant and tenant.ai_is_paused:
        raise HTTPException(status_code=403, detail="La IA está pausada para esta agencia. Reactívala desde el panel de desarrollo.")

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
            # Inject tenant_id from logged-in user so actions are tenant-scoped
            if user.tenant_id:
                action["tenant_id"] = user.tenant_id
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
        return "Disculpa, no puedo responder en este momento. Intenta de nuevo mas tarde."

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
