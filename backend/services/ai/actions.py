"""
AI Action Executor — Lina's 47 actions (schedule, cancel, search, etc.)
Extracted from ai_endpoints.py during Phase 6 refactor.
"""
import os
import json
import re
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.connection import SessionLocal, get_db
from database.models import (
    Admin, Staff, Client, Service, Appointment, VisitHistory, ClientNote,
    WhatsAppConversation, WhatsAppMessage, Tenant, AIConfig,
    StaffSchedule, StaffDayOff, Expense, Location,
)


def _get_tenant_offset(db=None, tenant_id=None):
    from routes.ai_endpoints import _get_tenant_offset as _orig
    return _orig(db, tenant_id)

def _now_colombia(db=None):
    from routes.ai_endpoints import _now_colombia as _orig
    return _orig(db)

def _today_colombia(db=None):
    from routes.ai_endpoints import _today_colombia as _orig
    return _orig(db)

def _fecha_colombia_str(db=None):
    from routes.ai_endpoints import _fecha_colombia_str as _orig
    return _orig(db)


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
        if not name:
            return "ERROR: Necesito al menos el nombre para crear un cliente."

        # SEARCH FIRST: Check if client already exists by name OR phone
        q_by_name = db.query(Client).filter(Client.name.ilike(f"%{name}%"), Client.is_active == True)
        if _tid:
            q_by_name = q_by_name.filter(Client.tenant_id == _tid)
        existing_by_name = q_by_name.first()
        if existing_by_name:
            return f"Ya existe un cliente con ese nombre: {existing_by_name.name} (ID: {existing_by_name.client_id}, Tel: {existing_by_name.phone}). No lo cree de nuevo — use sus datos existentes."

        if phone:
            import re as _re
            clean_phone = _re.sub(r'\D', '', phone)
            clean_last10 = clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone
            q_all = db.query(Client).filter(Client.is_active == True)
            if _tid:
                q_all = q_all.filter(Client.tenant_id == _tid)
            for c in q_all.all():
                c_clean = _re.sub(r'\D', '', c.phone or '')
                if c_clean[-10:] == clean_last10 and clean_last10:
                    return f"Ya existe un cliente con ese telefono: {c.name} (ID: {c.client_id}). No lo cree de nuevo."

        if not phone:
            phone = "pendiente"

        q_last = db.query(Client)
        if _tid:
            q_last = q_last.filter(Client.tenant_id == _tid)
        last = q_last.order_by(Client.id.desc()).first()
        next_num = (last.id + 1) if last else 1
        client_id = f"M{20200 + next_num}"

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
        # Business notification
        try:
            from notifications import notify
            notify(_tid or 1, "new_client", f"Nuevo cliente: {client.name}", f"Tel: {client.phone} | Creado por Lina IA", "👤", "/clientes")
        except Exception:
            pass
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

    elif action_type == "list_pending_tasks":
        # List ALL pending tasks across all clients
        from sqlalchemy import or_
        pending = (
            db.query(ClientNote)
            .filter(or_(ClientNote.content.ilike("%PENDIENTE:%"), ClientNote.content.ilike("%RECORDATORIO:%")))
            .filter(~ClientNote.content.ilike("%COMPLETADO:%"))
            .filter(~ClientNote.content.ilike("%EXPIRADO:%"))
            .filter(~ClientNote.content.ilike("%FALLIDO:%"))
            .filter(~ClientNote.content.ilike("%RESUELTO:%"))
        )
        if _tid:
            pending = pending.filter(ClientNote.tenant_id == _tid)
        pending = pending.order_by(ClientNote.created_at.desc()).limit(20).all()

        if not pending:
            return "No hay tareas pendientes. Todo al dia!"

        lines = [f"Tienes {len(pending)} tarea(s) pendiente(s):"]
        for n in pending:
            client = db.query(Client).filter(Client.id == n.client_id).first()
            c_name = client.name if client else "?"
            # Extract task description
            content = n.content
            for prefix in ["PENDIENTE:", "RECORDATORIO:"]:
                content = content.replace(prefix, "").strip()
            age = ""
            if n.created_at:
                from datetime import datetime as _dt
                mins = int((_dt.utcnow() - n.created_at).total_seconds() / 60)
                if mins < 60:
                    age = f" (hace {mins}min)"
                elif mins < 1440:
                    age = f" (hace {mins // 60}h)"
                else:
                    age = f" (hace {mins // 1440}d)"
            lines.append(f"  - [{c_name}] {content[:100]}{age}")
        return "\n".join(lines)

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
        db.refresh(visit)
        # Award loyalty points
        if _tid:
            try:
                from routes.loyalty_endpoints import award_visit_points
                award_visit_points(db, client_id=client.id, amount=float(visit.amount or 0), tenant_id=_tid, visit_id=visit.id)
            except Exception:
                pass
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
        wa_token = get_wa_token(db, _tid)
        wa_phone_id = get_wa_phone_id(db, _tid)
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
        wa_token = get_wa_token(db, _tid)
        wa_phone_id = get_wa_phone_id(db, _tid)
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

        wa_token = get_wa_token(db, _tid)
        wa_phone_id = get_wa_phone_id(db, _tid)
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
        return f"Servicio creado: {svc.name} (ID:{svc.id}, {svc.category}, ${int(svc.price or 0):,})"

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
        from activity_log import log_event as _log_evt
        # Required: client_name, client_phone, staff (name or id), service (name or id), date, time
        client_name = action.get("client_name")
        client_phone = action.get("client_phone", "")
        if not client_name:
            return "ERROR: Necesito client_name para crear la cita."
        _log_evt("accion", f"📅 Creando cita para {client_name}", detail=f"Staff: {action.get('staff_name', action.get('staff_id', '?'))} | Servicio: {action.get('service_name', '?')} | {action.get('date', '?')} {action.get('time', '?')}", contact_name=client_name, status="info")

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
            svc_search = action['service_name']
            q_casvc = db.query(Service).filter(Service.name.ilike(f"%{svc_search}%"), Service.is_active == True)
            if _tid:
                q_casvc = q_casvc.filter(Service.tenant_id == _tid)
            svc_obj = q_casvc.first()
            # Fuzzy fallback: try each word individually, prioritize Barbería category
            if not svc_obj and " " in svc_search:
                _barberia_keywords = ["corte", "barba", "fade", "hipster", "cabello"]
                _is_barberia = any(kw in svc_search.lower() for kw in _barberia_keywords)
                for word in svc_search.split():
                    if len(word) > 3:
                        q_fb = db.query(Service).filter(Service.name.ilike(f"%{word}%"), Service.is_active == True)
                        if _tid:
                            q_fb = q_fb.filter(Service.tenant_id == _tid)
                        # If barbería context, prioritize Barbería category
                        if _is_barberia:
                            svc_obj = q_fb.filter(Service.category.ilike("%barber%")).first()
                        if not svc_obj:
                            svc_obj = q_fb.first()
                        if svc_obj:
                            break
            # Single-word search (no spaces): try direct fuzzy
            if not svc_obj and " " not in svc_search and len(svc_search) > 2:
                q_single = db.query(Service).filter(Service.name.ilike(f"%{svc_search}%"), Service.is_active == True)
                if _tid:
                    q_single = q_single.filter(Service.tenant_id == _tid)
                _barberia_kw = ["corte", "barba", "fade", "hipster", "cabello"]
                if any(kw in svc_search.lower() for kw in _barberia_kw):
                    svc_obj = q_single.filter(Service.category.ilike("%barber%")).first()
                if not svc_obj:
                    svc_obj = q_single.first()
        if not svc_obj:
            return "ERROR: No encontre el servicio. Servicios disponibles: " + ", ".join(
                s.name for s in db.query(Service).filter(Service.is_active == True, Service.tenant_id == _tid).limit(10).all()
            ) if _tid else "ERROR: No encontre el servicio."

        apt_date = action.get("date")
        apt_time = action.get("time")
        if not apt_date or not apt_time:
            return "ERROR: Necesito date (YYYY-MM-DD) y time (HH:MM)."

        apt_date_obj = date.fromisoformat(apt_date) if isinstance(apt_date, str) else apt_date

        # --- SAFETY: Validate date is not in the past (timezone-aware) ---
        today_col = _today_colombia(db)
        if apt_date_obj < today_col:
            return f"ERROR: La fecha {apt_date} ya paso. Hoy es {today_col.isoformat()}. Usa una fecha de hoy o futura."

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

        # --- SAME-CLIENT OVERLAP CHECK: client can't have 2 appointments at the same time ---
        # Find the client first to check their schedule
        _check_client = find_client(db, search_name=client_name, phone=client_phone, tenant_id=_tid)
        if _check_client:
            q_client_apts = db.query(Appointment).filter(
                Appointment.client_id == _check_client.id,
                Appointment.date == apt_date_obj,
                Appointment.status.in_(["confirmed", "completed"]),
            )
            if _tid:
                q_client_apts = q_client_apts.filter(Appointment.tenant_id == _tid)
            for ea in q_client_apts.all():
                try:
                    eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
                    ea_start = eh * 60 + em
                    ea_end = ea_start + (ea.duration_minutes or 30)
                    if req_start < ea_end and req_end > ea_start:
                        ea_staff = db.query(Staff).filter(Staff.id == ea.staff_id).first()
                        ea_svc = db.query(Service).filter(Service.id == ea.service_id).first()
                        _log_evt("accion", f"⛔ Conflicto de cliente: {client_name} ya tiene cita", detail=f"Cita existente: {ea.time} con {ea_staff.name if ea_staff else '?'} ({ea_svc.name if ea_svc else '?'}, ID:{ea.id}). Hora pedida: {apt_time}. Cruce detectado.", contact_name=client_name, status="warning")
                        return f"CONFLICTO: {client_name} ya tiene una cita a las {ea.time} ({ea_svc.name if ea_svc else '?'} con {ea_staff.name if ea_staff else '?'}, ID:{ea.id}). NO se puede agendar otra cita que se cruce. Sugiere un horario despues de las {ea.time} + {ea.duration_minutes or 30}min, o sea despues de las {(eh*60+em+(ea.duration_minutes or 30))//60:02d}:{(eh*60+em+(ea.duration_minutes or 30))%60:02d}."
                except (ValueError, AttributeError):
                    pass

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
            _log_evt("accion", f"⛔ Conflicto de staff: {staff_obj.name} ocupado", detail=f"Citas existentes: {', '.join(conflict_names)}. Hora pedida: {apt_time}. Proximo libre: {next_free_str}. Otros disponibles: {', '.join(available_staff[:3]) if available_staff else 'ninguno'}", contact_name=client_name, status="warning")
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
        _log_evt("accion", f"✅ Cita creada: {client_name} con {staff_obj.name}", detail=f"ID:{new_apt.id} | {svc_obj.name} | {apt_date} {apt_time} | ${svc_obj.price:,}{' | ' + auto_created_msg.strip() if auto_created_msg else ''}", contact_name=client_name, status="ok")
        # Business notification
        try:
            from notifications import notify
            _created_by = "Lina IA" if True else "Admin"
            notify(_tid or 1, "new_appointment", f"{client_name} agendo {svc_obj.name} con {staff_obj.name}", f"{apt_date} a las {apt_time} | ${svc_obj.price:,} | Creada por {_created_by}", "📅", "/agenda")
        except Exception:
            pass
        return f"Cita creada (ID:{new_apt.id}): {client_name} con {staff_obj.name} para {svc_obj.name} el {apt_date} a las {apt_time}. Precio: ${svc_obj.price:,}.{auto_created_msg}"

    elif action_type == "update_appointment":
        from activity_log import log_event as _log_evt_u
        apt = None
        apt_id = action.get("appointment_id")
        if apt_id:
            q_ua = db.query(Appointment).filter(Appointment.id == apt_id)
            if _tid:
                q_ua = q_ua.filter(Appointment.tenant_id == _tid)
            apt = q_ua.first()
        if not apt:
            return "ERROR: No encontre la cita. Necesito appointment_id."
        _log_evt_u("accion", f"🔄 Reagendando cita ID:{apt_id} de {apt.client_name}", detail=f"Cambios solicitados: {', '.join(k + '=' + str(v) for k, v in action.items() if k not in ('action', 'appointment_id') and v)}", contact_name=apt.client_name or "", status="info")

        # --- Resolve new values (keep old if not changed) ---
        new_staff_id = apt.staff_id
        new_staff_name = None
        if action.get("staff_name"):
            q_ua_st = db.query(Staff).filter(Staff.name.ilike(f"%{action['staff_name']}%"), Staff.is_active == True)
            if _tid:
                q_ua_st = q_ua_st.filter(Staff.tenant_id == _tid)
            st = q_ua_st.first()
            if st:
                new_staff_id = st.id
                new_staff_name = st.name
            else:
                return f"ERROR: No encontre al profesional '{action['staff_name']}'."
        if action.get("staff_id"):
            new_staff_id = action["staff_id"]

        new_date = apt.date
        if action.get("date"):
            new_date = date.fromisoformat(action["date"]) if isinstance(action["date"], str) else action["date"]

        new_time = apt.time
        if action.get("time"):
            new_time = action["time"]

        new_duration = apt.duration_minutes or 30
        new_svc_obj = None
        if action.get("service_name"):
            q_ua_svc = db.query(Service).filter(Service.name.ilike(f"%{action['service_name']}%"), Service.is_active == True)
            if _tid:
                q_ua_svc = q_ua_svc.filter(Service.tenant_id == _tid)
            new_svc_obj = q_ua_svc.first()
            if new_svc_obj:
                new_duration = new_svc_obj.duration_minutes or 30

        # --- CONFLICT CHECK: staff availability at new time/date ---
        time_or_date_changed = (action.get("time") or action.get("date") or action.get("staff_name") or action.get("staff_id"))
        skip_conflict = (action.get("status") in ("cancelled", "no_show"))  # No need to check if cancelling

        if time_or_date_changed and not skip_conflict:
            try:
                rh, rm = int(new_time.split(":")[0]), int(new_time.split(":")[1])
                req_start = rh * 60 + rm
                req_end = req_start + new_duration

                # Check staff conflicts (exclude current appointment)
                q_staff_apts = db.query(Appointment).filter(
                    Appointment.staff_id == new_staff_id,
                    Appointment.date == new_date,
                    Appointment.status.in_(["confirmed", "completed"]),
                    Appointment.id != apt.id,
                )
                if _tid:
                    q_staff_apts = q_staff_apts.filter(Appointment.tenant_id == _tid)

                staff_conflicts = []
                for ea in q_staff_apts.all():
                    try:
                        eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
                        ea_start = eh * 60 + em
                        ea_end = ea_start + (ea.duration_minutes or 30)
                        if req_start < ea_end and req_end > ea_start:
                            staff_conflicts.append(ea)
                    except (ValueError, AttributeError):
                        pass

                if staff_conflicts:
                    # Get the staff name for the message
                    s_obj = db.query(Staff).filter(Staff.id == new_staff_id).first()
                    s_name = new_staff_name or (s_obj.name if s_obj else "el profesional")

                    # Find next available slot
                    all_day_apts = q_staff_apts.all()
                    busy_ends = []
                    for ea in all_day_apts:
                        try:
                            eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
                            ea_end = eh * 60 + em + (ea.duration_minutes or 30)
                            busy_ends.append(ea_end)
                        except (ValueError, AttributeError):
                            pass
                    next_free = max(busy_ends) if busy_ends else req_end
                    next_free_str = f"{next_free // 60:02d}:{next_free % 60:02d}"

                    # Find alternative staff
                    q_all_staff = db.query(Staff).filter(Staff.is_active == True)
                    if _tid:
                        q_all_staff = q_all_staff.filter(Staff.tenant_id == _tid)
                    available_staff = []
                    for s in q_all_staff.all():
                        if s.id == new_staff_id:
                            continue
                        q_sc = db.query(Appointment).filter(
                            Appointment.staff_id == s.id,
                            Appointment.date == new_date,
                            Appointment.status.in_(["confirmed", "completed"]),
                        )
                        if _tid:
                            q_sc = q_sc.filter(Appointment.tenant_id == _tid)
                        s_busy = False
                        for sa in q_sc.all():
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

                    conflict_names = [f"{c.client_name} a las {c.time}" for c in staff_conflicts]
                    _log_evt_u("accion", f"⛔ Reagendar bloqueado: {s_name} ocupado", detail=f"Cita ID:{apt_id}. Citas en conflicto: {', '.join(conflict_names)}. Hora pedida: {new_time}. Proximo libre: {next_free_str}. Otros disponibles: {', '.join(available_staff[:3]) if available_staff else 'ninguno'}", contact_name=apt.client_name or "", status="warning")
                    msg = f"CONFLICTO: {s_name} ya tiene cita(s) a esa hora ({', '.join(conflict_names)}). NO se reagendo."
                    msg += f" Proximo horario libre con {s_name}: {next_free_str}."
                    if available_staff:
                        msg += f" Profesionales disponibles a las {new_time}: {', '.join(available_staff[:3])}."
                    else:
                        msg += f" Ningun profesional esta libre a las {new_time}."
                    return msg

                # Check same-client overlap (client can't have 2 appointments at the same time)
                if apt.client_id:
                    q_client_apts = db.query(Appointment).filter(
                        Appointment.client_id == apt.client_id,
                        Appointment.date == new_date,
                        Appointment.status.in_(["confirmed", "completed"]),
                        Appointment.id != apt.id,
                    )
                    if _tid:
                        q_client_apts = q_client_apts.filter(Appointment.tenant_id == _tid)
                    for ea in q_client_apts.all():
                        try:
                            eh, em = int(ea.time.split(":")[0]), int(ea.time.split(":")[1])
                            ea_start = eh * 60 + em
                            ea_end = ea_start + (ea.duration_minutes or 30)
                            if req_start < ea_end and req_end > ea_start:
                                _log_evt_u("accion", f"⛔ Reagendar bloqueado: {apt.client_name} tiene cruce", detail=f"Cita ID:{apt_id}. El cliente ya tiene cita a las {ea.time} (ID:{ea.id}). Hora pedida: {new_time}.", contact_name=apt.client_name or "", status="warning")
                                return f"CONFLICTO: {apt.client_name} ya tiene otra cita a las {ea.time} ese dia (ID:{ea.id}). NO se puede reagendar a la misma hora. Elige otro horario."
                        except (ValueError, AttributeError):
                            pass
            except (ValueError, AttributeError) as e:
                logger.warning(f"Could not parse time for conflict check: {e}")

        # --- Apply changes ---
        changed = []
        if action.get("status"):
            apt.status = action["status"]
            changed.append(f"estado={action['status']}")
        if action.get("date"):
            apt.date = new_date
            changed.append(f"fecha={action['date']}")
        if action.get("time"):
            apt.time = new_time
            changed.append(f"hora={action['time']}")
        if new_staff_name:
            apt.staff_id = new_staff_id
            changed.append(f"profesional={new_staff_name}")
        elif action.get("staff_id"):
            apt.staff_id = new_staff_id
            changed.append(f"staff_id={action['staff_id']}")
        if action.get("notes"):
            apt.notes = action["notes"]
            changed.append("notas")
        if new_svc_obj:
            apt.service_id = new_svc_obj.id
            apt.duration_minutes = new_svc_obj.duration_minutes
            apt.price = new_svc_obj.price
            changed.append(f"servicio={new_svc_obj.name}")
        if not changed:
            return "No se especificaron cambios."
        db.commit()
        _log_evt_u("accion", f"✅ Cita reagendada: {apt.client_name}", detail=f"ID:{apt.id} | Cambios: {', '.join(changed)}", contact_name=apt.client_name or "", status="ok")
        try:
            from notifications import notify
            notify(_tid or 1, "appointment_updated", f"Cita reagendada: {apt.client_name}", f"Cambios: {', '.join(changed)}", "🔄", "/agenda")
        except Exception:
            pass
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

    # ---- QUEUE BULK TASK (background worker) ----
    elif action_type == "queue_bulk_task":
        import json as _json
        task_type = action.get("task_type", "bulk_operation")
        description = action.get("description", "Tarea masiva")
        items = action.get("items", [])

        if not items:
            return "ERROR: No hay items para procesar."

        from database.models import LinaTask
        lina_task = LinaTask(
            tenant_id=_tid or 0,
            task_type=task_type,
            description=description,
            total_items=len(items),
            completed_items=0,
            status="pending",
            payload=_json.dumps(items, ensure_ascii=False),
            result_log=_json.dumps([], ensure_ascii=False),
        )
        db.add(lina_task)
        db.commit()
        db.refresh(lina_task)

        from activity_log import log_event as _log_event
        _log_event(
            "tarea",
            f"Tarea masiva #{lina_task.id} creada: {description[:60]}",
            detail=f"{len(items)} items en cola — se procesan 5 cada 2 minutos",
            status="info",
        )

        eta_minutes = (len(items) // 5) * 2
        return (
            f"Tarea masiva #{lina_task.id} creada: {description}. "
            f"{len(items)} items en cola. Se procesan automaticamente 5 cada 2 minutos. "
            f"Tiempo estimado: ~{eta_minutes} minutos. "
            f"Puedes ver el progreso en /api/lina/tasks/{lina_task.id}"
        )

    # ---- TEMPLATES ----
    if action_type == "list_templates":
        from database.models import MessageTemplate
        q = db.query(MessageTemplate)
        if _tid:
            q = q.filter(MessageTemplate.tenant_id == _tid)
        status_filter = action.get("status")  # "approved", "pending", "draft"
        if status_filter:
            q = q.filter(MessageTemplate.status == status_filter)
        templates = q.order_by(MessageTemplate.category, MessageTemplate.name).all()
        if not templates:
            return "No hay plantillas registradas."
        lines = []
        for t in templates:
            vars_str = ", ".join(t.variables or []) if t.variables else ""
            lines.append(f"- **{t.name}** [{t.category}] — Estado: {t.status}" + (f" | Variables: {vars_str}" if vars_str else ""))
        return f"{len(templates)} plantillas encontradas:\n" + "\n".join(lines)

    if action_type == "create_template":
        from database.models import MessageTemplate
        import re as _re
        name = action.get("name", "").strip()
        body = action.get("body", "").strip()
        category = action.get("category", "post-servicio").strip()
        if not name or not body:
            return "ERROR: Necesito al menos name y body para crear una plantilla."
        # Auto-extract variables like {{nombre}}, {{servicio}}
        variables = list(set(_re.findall(r'\{\{(\w+)\}\}', body)))
        slug = name.lower().replace(" ", "_").replace("-", "_")
        tmpl = MessageTemplate(
            tenant_id=_tid,
            name=name,
            slug=slug,
            body=body,
            category=category,
            language="es",
            variables=variables,
            status="draft",
        )
        db.add(tmpl)
        db.commit()
        db.refresh(tmpl)
        return f"Plantilla '{name}' creada (ID: {tmpl.id}, estado: draft). Variables detectadas: {variables or 'ninguna'}. Usa submit_template_to_meta para enviarla a aprobacion."

    if action_type == "submit_template_to_meta":
        from database.models import MessageTemplate
        template_id = action.get("template_id")
        template_name = action.get("template_name", "").strip()
        if template_name and not template_id:
            t = db.query(MessageTemplate).filter(MessageTemplate.name.ilike(f"%{template_name}%")).first()
            if t:
                template_id = t.id
        if not template_id:
            return "ERROR: Necesito template_id o template_name para enviar a Meta."
        tmpl = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
        if not tmpl:
            return f"ERROR: No encontre la plantilla #{template_id}."
        # Call Meta API to submit template
        from routes._helpers import get_wa_token
        from database.models import Tenant
        tenant = db.query(Tenant).filter(Tenant.id == (_tid or 1)).first()
        wa_token = get_wa_token(db, _tid)
        waba_id = tenant.wa_business_account_id if tenant else os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
        if not wa_token or not waba_id:
            return "ERROR: No hay credenciales de WhatsApp configuradas para enviar a Meta."
        api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")
        # Build Meta template payload
        components = [{"type": "BODY", "text": tmpl.body}]
        meta_category = "MARKETING" if tmpl.category in ("promocion", "reactivacion", "fidelizacion") else "UTILITY"
        payload = {
            "name": tmpl.slug or tmpl.name.lower().replace(" ", "_"),
            "language": tmpl.language or "es",
            "category": meta_category,
            "components": components,
        }
        try:
            resp = httpx.post(
                f"https://graph.facebook.com/{api_version}/{waba_id}/message_templates",
                headers={"Authorization": f"Bearer {wa_token}", "Content-Type": "application/json"},
                json=payload, timeout=15,
            )
            data = resp.json()
            if resp.status_code == 200 and "id" in data:
                tmpl.meta_template_id = data["id"]
                tmpl.status = "pending"
                db.commit()
                return f"Plantilla '{tmpl.name}' enviada a Meta para aprobacion (ID Meta: {data['id']}). Estado: pending. Meta tarda entre minutos y 24h en aprobar."
            else:
                error_msg = data.get("error", {}).get("message", str(data)[:200])
                return f"ERROR al enviar a Meta: {error_msg}"
        except Exception as e:
            return f"ERROR al conectar con Meta: {str(e)[:150]}"

    if action_type == "check_template_status":
        from database.models import MessageTemplate
        template_id = action.get("template_id")
        template_name = action.get("template_name", "").strip()
        if template_name and not template_id:
            t = db.query(MessageTemplate).filter(MessageTemplate.name.ilike(f"%{template_name}%")).first()
            if t:
                template_id = t.id
        if not template_id:
            return "ERROR: Necesito template_id o template_name."
        tmpl = db.query(MessageTemplate).filter(MessageTemplate.id == template_id).first()
        if not tmpl:
            return f"ERROR: No encontre la plantilla #{template_id}."
        return f"Plantilla '{tmpl.name}': estado={tmpl.status}, categoria={tmpl.category}, variables={tmpl.variables or []}"

    # ---- WORKFLOWS / AUTOMATIONS ----
    if action_type == "list_workflows":
        from database.models import WorkflowTemplate
        q = db.query(WorkflowTemplate)
        if _tid:
            q = q.filter(WorkflowTemplate.tenant_id == _tid)
        workflows = q.all()
        if not workflows:
            return "No hay automatizaciones configuradas."
        lines = []
        for w in workflows:
            status = "✅ Activo" if w.is_enabled else "⏸ Desactivado"
            tmpl_name = w.config.get("template_name", "sin plantilla") if w.config else "sin plantilla"
            lines.append(f"- **{w.name}** ({w.trigger_type}) — {status} | Plantilla: {tmpl_name}")
        return f"{len(workflows)} automatizaciones:\n" + "\n".join(lines)

    if action_type == "toggle_workflow":
        from database.models import WorkflowTemplate
        workflow_id = action.get("workflow_id")
        workflow_name = action.get("workflow_name", "").strip()
        enabled = action.get("enabled")  # True/False
        if workflow_name and not workflow_id:
            w = db.query(WorkflowTemplate).filter(WorkflowTemplate.name.ilike(f"%{workflow_name}%")).first()
            if w:
                workflow_id = w.id
        if not workflow_id:
            return "ERROR: Necesito workflow_id o workflow_name."
        workflow = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
        if not workflow:
            return f"ERROR: No encontre la automatizacion #{workflow_id}."
        if enabled is not None:
            workflow.is_enabled = bool(enabled)
        else:
            workflow.is_enabled = not workflow.is_enabled
        db.commit()
        status = "activada" if workflow.is_enabled else "desactivada"
        return f"Automatizacion '{workflow.name}' {status}."

    if action_type == "update_workflow":
        from database.models import WorkflowTemplate
        workflow_id = action.get("workflow_id")
        workflow_name = action.get("workflow_name", "").strip()
        if workflow_name and not workflow_id:
            w = db.query(WorkflowTemplate).filter(WorkflowTemplate.name.ilike(f"%{workflow_name}%")).first()
            if w:
                workflow_id = w.id
        if not workflow_id:
            return "ERROR: Necesito workflow_id o workflow_name."
        workflow = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
        if not workflow:
            return f"ERROR: No encontre la automatizacion #{workflow_id}."
        if action.get("message"):
            workflow.message = action["message"]
        if action.get("config"):
            workflow.config = {**(workflow.config or {}), **action["config"]}
        if action.get("is_enabled") is not None:
            workflow.is_enabled = bool(action["is_enabled"])
        db.commit()
        return f"Automatizacion '{workflow.name}' actualizada."

    # ---- CAMPAIGNS ----
    if action_type == "create_campaign":
        from database.models import Campaign
        name = action.get("name", "").strip()
        campaign_type = action.get("type", "reactivation").strip()
        if not name:
            return "ERROR: Necesito al menos el nombre de la campana."
        campaign = Campaign(
            tenant_id=_tid,
            name=name,
            type=campaign_type,
            status="draft",
            filters=action.get("filters", {}),
            message=action.get("message", ""),
            template_name=action.get("template_name", ""),
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        return f"Campana '{name}' creada (ID: {campaign.id}, tipo: {campaign_type}, estado: draft). Usa send_campaign para ejecutarla."

    if action_type == "list_campaigns":
        from database.models import Campaign
        q = db.query(Campaign)
        if _tid:
            q = q.filter(Campaign.tenant_id == _tid)
        campaigns = q.order_by(Campaign.created_at.desc()).limit(20).all()
        if not campaigns:
            return "No hay campanas registradas."
        lines = []
        for c in campaigns:
            lines.append(f"- **{c.name}** (ID: {c.id}) — Tipo: {c.type}, Estado: {c.status}, Enviados: {c.sent_count or 0}")
        return f"{len(campaigns)} campanas:\n" + "\n".join(lines)

    if action_type == "send_campaign":
        campaign_id = action.get("campaign_id")
        if not campaign_id:
            return "ERROR: Necesito campaign_id para enviar la campana."
        from database.models import Campaign
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            return f"ERROR: No encontre la campana #{campaign_id}."
        if campaign.status == "sent":
            return f"La campana '{campaign.name}' ya fue enviada ({campaign.sent_count} mensajes)."
        # Delegate to campaign send endpoint logic
        return f"Para enviar la campana '{campaign.name}' (ID: {campaign.id}), el admin debe ir a Campanas > '{campaign.name}' > Enviar. Por seguridad, el envio masivo requiere confirmacion manual del admin."

    # ---- FINANCES ----
    if action_type == "get_financial_summary":
        from database.models import VisitHistory, Expense
        from sqlalchemy import func
        today = datetime.now().date()
        month_start = today.replace(day=1)
        # Revenue this month (from visits)
        q_rev = db.query(func.sum(VisitHistory.amount)).filter(VisitHistory.visited_at >= month_start)
        if _tid:
            q_rev = q_rev.filter(VisitHistory.tenant_id == _tid)
        revenue = q_rev.scalar() or 0
        # Expenses this month
        q_exp = db.query(func.sum(Expense.amount)).filter(Expense.date >= month_start)
        if _tid:
            q_exp = q_exp.filter(Expense.tenant_id == _tid)
        expenses = q_exp.scalar() or 0
        # Visit count
        q_visits = db.query(func.count(VisitHistory.id)).filter(VisitHistory.visited_at >= month_start)
        if _tid:
            q_visits = q_visits.filter(VisitHistory.tenant_id == _tid)
        visit_count = q_visits.scalar() or 0
        profit = revenue - expenses
        return (
            f"Resumen financiero del mes ({today.strftime('%B %Y')}):\n"
            f"- Ingresos: ${revenue:,.0f} COP ({visit_count} visitas)\n"
            f"- Gastos: ${expenses:,.0f} COP\n"
            f"- Ganancia neta: ${profit:,.0f} COP"
        )

    if action_type == "create_expense":
        from database.models import Expense
        description = action.get("description", "").strip()
        amount = action.get("amount", 0)
        category = action.get("category", "general").strip()
        if not description or not amount:
            return "ERROR: Necesito descripcion y monto para crear un gasto."
        expense = Expense(
            tenant_id=_tid,
            description=description,
            amount=float(amount),
            category=category,
            date=datetime.now().date(),
        )
        db.add(expense)
        db.commit()
        return f"Gasto registrado: '{description}' por ${float(amount):,.0f} COP (categoria: {category})."

    if action_type == "list_expenses":
        from database.models import Expense
        q = db.query(Expense)
        if _tid:
            q = q.filter(Expense.tenant_id == _tid)
        expenses = q.order_by(Expense.date.desc()).limit(20).all()
        if not expenses:
            return "No hay gastos registrados este periodo."
        lines = []
        for e in expenses:
            lines.append(f"- {e.date}: {e.description} — ${e.amount:,.0f} COP ({e.category})")
        total = sum(e.amount for e in expenses)
        return f"{len(expenses)} gastos recientes (total: ${total:,.0f} COP):\n" + "\n".join(lines)

    return f"ERROR: Accion desconocida '{action_type}'"



# ============================================================================
