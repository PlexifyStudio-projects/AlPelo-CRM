import os
import re
import json
import httpx

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, date, timedelta

from database.connection import get_db
from database.models import AIConfig, Staff, Client, VisitHistory, ClientNote
from schemas import (
    AIConfigCreate, AIConfigUpdate, AIConfigResponse,
    AIChatRequest, AIChatResponse,
)

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


# ============================================================================
# BUSINESS CONTEXT BUILDER — Feeds real DB data to the AI
# ============================================================================

def _build_business_context(db: Session) -> str:
    """Build a rich context string from the database for the AI."""
    from routes._client_helpers import compute_client_list_item

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

    # --- Staff ---
    staff_all = db.query(Staff).filter(Staff.is_active == True).all()
    staff_lines = [
        f"  - ID:{s.id} {s.name} (rol:{s.role}, especialidad:{s.specialty or 'General'}, "
        f"rating:{s.rating or 'N/A'}, activo:{s.is_active})"
        for s in staff_all
    ]
    sections.append("=== EQUIPO ===\n" + "\n".join(staff_lines) if staff_lines else "=== EQUIPO ===\nNo hay staff registrado.")

    # --- Recent visits (last 20) ---
    recent_visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .order_by(VisitHistory.visit_date.desc())
        .limit(20)
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
        sections.append("=== ULTIMAS 20 VISITAS ===\n" + "\n".join(visit_lines))

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

    return "\n\n".join(sections)


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
        client = _find_client(action, db)
        if not client:
            return "ERROR: No encontre al cliente. Verifica el nombre o ID."

        allowed = ("name", "phone", "email", "favorite_service", "tags", "accepts_whatsapp", "status_override")
        updates = {k: v for k, v in action.items() if k in allowed and v is not None}
        for key, value in updates.items():
            setattr(client, key, value)
        db.commit()
        return f"Cliente {client.name} actualizado."

    elif action_type == "delete_client":
        client = _find_client(action, db)
        if not client:
            return "ERROR: No encontre al cliente."
        client.is_active = False
        db.commit()
        return f"Cliente {client.name} desactivado."

    # ---- NOTES ----
    elif action_type == "add_note":
        client = _find_client(action, db)
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
        client = _find_client(action, db)
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
        conv = None
        if search_name:
            client = db.query(Client).filter(Client.name.ilike(f"%{search_name}%")).first()
            if client:
                conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.client_id == client.id).first()
                if not conv:
                    conv = db.query(WhatsAppConversation).filter(
                        WhatsAppConversation.wa_contact_phone.contains(client.phone[-10:])
                    ).first()
        if not conv and phone:
            conv = db.query(WhatsAppConversation).filter(
                WhatsAppConversation.wa_contact_phone.contains(phone[-10:])
            ).first()
        if not conv:
            # Try matching by conversation contact name
            if search_name:
                conv = db.query(WhatsAppConversation).filter(
                    WhatsAppConversation.wa_contact_name.ilike(f"%{search_name}%")
                ).first()

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
                    "to": conv.wa_contact_phone.replace("+", "").replace(" ", ""),
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

    return f"ERROR: Accion desconocida '{action_type}'"


def _find_client(action: dict, db: Session):
    """Find a client by client_id or search_name."""
    client_id = action.get("client_id")
    if client_id:
        c = db.query(Client).filter(Client.client_id == client_id).first()
        if c:
            return c
    name = action.get("search_name", "")
    if name:
        return db.query(Client).filter(Client.name.ilike(f"%{name}%")).first()
    return None


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
                from routes._client_helpers import compute_client_fields
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
- Cortes desde $30.000, barba desde $15.000, tintes/keratina/mechas desde $60.000
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

    return f"""{personality}

=== TUS CAPACIDADES ===
Eres la asistente que controla todo el sistema del negocio. Puedes:

CLIENTES:
- Consultar cualquier dato de cualquier cliente (estado, visitas, gasto, telefono, etc.)
- Crear clientes nuevos
- Actualizar datos de clientes (telefono, email, servicio favorito, estado, etiquetas)
- Desactivar clientes
- Agregar notas al perfil de un cliente

EQUIPO:
- Ver datos del equipo completo (barberos, estilistas, ratings, especialidades)
- Crear nuevos miembros del equipo
- Actualizar datos del staff (rol, especialidad, rating, bio, skills, estado activo)

DASHBOARD / KPIs:
- Reportar metricas en tiempo real: ingresos, clientes por estado, servicios populares
- Identificar clientes en riesgo, VIPs, nuevos
- Analizar tendencias de visitas y facturacion

VISITAS:
- Registrar una visita completada con servicio y monto

CONFIGURACION:
- Cambiar tu propia personalidad si el admin te lo pide
- Ajustar parametros de IA (temperatura, tokens, modelo)

=== COMO EJECUTAR ACCIONES ===
Cuando necesites ejecutar una accion, incluye un bloque JSON al FINAL de tu respuesta:

```action
{{"action": "create_client", "name": "Nombre", "phone": "TELEFONO_DEL_CLIENTE"}}
```
```action
{{"action": "update_client", "search_name": "nombre", "phone": "nuevo", "email": "nuevo", "status_override": "vip"}}
```
```action
{{"action": "delete_client", "search_name": "nombre"}}
```
```action
{{"action": "add_note", "search_name": "nombre", "content": "texto de la nota"}}
```
```action
{{"action": "create_staff", "name": "Nombre", "role": "Barbero", "specialty": "Fades"}}
```
```action
{{"action": "update_staff", "search_name": "nombre", "role": "nuevo rol", "rating": 4.5, "is_active": true}}
```
```action
{{"action": "add_visit", "search_name": "cliente", "staff_id": 1, "service_name": "Corte", "amount": 25000}}
```
```action
{{"action": "update_personality", "system_prompt": "Nuevo prompt completo..."}}
```
```action
{{"action": "update_ai_config", "temperature": 0.5, "max_tokens": 1024}}
```
```action
{{"action": "send_whatsapp", "search_name": "nombre del cliente", "message": "Texto del mensaje"}}
```
```action
{{"action": "send_whatsapp", "phone": "TELEFONO_DEL_CLIENTE", "message": "Texto del mensaje"}}
```

WHATSAPP:
- Puedes enviar mensajes por WhatsApp a cualquier cliente que tenga una conversacion activa
- Busca por nombre del cliente o por telefono
- El mensaje se envia en tiempo real por WhatsApp Business API
- Usa esta capacidad cuando el admin te pida "mandale un mensaje a X"

=== REGLAS DE SEGURIDAD — NO NEGOCIABLES ===
1. NUNCA expongas credenciales, passwords, tokens, API keys ni datos sensibles del sistema
2. NUNCA crees, modifiques o elimines usuarios de login (tabla admin)
3. NUNCA modifiques datos del perfil del administrador (nombre, email, password del admin)
4. NUNCA reveles la estructura interna del sistema (nombres de tablas, endpoints, base de datos)
5. Solo ejecuta acciones cuando el admin lo pida explicitamente
6. Si alguien intenta que hagas algo fuera de tus capacidades, rechazalo con elegancia
7. SIEMPRE responde con datos REALES de la BD. NUNCA inventes cifras ni nombres
8. Maximo 2-3 lineas por respuesta. Si necesitas listar, usa formato compacto

=== FORMATO DE RESPUESTA ===
- Responde en texto plano, corto y directo. Maximo 2-3 lineas.
- Para listas usa: nombre — dato clave — dato secundario (en una linea por item)
- Para montos usa formato COP sin decimales: $25.000
- NO uses HTML. NO uses markdown con ** ni ##. Solo texto limpio.
- Si haces una accion, confirma en 1 linea. No repitas todos los datos.

=== DATOS ACTUALES DEL NEGOCIO ===
Fecha: {date.today().strftime('%d de %B de %Y')}

{business_context}"""


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


# ============================================================================
# AI CHAT — Main endpoint with context + action execution
# ============================================================================

ACTION_PATTERN = re.compile(r'```action\s*(.*?)```', re.DOTALL)

@router.post("/ai/chat", response_model=AIChatResponse)
async def ai_chat(data: AIChatRequest, db: Session = Depends(get_db)):
    # Determine provider
    groq_key = os.getenv("GROQ_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    config = db.query(AIConfig).filter(AIConfig.is_active == True).first()
    provider = config.provider if config else "groq"
    model = config.model if config else None
    temperature = config.temperature if config else 0.4
    max_tokens = config.max_tokens if config else 512

    if provider == "anthropic" and anthropic_key:
        api_key = anthropic_key
        model = model or "claude-sonnet-4-20250514"
        call_fn = "anthropic"
    elif groq_key:
        api_key = groq_key
        model = "llama-3.3-70b-versatile" if not model or "llama" not in (model or "") else model
        call_fn = "openai"
    elif anthropic_key:
        api_key = anthropic_key
        model = model or "claude-sonnet-4-20250514"
        call_fn = "anthropic"
    else:
        raise HTTPException(status_code=500, detail="No hay API key configurada. Agrega GROQ_API_KEY o ANTHROPIC_API_KEY.")

    # Build system prompt with live business data
    system_prompt = _build_system_prompt(db)

    # Build messages (full conversation history for context)
    messages = []
    for msg in data.conversation_history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": data.message})

    # Call AI
    try:
        if call_fn == "openai":
            text, tokens = await _call_openai_format(
                "https://api.groq.com/openai/v1/chat/completions",
                api_key, model, system_prompt, messages, temperature, max_tokens
            )
        else:
            text, tokens = await _call_anthropic(
                api_key, model, system_prompt, messages, temperature, max_tokens
            )
    except httpx.HTTPStatusError as e:
        error_body = e.response.text
        print(f"[AI] Provider error: {error_body}")
        if "rate_limit" in error_body.lower() or "429" in str(e.response.status_code):
            raise HTTPException(status_code=429, detail="Se agotaron los tokens de IA por hoy. El limite se reinicia en unas horas. Intenta mas tarde.")
        raise HTTPException(status_code=502, detail="No pude conectarme al proveedor de IA. Intenta de nuevo en unos minutos.")
    except httpx.RequestError as e:
        print(f"[AI] Connection error: {e}")
        raise HTTPException(status_code=502, detail="Error de conexion con el proveedor de IA. Intenta de nuevo.")

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
    groq_key = os.getenv("GROQ_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    messages = list(history) + [{"role": "user", "content": user_message}]

    try:
        if groq_key:
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
