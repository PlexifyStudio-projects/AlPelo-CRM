"""
Business Context Builder — Feeds real DB data to the AI.
Extracted from ai_endpoints.py during Phase 6 refactor.
"""
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from database.models import (
    Client, Staff, Service, Appointment, VisitHistory, ClientNote,
    WhatsAppConversation, WhatsAppMessage, Tenant, Location, StaffLocation,
    ClientSubscription,
)


def _get_tenant_offset(db=None, tenant_id=None) -> timedelta:
    """Get timezone offset for tenant (lazy import to avoid circular)."""
    from routes.ai_endpoints import _get_tenant_offset as _orig
    return _orig(db, tenant_id)

def _today_colombia(db=None) -> date:
    from routes.ai_endpoints import _today_colombia as _orig
    return _orig(db)

def compute_client_list_item(c, db):
    from routes.search_endpoints import compute_client_list_item as _orig
    return _orig(c, db)


def _build_business_context(db: Session, tenant_id: int = None, location_id: int = None) -> str:
    """Build a rich context string from the database for the AI.
    Filters by tenant_id (ALWAYS) and location_id (when multi-location)."""
    from database.models import Location, StaffLocation

    sections = []

    # --- Business type context — Lina adapts behavior per business type ---
    if tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            btype = getattr(tenant, 'business_type', 'otro') or 'otro'
            BUSINESS_CONTEXT = {
                'peluqueria': 'PELUQUERIA/BARBERIA. Servicios: cortes, tintes, tratamientos capilares. Modelo: citas por sesion (20-90 min). Al agendar pregunte que servicio y con cual profesional.',
                'barberia': 'BARBERIA. Servicios: cortes, barba, afeitado. Modelo: citas por sesion (15-50 min). Al agendar pregunte que corte desea.',
                'spa': 'SPA/CENTRO DE BIENESTAR. Servicios: masajes, faciales, circuitos de aguas. Modelo: citas por sesion (45-180 min). Pregunte si tiene preferencia de terapeuta.',
                'centro_estetico': 'CENTRO ESTETICO. Servicios: faciales, laser, depilacion, diseno de cejas. Modelo: citas por sesion + paquetes de sesiones. Pregunte si quiere sesion individual o paquete.',
                'clinica': 'CLINICA/CONSULTORIO. Servicios: consultas, controles, examenes. Modelo: citas medicas (15-45 min). Pregunte motivo de consulta y especialidad.',
                'odontologia': 'ODONTOLOGIA. Servicios: limpieza, blanqueamiento, ortodoncia, cirugia. Modelo: citas (30-60 min). Pregunte si es control o procedimiento nuevo.',
                'fisioterapia': 'FISIOTERAPIA/REHABILITACION. Servicios: sesiones de terapia, evaluaciones. Modelo: citas + paquetes (ej: 10 sesiones). Pregunte si tiene sesiones pendientes del paquete.',
                'psicologia': 'PSICOLOGIA/TERAPIA. Servicios: sesiones individuales, de pareja. Modelo: citas (50-60 min). Trate con maxima confidencialidad. Pregunte si es sesion de seguimiento o primera vez.',
                'veterinaria': 'VETERINARIA. Servicios: consultas, vacunas, peluqueria canina, guarderia. Modelo: citas + reservas (guarderia). Pregunte nombre de la mascota y especie.',
                'nutricion': 'NUTRICION/DIETETICA. Servicios: consultas, planes alimenticios, controles. Modelo: citas + programas de meses. Pregunte si es primera consulta o control.',
                'gimnasio': 'GIMNASIO/FITNESS. Servicios: membresias (mensual/trimestral/anual), clases personales. Modelo: PAQUETES con vigencia en dias. NO agenda citas por sesion, vende membresias. Pregunte que plan le interesa.',
                'academia': 'ACADEMIA/EDUCACION. Servicios: clases individuales, cursos, talleres. Modelo: citas + paquetes (cursos con duracion). Pregunte que curso le interesa.',
                'yoga_pilates': 'YOGA/PILATES. Servicios: clases grupales, personales, planes ilimitados. Modelo: citas + paquetes. Pregunte si quiere clase suelta o plan mensual.',
                'restaurante': 'RESTAURANTE/CAFETERIA. Servicios: mesas por capacidad. Modelo: RESERVAS de espacio. NO citas. Pregunte cuantas personas, fecha y hora.',
                'hotel': 'HOTEL/HOSPEDAJE. Servicios: habitaciones, day pass. Modelo: RESERVAS por noches. Pregunte fechas de entrada y salida, tipo de habitacion.',
                'tatuajes': 'ESTUDIO DE TATUAJES/PIERCING. Servicios: tatuajes (chico/mediano/grande), piercing. Modelo: citas (60-240 min). Pregunte tamano y ubicacion del tatuaje, si tiene diseno.',
                'estudio_foto': 'ESTUDIO FOTOGRAFICO. Servicios: sesiones individuales, familiares, corporativas. Modelo: citas + reservas (eventos). Pregunte tipo de sesion y cuantas personas.',
                'taller_mecanico': 'TALLER MECANICO. Servicios: diagnosticos, mantenimiento, reparaciones. Modelo: citas (30-45 min). Pregunte marca/modelo del vehiculo y que problema tiene.',
                'lavanderia': 'LAVANDERIA/TINTORERIA. Servicios: lavado, planchado, lavado en seco. Modelo: entregas con tiempo de procesamiento. Pregunte que prendas necesita y para cuando las necesita.',
                'consultoria': 'CONSULTORIA/ASESORIA. Servicios: sesiones de asesoria, planes mensuales. Modelo: citas + paquetes. Pregunte tema de la consulta.',
            }
            ctx = BUSINESS_CONTEXT.get(btype, f'Tipo de negocio: {btype}. Adapte las respuestas al contexto de este negocio.')
            sections.append(f"=== TIPO DE NEGOCIO ===\n{ctx}\n")

    # --- Location header (if multi-location) ---
    if location_id:
        loc = db.query(Location).filter(Location.id == location_id).first()
        if loc:
            sections.append(f"=== UBICACION ACTIVA ===\nSede: {loc.name}\nDireccion: {loc.address or 'No definida'}\nHorario: {loc.opening_time or '08:00'} - {loc.closing_time or '19:00'}\nIMPORTANTE: La informacion que ves es EXCLUSIVAMENTE de esta sede.\n")

    # --- KPIs ---
    clients_q = db.query(Client).filter(Client.is_active == True)
    if tenant_id:
        clients_q = clients_q.filter(Client.tenant_id == tenant_id)
    clients_all = clients_q.all()
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
    staff_q = db.query(Staff).filter(Staff.is_active == True)
    staff_iq = db.query(Staff).filter(Staff.is_active == False)
    if tenant_id:
        staff_q = staff_q.filter(Staff.tenant_id == tenant_id)
        staff_iq = staff_iq.filter(Staff.tenant_id == tenant_id)
    if location_id:
        loc_staff_ids = [sl.staff_id for sl in db.query(StaffLocation).filter(StaffLocation.location_id == location_id).all()]
        if loc_staff_ids:
            staff_q = staff_q.filter(Staff.id.in_(loc_staff_ids))
            staff_iq = staff_iq.filter(Staff.id.in_(loc_staff_ids))
        else:
            # No staff assigned to location — fall back to primary_location
            staff_q = staff_q.filter(Staff.primary_location_id == location_id)
            staff_iq = staff_iq.filter(Staff.primary_location_id == location_id)
    staff_active = staff_q.all()
    staff_inactive = staff_iq.all()
    staff_lines = [f"  - ID:{s.id} {s.name} ({s.role})" for s in staff_active]
    if staff_inactive:
        staff_lines.append("  --- DESACTIVADOS ---")
        staff_lines.extend([f"  - ID:{s.id} {s.name} ({s.role}) [INACTIVO]" for s in staff_inactive])
    sections.append("=== EQUIPO ===\n" + "\n".join(staff_lines) if staff_lines else "=== EQUIPO ===\nNo hay staff.")

    # --- Recent visits (last 10) ---
    visits_q = db.query(VisitHistory).filter(VisitHistory.status == "completed")
    if tenant_id:
        visits_q = visits_q.filter(VisitHistory.tenant_id == tenant_id)
    if location_id:
        visits_q = visits_q.filter(VisitHistory.location_id == location_id)
    recent_visits = visits_q.order_by(VisitHistory.visit_date.desc()).limit(10).all()
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
    top_q = db.query(VisitHistory.service_name, func.count().label("cnt"), func.sum(VisitHistory.amount).label("total")).filter(VisitHistory.status == "completed")
    if tenant_id:
        top_q = top_q.filter(VisitHistory.tenant_id == tenant_id)
    if location_id:
        top_q = top_q.filter(VisitHistory.location_id == location_id)
    top_services = top_q.group_by(VisitHistory.service_name).order_by(func.count().desc()).limit(10).all()
    if top_services:
        svc_lines = [f"  - {s.service_name}: {s.cnt} veces, ${s.total:,} COP" for s in top_services]
        sections.append("=== SERVICIOS MAS POPULARES ===\n" + "\n".join(svc_lines))

    # --- Service catalog (compact: name, price, duration only) — SHARED across locations ---
    svc_cat_q = db.query(Service).filter(Service.is_active == True)
    if tenant_id:
        svc_cat_q = svc_cat_q.filter(Service.tenant_id == tenant_id)
    all_services = svc_cat_q.order_by(Service.category, Service.name).all()
    if all_services:
        catalog_lines = []
        current_cat = None
        for svc in all_services:
            if svc.category != current_cat:
                current_cat = svc.category
                catalog_lines.append(f"\n  [{current_cat}]")
            stype = getattr(svc, 'service_type', 'cita') or 'cita'
            if stype == 'paquete':
                dur = svc.duration_minutes
                vigencia = f" vigencia {dur} dias" if dur else ""
                catalog_lines.append(f"  - {svc.name} [PAQUETE]: ${svc.price:,}{vigencia}")
            elif stype == 'reserva':
                dur = svc.duration_minutes
                duracion = f" {dur}min" if dur and dur < 1440 else f" {round(dur/1440)} noche(s)" if dur else ""
                catalog_lines.append(f"  - {svc.name} [RESERVA]: ${svc.price:,}{duracion}")
            else:
                duration = f" {svc.duration_minutes}min" if svc.duration_minutes else ""
                catalog_lines.append(f"  - {svc.name}: ${svc.price:,}{duration}")
        sections.append(f"=== SERVICIOS ({len(all_services)}) ===\n" + "\n".join(catalog_lines))

    # --- Upcoming appointments (today + next 3 days) ---
    today = _today_colombia(db)
    upcoming_end = today + timedelta(days=3)
    apt_q = db.query(Appointment).filter(Appointment.date >= today, Appointment.date <= upcoming_end)
    if tenant_id:
        apt_q = apt_q.filter(Appointment.tenant_id == tenant_id)
    if location_id:
        apt_q = apt_q.filter(Appointment.location_id == location_id)
    upcoming_apts = apt_q.order_by(Appointment.date, Appointment.time).all()
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

    # --- Global learnings (admin-taught rules — SHARED across locations) ---
    from database.models import LinaLearning
    learn_q = db.query(LinaLearning).filter(LinaLearning.is_active == True)
    if tenant_id:
        learn_q = learn_q.filter(LinaLearning.tenant_id == tenant_id)
    global_learnings = learn_q.order_by(LinaLearning.created_at.desc()).all()
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

    # --- Client Intelligence: Revenue forecast + at-risk clients ---
    try:
        from client_intelligence import forecast_revenue, get_reconnect_candidates
        # Get first active tenant for forecast
        _tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
        if _tenant:
            fc7 = forecast_revenue(_tenant.id, days=7, db=db)
            fc30 = forecast_revenue(_tenant.id, days=30, db=db)
            reconnect = get_reconnect_candidates(_tenant.id, limit=10, db=db)

            intel_lines = [
                f"Proyeccion ingresos 7 dias: ${fc7.get('total_forecast', 0):,} COP ({fc7.get('confirmed_appointments', 0)} citas confirmadas)",
                f"Proyeccion ingresos 30 dias: ${fc30.get('total_forecast', 0):,} COP",
                f"Promedio diario historico: ${fc7.get('daily_avg_historical', 0):,} COP",
            ]

            if reconnect:
                intel_lines.append(f"\nClientes que necesitan atencion ({len(reconnect)}):")
                for rc in reconnect[:5]:
                    intel_lines.append(f"  - {rc['client_name']}: {rc['days_since']}d sin venir (ciclo: {rc['avg_cycle']}d) | Staff: {rc.get('preferred_staff', 'sin preferencia')}")

            sections.append("=== INTELIGENCIA DE NEGOCIO ===\n" + "\n".join(intel_lines))
    except Exception as intel_err:
        print(f"[AI] Client intelligence context error: {intel_err}")

    return "\n\n".join(sections)


def _build_inbox_context(db: Session, tenant_id: int = None) -> str:
    """Build WhatsApp inbox summary for AI context — includes last messages."""
    conv_q = db.query(WhatsAppConversation)
    if tenant_id:
        conv_q = conv_q.filter(WhatsAppConversation.tenant_id == tenant_id)
    convs = conv_q.order_by(WhatsAppConversation.last_message_at.desc()).limit(20).all()
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


