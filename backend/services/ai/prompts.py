"""
System Prompt Builder + WhatsApp Context — Builds Lina's system prompt.
Extracted from ai_endpoints.py during Phase 6 refactor.
"""
import os
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.connection import SessionLocal
from database.models import (
    Client, Staff, Service, Appointment, VisitHistory, ClientNote,
    WhatsAppConversation, WhatsAppMessage, Tenant, AIConfig,
    StaffSchedule, ClientSubscription,
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

def compute_client_fields(client, db):
    from routes._helpers import compute_client_fields as _orig
    return _orig(client, db)

_DIAS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


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
Telefono registrado: {client.phone}
Estado: {status}
Etiquetas: {tags}
Total visitas: {total_visits}
Total gastado: ${total_spent:,} COP
Ultima visita: {last_visit or 'Nunca'}
Dias sin visita: {days_since if days_since is not None else 'N/A'}
Servicio favorito: {favorite_svc}
Profesional preferido: {preferred_barber}
Cumpleaños: {birthday_str}
No-shows registrados: {no_show_count}
REGLA SOBRE DATOS INTERNOS: No menciones IDs de cliente ni datos tecnicos. El telefono y nombre SI puedes compartirlo si el cliente lo pregunta, pero NO lo menciones si no te lo piden."""

                # Smart hints for Lina (powered by Client Intelligence Engine)
                hints = []
                if is_birthday_soon:
                    hints.append("CUMPLEAÑOS CERCANO: Felicita al cliente y ofrece descuento de cumpleaños si aplica.")

                # Client Intelligence: visit cycle + risk score
                try:
                    from client_intelligence import calculate_visit_cycle, calculate_risk_score
                    _cycle = calculate_visit_cycle(client.id, db)
                    _risk = calculate_risk_score(client.id, db)

                    if _cycle["avg_cycle_days"] and _cycle["days_since_last"]:
                        if _cycle["cycle_status"] == "critical":
                            hints.append(f"ALERTA CRITICA: Lleva {_cycle['days_since_last']} dias sin venir (su ciclo normal es cada {_cycle['avg_cycle_days']} dias). Riesgo de perderlo: {_risk['risk_score']}%. Se calida, ofrece incentivo para que vuelva.")
                        elif _cycle["cycle_status"] == "overdue":
                            hints.append(f"CLIENTE ATRASADO: Lleva {_cycle['days_since_last']} dias sin venir (normalmente viene cada {_cycle['avg_cycle_days']} dias). Sugierele agendar pronto.")
                        elif _cycle["cycle_status"] == "on_track":
                            hints.append(f"CICLO DE VISITA: Viene cada ~{_cycle['avg_cycle_days']} dias. Ultima visita hace {_cycle['days_since_last']} dias. Esta dentro de lo normal.")
                    elif days_since and days_since > 60:
                        hints.append(f"CLIENTE INACTIVO: Lleva {days_since} dias sin venir. Se especialmente calida y ofrece incentivo para que vuelva.")

                    if _risk["risk_score"] >= 60:
                        hints.append(f"RIESGO DE CHURN: Score {_risk['risk_score']}/100. Motivos: {'; '.join(_risk['factors'][:3])}")
                except Exception as intel_err:
                    logger.warning(f"Client intelligence error: {intel_err}")
                    if days_since and days_since > 60:
                        hints.append(f"CLIENTE INACTIVO: Lleva {days_since} dias sin venir. Se especialmente calida y ofrece incentivo para que vuelva.")

                if total_visits >= 10:
                    hints.append(f"CLIENTE VIP: Tiene {total_visits} visitas. Tratalo con atencion premium.")
                if no_show_count >= 3:
                    hints.append(f"HISTORIAL DE INASISTENCIAS: {no_show_count} no-shows. Confirma bien la cita antes de agendar.")
                if total_visits == 0:
                    hints.append("CLIENTE NUEVO: Primer contacto. Da la mejor primera impresion.")

                # === SUSCRIPCIONES / PAQUETES ACTIVOS ===
                try:
                    from database.models import ClientSubscription
                    active_subs = db.query(ClientSubscription).filter(
                        ClientSubscription.client_id == client.id,
                        ClientSubscription.tenant_id == _conv_tid,
                        ClientSubscription.status.in_(['active', 'paused'])
                    ).all()
                    if active_subs:
                        sub_lines = []
                        for sub in active_subs:
                            parts = [f"{sub.service_name}"]
                            if sub.sessions_total:
                                parts.append(f"{sub.sessions_used}/{sub.sessions_total} sesiones usadas")
                            if sub.expires_at:
                                from datetime import datetime as dt
                                days_left = (sub.expires_at - dt.utcnow()).days
                                if days_left > 0:
                                    parts.append(f"vence en {days_left} dias")
                                else:
                                    parts.append("VENCIDO")
                            if sub.status == 'paused':
                                parts.append("PAUSADO")
                            sub_lines.append(" — ".join(parts))
                        client_section += f"\nPLANES/PAQUETES ACTIVOS:\n" + "\n".join(f"  • {l}" for l in sub_lines)
                        if any(sub.expires_at and (sub.expires_at - dt.utcnow()).days <= 7 for sub in active_subs):
                            hints.append("PAQUETE POR VENCER: El cliente tiene un plan que vence pronto. Ofrezca renovacion.")
                    else:
                        client_section += "\nPLANES/PAQUETES: Ninguno activo."
                except Exception:
                    pass

                # === SENTIMENT ANALYSIS — adapt tone based on client mood ===
                try:
                    _conv_sentiment = getattr(conv, 'last_sentiment', None) if conv else None
                    if _conv_sentiment == "urgent":
                        hints.append("ALERTA SENTIMIENTO: El cliente parece MUY molesto o tiene una urgencia. Responde con empatia maxima, discúlpate si aplica, y ofrece solucion inmediata. NO uses tono alegre.")
                    elif _conv_sentiment == "negative":
                        hints.append("SENTIMIENTO NEGATIVO: El cliente parece insatisfecho o frustrado. Usa un tono empatico y comprensivo. Pregunta que sucedio y ofrece ayuda concreta.")
                    elif _conv_sentiment == "positive":
                        hints.append("SENTIMIENTO POSITIVO: El cliente esta contento. Aprovecha para fidelizar, sugerir servicios adicionales o pedir resena.")
                except Exception:
                    pass

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

                # Loyalty program info
                try:
                    from database.models import LoyaltyAccount, LoyaltyConfig
                    loyalty_cfg = db.query(LoyaltyConfig).filter(LoyaltyConfig.tenant_id == tenant_id, LoyaltyConfig.is_active == True).first()
                    if loyalty_cfg:
                        loyalty_acc = db.query(LoyaltyAccount).filter(LoyaltyAccount.client_id == client.id, LoyaltyAccount.tenant_id == tenant_id).first()
                        if loyalty_acc:
                            tier_display = {"bronze": "Bronce", "silver": "Plata", "gold": "Oro", "vip": "VIP"}.get(loyalty_acc.tier, loyalty_acc.tier)
                            client_section += f"\nLealtad: {tier_display} | {loyalty_acc.available_points} puntos disponibles ({loyalty_acc.total_points} acumulados)"
                            if loyalty_acc.tier in ("gold", "vip"):
                                hints.append(f"CLIENTE {tier_display.upper()}: Tratalo con atencion premium. Tiene {loyalty_acc.available_points} puntos canjeables.")
                except Exception:
                    pass

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
            # No linked client — but we still know their WhatsApp name and phone
            phone = conv.wa_contact_phone or "desconocido"
            contact_name = conv.wa_contact_name or "desconocido"
            sections.append(f"""=== CONTACTO EN ESTA CONVERSACION ===
Nombre en WhatsApp: {contact_name}
Telefono de WhatsApp: {phone}
Estado: NO registrado en el CRM (cliente nuevo)
INSTRUCCIONES PARA ESTE CONTACTO:
- Usa el nombre "{contact_name}" para dirigirte a esta persona. NUNCA digas que no sabes su nombre.
- NUNCA le pidas su numero de telefono — ya lo tienes arriba.
- Cuando crees el cliente con create_client, solo necesitas el nombre. El telefono se asigna automaticamente.
- El telefono y nombre puedes compartirlo si el cliente lo pregunta, pero NO lo menciones si no te lo piden.""")

    # Staff names + specialty + schedule (always include)
    staff_q = db.query(Staff).filter(Staff.is_active == True)
    if tenant_id:
        staff_q = staff_q.filter(Staff.tenant_id == tenant_id)
    staff_all = staff_q.all()
    _DIAS = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"]
    if staff_all:
        staff_lines = []
        for s in staff_all:
            line = f"  {s.name} ({s.specialty or s.role})"
            # Add working hours if available
            try:
                from database.models import StaffSchedule
                schedules = db.query(StaffSchedule).filter(
                    StaffSchedule.staff_id == s.id,
                    StaffSchedule.tenant_id == (tenant_id or s.tenant_id),
                    StaffSchedule.is_working == True,
                ).all()
                if schedules:
                    days_working = [_DIAS[sch.day_of_week] for sch in sorted(schedules, key=lambda x: x.day_of_week)]
                    hours = schedules[0]
                    line += f" | Horario: {','.join(days_working)} {hours.start_time}-{hours.end_time}"
            except Exception:
                pass
            staff_lines.append(line)
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
    # PRIVACY: Only show THIS client's name. Other clients shown as "Ocupado" to prevent data leaks.
    current_client_id = None
    if conv_id:
        _conv_obj = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
        current_client_id = _conv_obj.client_id if _conv_obj else None

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
            # Show client name only if it's THIS conversation's client
            if current_client_id and a.client_id == current_client_id:
                client_display = a.client_name
                apt_lines.append(f"  ID:{a.id} {a.time} | {client_display} (TU CITA) | {svc_obj.name if svc_obj else '?'} | {staff_obj.name if staff_obj else '?'} | {a.status}")
            else:
                apt_lines.append(f"  {a.time} | [Ocupado] | {staff_obj.name if staff_obj else '?'} | {a.status}")
        sections.append(f"""AGENDA HOY ({today.strftime('%d/%m/%Y')}) — {len(todays_apts)} citas (ESTAS YA EXISTEN, no las crees de nuevo):
{chr(10).join(apt_lines)}
REGLA DE PRIVACIDAD ABSOLUTA: Los slots marcados [Ocupado] son de OTROS clientes. JAMAS reveles su nombre, servicio ni detalles. Si alguien pregunta por la cita de otra persona, responde: "No puedo compartir informacion de otros clientes por privacidad." Esta regla NO tiene excepciones.""")
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
            if current_client_id and a.client_id == current_client_id:
                client_display = a.client_name
                apt_lines.append(f"  ID:{a.id} {a.time} | {client_display} (TU CITA) | {svc_obj.name if svc_obj else '?'} | {staff_obj.name if staff_obj else '?'} | {a.status}")
            else:
                apt_lines.append(f"  {a.time} | [Ocupado] | {staff_obj.name if staff_obj else '?'} | {a.status}")
        sections.append(f"AGENDA MAÑANA ({tomorrow.strftime('%d/%m/%Y')}) — {len(tomorrows_apts)} citas (ESTAS YA EXISTEN):\n" + "\n".join(apt_lines))

    # ── PRECISION SCHEDULING: Optimal slots per staff for today + tomorrow ──
    def _find_optimal_slots(apts, staff_list, target_date, schedule_map=None):
        """Find optimal free slots per staff, prioritizing gap-filling."""
        OPEN_H, CLOSE_H = 8, 20  # default business hours (8am-8pm)
        SLOT_DURATION = 30  # minutes
        lines = []
        for s in staff_list:
            s_apts = sorted(
                [a for a in apts if a.staff_id == s.id],
                key=lambda a: a.time
            )
            # Build busy intervals
            busy = []
            for a in s_apts:
                try:
                    h, m = int(a.time.split(":")[0]), int(a.time.split(":")[1])
                    start = h * 60 + m
                    end = start + (a.duration_minutes or 30)
                    busy.append((start, end))
                except (ValueError, AttributeError):
                    pass

            # Find free slots
            free_slots = []
            t = OPEN_H * 60
            close = CLOSE_H * 60
            for bs, be in busy:
                if t < bs:
                    free_slots.append((t, bs, bs - t, 'gap'))  # gap between appointments
                t = max(t, be)
            if t < close:
                free_slots.append((t, close, close - t, 'tail'))  # end of day

            if not free_slots:
                continue

            # Score slots: gaps first (fill holes), then shorter gaps prioritized
            scored = []
            for fs, fe, dur, slot_type in free_slots:
                if dur < SLOT_DURATION:
                    continue
                score = 100 if slot_type == 'gap' else 50  # gaps > tail
                score += max(0, 60 - dur)  # shorter gaps score higher (tighter fit)
                h, m = divmod(fs, 60)
                scored.append((score, f"{h:02d}:{m:02d}", dur, slot_type))

            scored.sort(key=lambda x: -x[0])
            top3 = scored[:3]
            if top3:
                slot_strs = []
                for sc, time_str, dur, stype in top3:
                    label = "llena hueco" if stype == 'gap' else "final del dia"
                    slot_strs.append(f"{time_str} ({label}, {dur}min libres)")
                lines.append(f"  {s.name}: {' | '.join(slot_strs)}")

        return lines

    # Get staff for slots
    slot_staff = staff_q.all() if 'staff_q' not in dir() else db.query(Staff).filter(Staff.is_active == True, *([Staff.tenant_id == tenant_id] if tenant_id else [])).all()

    today_slots = _find_optimal_slots(todays_apts, slot_staff, today)
    tomorrow_slots = _find_optimal_slots(tomorrows_apts if tomorrows_apts else [], slot_staff, tomorrow)

    if today_slots or tomorrow_slots:
        slot_section = "HORARIOS OPTIMOS (sugeridos por el sistema — llenan huecos de la agenda):"
        if today_slots:
            slot_section += f"\nHoy ({today.strftime('%d/%m')}):\n" + "\n".join(today_slots)
        if tomorrow_slots:
            slot_section += f"\nManana ({tomorrow.strftime('%d/%m')}):\n" + "\n".join(tomorrow_slots)
        slot_section += "\nINSTRUCCION: Cuando el cliente pida cita, sugiere PRIMERO estos horarios optimos (llenan huecos). Si no le sirven, ofrece otros disponibles."
        sections.append(slot_section)

    # ── No-Show Risk alerts for today's appointments ──
    try:
        from no_show_predictor import calculate_no_show_risk
        high_risk = []
        for a in todays_apts:
            if a.status != 'confirmed':
                continue
            risk = calculate_no_show_risk(a, db, tenant_id)
            if risk["risk_score"] >= 45:
                high_risk.append(f"  {a.time} {a.client_name}: riesgo {risk['risk_score']}% ({', '.join(risk['factors'][:2])})")
        if high_risk:
            sections.append(f"ALERTA NO-SHOW — {len(high_risk)} cita(s) HOY con alto riesgo de inasistencia:\n" + "\n".join(high_risk) + "\nACCION: Si el cliente de alto riesgo te escribe, confirma su cita proactivamente: 'Te confirmo tu cita de hoy a las X?'")
    except Exception:
        pass

    # ── Client preferred time from memory ──
    if conv_id:
        try:
            _conv_for_mem = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
            if _conv_for_mem and _conv_for_mem.client_id:
                from database.models import ClientMemory
                pref_memories = db.query(ClientMemory).filter(
                    ClientMemory.client_id == _conv_for_mem.client_id,
                    ClientMemory.content.ilike("%horario%") | ClientMemory.content.ilike("%prefiere%tarde%") | ClientMemory.content.ilike("%prefiere%manana%") | ClientMemory.content.ilike("%siempre viene%"),
                ).limit(3).all()
                if pref_memories:
                    pref_lines = [f"  - {m.content[:100]}" for m in pref_memories]
                    sections.append("PREFERENCIAS DE HORARIO DEL CLIENTE (de memoria):\n" + "\n".join(pref_lines) + "\nUsa esta info para sugerir horarios que le convengan.")
        except Exception:
            pass

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

    # ── AI Marketing Intelligence: proactive suggestions (admin chat only) ──
    if not conv_id:  # Admin chat (no conv_id = not WhatsApp)
        try:
            marketing_tips = []
            # 1. Inactive clients
            thirty_days_ago = datetime.now().date() - timedelta(days=30)
            inactive_count = db.query(Client).filter(
                Client.is_active == True,
                *([Client.tenant_id == tenant_id] if tenant_id else []),
            ).filter(
                ~Client.id.in_(
                    db.query(VisitHistory.client_id).filter(
                        VisitHistory.visit_date >= thirty_days_ago,
                    ).distinct()
                )
            ).count()
            if inactive_count >= 5:
                marketing_tips.append(f"Tienes {inactive_count} clientes que no vienen hace +30 dias. Puedo generar una campana de reactivacion.")

            # 2. Upcoming birthdays (next 7 days)
            from sqlalchemy import extract
            today_date = datetime.now().date()
            bday_clients = db.query(Client).filter(
                Client.birthday.isnot(None),
                Client.is_active == True,
                *([Client.tenant_id == tenant_id] if tenant_id else []),
            ).all()
            upcoming_bdays = []
            for c in bday_clients:
                try:
                    bday_this_year = c.birthday.replace(year=today_date.year)
                    days_to = (bday_this_year - today_date).days
                    if 0 <= days_to <= 7:
                        upcoming_bdays.append(c.name.split()[0])
                except (ValueError, AttributeError):
                    pass
            if upcoming_bdays:
                marketing_tips.append(f"Cumpleanos esta semana: {', '.join(upcoming_bdays[:5])}. Puedo enviarles felicitacion + descuento.")

            # 3. Low activity days
            from collections import Counter
            DIAS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']
            recent_visits = db.query(VisitHistory).filter(
                VisitHistory.visit_date >= today_date - timedelta(days=60),
                *([VisitHistory.tenant_id == tenant_id] if tenant_id else []),
            ).all()
            if recent_visits:
                day_counts = Counter(v.visit_date.weekday() for v in recent_visits)
                if day_counts:
                    avg = sum(day_counts.values()) / max(len(day_counts), 1)
                    weak_days = [DIAS[d] for d, c in day_counts.items() if c < avg * 0.6]
                    if weak_days:
                        marketing_tips.append(f"Los {', '.join(weak_days)} facturas menos. Considera una promo para esos dias.")

            if marketing_tips:
                sections.append("SUGERENCIAS DE MARKETING (basadas en datos reales):\n" + "\n".join(f"  - {t}" for t in marketing_tips) + "\nSi el admin pregunta sobre campanas o marketing, usa estas sugerencias.")
        except Exception:
            pass

    return "\n\n".join(sections)


def _build_system_prompt(db: Session, is_whatsapp: bool = False, conv_id: int = None, tenant_id: int = None, location_id: int = None) -> str:
    """Build the full system prompt with business context + hardcoded Lina brain + dynamic data."""
    # Resolve tenant_id and location_id from conversation if not provided
    if conv_id:
        from database.models import WhatsAppConversation
        conv_obj = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
        if conv_obj:
            if not tenant_id:
                tenant_id = getattr(conv_obj, 'tenant_id', None)
            if not location_id:
                location_id = getattr(conv_obj, 'location_id', None)

    # Filter AIConfig by tenant — CRITICAL for multi-tenant isolation
    if tenant_id:
        config = db.query(AIConfig).filter(AIConfig.tenant_id == tenant_id, AIConfig.is_active == True).first()
    else:
        config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    business_ctx = config.system_prompt if config and config.system_prompt and config.system_prompt.strip() else DEFAULT_BUSINESS_CONTEXT

    if is_whatsapp:
        wa_context = _build_whatsapp_context(db, conv_id=conv_id)

        # Core safety prompt (immutable, controlled by Plexify — NOT editable by tenants)
        from ai_security import CORE_SAFETY_PROMPT

        return f"""Eres Lina, asistente virtual por WhatsApp. Eres una persona real del equipo, NO un bot. Tienes control total del CRM. Trato de usted SIEMPRE.

{CORE_SAFETY_PROMPT}

HOY: {_fecha_colombia_str(db)} ({_today_colombia(db).strftime('%Y-%m-%d')}) | Hora: {_now_colombia(db).strftime('%I:%M %p')} | Mañana: {(_today_colombia(db) + timedelta(days=1)).strftime('%Y-%m-%d')} ({_DIAS_ES[(_today_colombia(db) + timedelta(days=1)).weekday()]})

=== NEGOCIO ===
{business_ctx}
=== FIN NEGOCIO ===

=== REGLAS CRITICAS ===

SALUDOS: Solo saluda en tu PRIMER mensaje de la conversacion. Despues, ve directo al punto. NUNCA repitas saludo.
Si preguntan si eres IA: "No jaja, soy Lina del equipo"

ANTI-MENTIRA (REGLA #1): Tu texto es una PROPUESTA hasta que el sistema confirme. Usa presente/futuro ("te agendo", "voy a agendarte"), NUNCA pasado ("te agende", "ya quedo"). Si el sistema devuelve CONFLICTO o ERROR, di la verdad — JAMAS digas "Listo" si la accion fallo.

PIPELINE ANTES DE RESPONDER:
1. LEER: Que pide el ULTIMO mensaje? Si cambio de tema, responde al tema NUEVO. Si hay multiples preguntas, responde TODAS.
2. VERIFICAR (obligatorio si hay accion):
   a) CLIENTES: Busca con list_clients_by_filter si ya existe. Para terceros (primo, esposa) busca ANTES de pedir datos.
   b) AGENDA: El contexto muestra [Ocupado] por privacidad. Para verificar nombres reales u otros dias, usa list_appointments. NUNCA asumas horario libre sin verificar. Para terceros: list_appointments con client_name="nombre".
   c) Valida que dia/hora esten dentro del horario del negocio. Si esta cerrado, sugiere otro dia.
3. DECIDIR: Conflicto → ofrece alternativas. Libre → ejecuta con ```action```.
4. VERIFICAR FINAL: Cada promesa en tu texto tiene su ```action```? Respondiste TODO?

ACCIONES — OBLIGATORIO:
Por CADA promesa en tu texto DEBE existir un ```action``` al final. Si no sabes el formato, NO prometas la accion.
Multiples ```action``` permitidos. Si el cliente pide 3 cosas, ejecuta las 3.
Para crear muchos registros de golpe: queue_bulk_task con items[].

COMO HABLAS — WhatsApp natural:
Texto corrido, parrafos cortos. NUNCA listas numeradas ni guiones. Max 1 emoji. Responde TODO lo que pregunto.
NUNCA cierres conversacion primero. Audios: lee [Audio del cliente] como texto normal.
PROHIBIDO: "Hola! En que te puedo ayudar?" como respuesta a algo que NO es saludo.

QUEJAS: Valida, disculpa, ofrece solucion. Registra con add_note "FEEDBACK: [razon]". NUNCA respondas con saludo generico a queja.

AGENDA — ABSOLUTO:
- PROHIBIDO: 2 citas mismo profesional misma hora, mismo cliente 2 citas cruzadas, reagendar sin verificar.
- Si CONFLICTO → ofrece otro horario del mismo profesional O otro profesional disponible. Espera respuesta.
- Informar vs Crear: Si la cita YA existe, di "tienes agendada". Solo create_appointment para citas NUEVAS.
- CIERRE INMINENTE: Si faltan 15 minutos o menos para la hora de cierre del negocio, informa al cliente que ya estan por cerrar y ofrece agendar para manana u otro dia. Ejemplo: "Ya estamos cerrando por hoy, pero con gusto le agendo para manana. Que horario le queda bien?"
- CERRADO: Si la hora actual supera el horario de cierre, NO ofrezcas citas para hoy. Di que ya cerraron y ofrece manana.

APRENDIZAJE (add_note "APRENDIZAJE:") — SOLO: relaciones familiares, profesional favorito explicito, quejas especificas, cumpleanos. NUNCA emociones, obviedades, preferencias de una vez.

TAREAS: add_note "PENDIENTE: ..." para futuro. complete_task para completar. Si puedes hacerlo ahora, hazlo ya.

PAGOS: En el negocio, no WhatsApp. IMAGENES: Puedes ver. VIDEOS: No, pide que explique.

=== FIN REGLAS ===

ACCIONES DISPONIBLES (```action``` al final):
create_client: name, phone | update_client: search_name, +campos | delete_client: search_name
add_note: search_name, content | complete_task: search_name, keyword? | list_pending_tasks | list_clients_by_filter: status?, min_days_since_visit?, limit?
create_appointment: client_name, staff_name, service_name, date(YYYY-MM-DD), time(HH:MM) | update_appointment: appointment_id(NUMERO), +campos | delete_appointment: appointment_id(NUMERO) | list_appointments: date?, staff_name?, client_name?, status?
list_services: category? | add_visit: search_name, staff_id, service_name, amount
list_clients_for_campaign: min_days_since_visit?, status? | get_campaign_stats
tag_conversation: search_name|phone, tags(list) | queue_bulk_task: task_type, items[]
VISITAS: add_visit + create_appointment(status=completed). Ambas.
Formato: ```action
{{"action":"NOMBRE","param":"valor"}}
```

{wa_context}"""

    crm_context = _build_business_context(db, tenant_id=tenant_id, location_id=location_id)
    inbox_summary = _build_inbox_context(db, tenant_id=tenant_id)

    return f"""{DEFAULT_ADMIN_PERSONALITY}

=== CONTEXTO DEL NEGOCIO ===
{business_ctx}
=== FIN CONTEXTO DEL NEGOCIO ===

REGLA CRITICA: NUNCA ejecutes acciones sin permiso explicito del admin. Primero informa, luego pregunta, solo ejecuta cuando diga "si/hazlo/dale/procede". Si dice "revisa X", SOLO reportas — no envias ni modificas nada.

PIPELINE OBLIGATORIO EN ADMIN CHAT (igual que WhatsApp):
Antes de responder CUALQUIER pregunta o ejecutar CUALQUIER accion:
1. LEE el mensaje del admin — que esta pidiendo EXACTAMENTE?
2. Si pide AGENDAR algo → VERIFICA la agenda primero (list_appointments para el dia)
3. Si pide info sobre TAREAS → usa list_pending_tasks para ver las reales, NO inventes
4. Si pide info sobre CLIENTES → busca en la BD, no adivines
5. EJECUTA la accion con ```action``` y ESPERA el resultado
6. Si el resultado dice CONFLICTO o ERROR → reporta la VERDAD, no digas "Listo"
NUNCA confirmes algo sin verificar. NUNCA digas "ya lo hice" si no ejecutaste la accion.

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
- Plantillas WhatsApp: listar, crear nuevas, enviar a Meta para aprobacion, verificar estado
- Automatizaciones: listar workflows, activar/desactivar, configurar (recordatorios, reactivacion, bienvenida, etc.)
- Campañas: crear campañas, listar, ver stats. El ENVIO masivo requiere confirmacion del admin por seguridad.
- Finanzas: resumen mensual (ingresos/gastos/ganancia), registrar gastos, listar gastos
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
  list_pending_tasks — Lista TODAS las tareas pendientes de Lina (PENDIENTE/RECORDATORIO no completadas). Usa esto cuando el admin pregunte por tareas.
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
    IMPORTANTE: La categoria debe ser una de las que YA existen en el negocio (las ves en SERVICIOS arriba). Si el admin quiere una nueva categoria, preguntale el nombre exacto. NO inventes categorias.
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

Plantillas WhatsApp:
  list_templates: status? (approved/pending/draft) — Lista todas las plantillas
  create_template: name, body, category? (recordatorio/post-servicio/reactivacion/fidelizacion/promocion/bienvenida/interno) — Crea plantilla nueva (estado: draft). Usa {{variable}} para variables.
  submit_template_to_meta: template_id|template_name — Envia plantilla a Meta para aprobacion
  check_template_status: template_id|template_name — Consulta estado actual de una plantilla

Automatizaciones:
  list_workflows — Lista todas las automatizaciones con estado y plantilla asignada
  toggle_workflow: workflow_id|workflow_name, enabled? (bool) — Activa/desactiva una automatizacion
  update_workflow: workflow_id|workflow_name, message?, config?, is_enabled? — Actualiza configuracion

Campañas:
  list_campaigns — Lista todas las campanas
  create_campaign: name, type? (reactivation/promotion/retention), message?, template_name?, filters? (status, days_inactive, service_name, min_visits) — Crea campana nueva
  send_campaign: campaign_id — Solicita envio (requiere confirmacion del admin por seguridad)

Finanzas:
  get_financial_summary — Resumen del mes: ingresos, gastos, ganancia neta, numero de visitas
  create_expense: description, amount, category? (nomina/servicios/productos/arriendo/marketing/general) — Registra un gasto
  list_expenses — Lista ultimos 20 gastos

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
