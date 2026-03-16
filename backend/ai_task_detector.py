# ============================================================================
# AI TASK DETECTOR — Auto-detects follow-up tasks from conversations
# After Lina responds to a client, this module analyzes the exchange
# and creates PENDIENTE tasks if follow-up is needed.
#
# Runs AFTER the response is sent (non-blocking for the client).
# Tasks are executed by the scheduler (_execute_pending_tasks).
# ============================================================================

import os
import json
import httpx
from datetime import datetime, timedelta
from database.connection import SessionLocal
from database.models import Client, ClientNote, WhatsAppConversation, WhatsAppMessage
from activity_log import log_event
from routes._helpers import now_colombia as _now_colombia


# ============================================================================
# PATTERN-BASED DETECTION (fast, no API call needed)
# ============================================================================

# Patterns that indicate the CLIENT needs follow-up
_CLIENT_FOLLOWUP_PATTERNS = {
    # Client will confirm later
    "confirm_later": {
        "patterns": [
            "mañana te confirmo", "luego te confirmo", "despues te confirmo",
            "te aviso", "te digo", "te confirmo", "yo te escribo",
            "deja y reviso", "deja reviso", "deja y miro", "voy a revisar",
            "lo pienso", "lo voy a pensar", "deja lo pienso",
            "mas tarde", "más tarde", "mas tardecito", "ahorita no puedo",
            "ahora no puedo", "estoy ocupad",
        ],
        "task_type": "follow_up",
        "delay_hours": 24,
        "description": "Cliente dijo que confirma después. Hacer follow-up.",
    },
    # Client asked about price but didn't book
    "price_no_book": {
        "patterns": [
            "cuanto cuesta", "cuánto cuesta", "cuanto vale", "cuánto vale",
            "que precio", "qué precio", "precio de", "precios",
            "cuanto es", "cuánto es", "cuanto sale", "cuánto sale",
        ],
        "negative_patterns": [  # If these appear in Lina's response, client DID engage
            "te agend", "queda agendad", "cita para", "confirmad",
        ],
        "task_type": "follow_up",
        "delay_hours": 3,
        "description": "Cliente preguntó precio pero no agendó. Follow-up suave.",
    },
    # Client can't make it this week
    "next_week": {
        "patterns": [
            "esta semana no", "no puedo esta semana", "la proxima semana",
            "la próxima semana", "otro dia", "otro día", "no me queda",
            "no me sirve", "no tengo tiempo", "ando full", "estoy full",
        ],
        "task_type": "follow_up",
        "delay_hours": 120,  # 5 days
        "description": "Cliente no puede esta semana. Contactar la próxima.",
    },
    # Client mentioned they'll come but no appointment
    "verbal_commit": {
        "patterns": [
            "voy a ir", "paso por alla", "paso por allá", "caigo por alla",
            "me acerco", "voy para alla", "voy para allá", "voy a pasar",
        ],
        "negative_patterns": [
            "te agend", "queda agendad", "cita para",
        ],
        "task_type": "follow_up",
        "delay_hours": 48,
        "description": "Cliente dijo que iría pero no agendó. Verificar.",
    },
}

# Patterns that indicate LINA should remember something about the client
_MEMORY_PATTERNS = {
    "time_preference": {
        "patterns": [
            "siempre en la (mañana|tarde|noche)",
            "prefiero (mañana|tarde|noche)",
            "solo puedo (mañana|tarde|noche|despues de las|antes de las)",
            "me queda mejor (mañana|tarde|noche)",
        ],
        "memory_type": "preference",
    },
    "staff_preference": {
        "patterns": [
            "siempre con (\\w+)", "prefiero con (\\w+)",
            "que me atienda (\\w+)", "solo con (\\w+)",
            "me gusta como (trabaja|corta|atiende) (\\w+)",
        ],
        "memory_type": "preference",
    },
}


def detect_tasks_from_conversation(
    conv_id: int,
    client_message: str,
    lina_response: str,
    client_id: int = None,
) -> list:
    """Analyze a conversation exchange and detect if follow-up tasks are needed.
    Returns list of tasks to create: [{type, description, delay_hours}]"""

    tasks = []
    client_lower = (client_message or "").lower()
    lina_lower = (lina_response or "").lower()

    for pattern_name, config in _CLIENT_FOLLOWUP_PATTERNS.items():
        # Check if client message matches any pattern
        matched = any(p in client_lower for p in config["patterns"])
        if not matched:
            continue

        # Check negative patterns (if Lina already handled it)
        neg_patterns = config.get("negative_patterns", [])
        if neg_patterns and any(p in lina_lower for p in neg_patterns):
            continue  # Lina already booked/handled it

        tasks.append({
            "type": config["task_type"],
            "description": config["description"],
            "delay_hours": config["delay_hours"],
            "trigger": pattern_name,
        })

    return tasks


def create_auto_tasks(conv_id: int, client_message: str, lina_response: str):
    """Main entry point: detect and create tasks from a conversation exchange.
    Called AFTER Lina responds (non-blocking)."""

    tasks = detect_tasks_from_conversation(conv_id, client_message, lina_response)

    if not tasks:
        return  # Nothing to do

    db = SessionLocal()
    try:
        # Get conversation and linked client
        conv = db.query(WhatsAppConversation).filter(
            WhatsAppConversation.id == conv_id
        ).first()
        if not conv or not conv.client_id:
            return  # No linked client — can't create task

        client = db.query(Client).filter(Client.id == conv.client_id).first()
        if not client:
            return

        now = _now_colombia()

        for task in tasks:
            # Check if a similar task already exists (avoid duplicates)
            from sqlalchemy import or_
            existing = (
                db.query(ClientNote)
                .filter(
                    ClientNote.client_id == client.id,
                    ClientNote.content.ilike(f"%PENDIENTE:%{task['trigger']}%"),
                    ~ClientNote.content.ilike("%COMPLETADO:%"),
                    ~ClientNote.content.ilike("%EXPIRADO:%"),
                )
                .first()
            )
            if existing:
                continue  # Already has a pending task for this

            # Calculate when to execute
            delay = timedelta(hours=task["delay_hours"])
            execute_at = now + delay

            # Format as PENDIENTE note (scheduler picks these up)
            if task["delay_hours"] < 1:
                time_hint = f"en {int(task['delay_hours'] * 60)} min"
            elif task["delay_hours"] < 24:
                time_hint = f"en {int(task['delay_hours'])} horas"
            else:
                days = int(task["delay_hours"] / 24)
                time_hint = f"en {days} dias"

            note_content = (
                f"PENDIENTE: [AUTO-{task['trigger'].upper()}] "
                f"{task['description']} | "
                f"Ejecutar {time_hint} ({execute_at.strftime('%d/%m %H:%M')}) | "
                f"Contexto: cliente dijo '{client_message[:80]}'"
            )

            note = ClientNote(
                client_id=client.id,
                content=note_content,
                created_by="Lina IA (auto-task)",
            )
            db.add(note)
            db.commit()

            client_first = (client.name or "").split()[0]
            print(f"[AUTO-TASK] Created {task['trigger']} for {client_first}: {task['description']}")
            log_event(
                "tarea",
                f"Auto-tarea creada: {task['description'][:50]}",
                detail=f"Cliente: {client_first} | Trigger: {task['trigger']} | Ejecutar: {time_hint}",
                contact_name=client_first,
                conv_id=conv_id,
                status="ok",
            )

    except Exception as e:
        print(f"[AUTO-TASK] Error creating auto-tasks: {e}")
    finally:
        db.close()
