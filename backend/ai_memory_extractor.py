"""
AI Memory Extractor — Extract long-term memories from WhatsApp conversations.

After each conversation, Claude analyzes the chat and extracts important
information worth remembering permanently (preferences, complaints, patterns).

These memories are stored with embeddings in client_memory for semantic search.
"""

import os
import json
import httpx
from typing import List, Dict, Optional
from datetime import datetime
from database.connection import SessionLocal
from database.models import ClientMemory, WhatsAppConversation, WhatsAppMessage, Client

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def _safe_parse_embedding(emb) -> Optional[list]:
    """Safely parse an embedding from DB — handles str, list, None, corrupted values."""
    if emb is None:
        return None
    if isinstance(emb, list):
        return emb
    if isinstance(emb, str):
        try:
            parsed = json.loads(emb)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass
    return None

EXTRACTION_PROMPT = """Analiza esta conversación de WhatsApp entre un cliente y Lina (asistente del negocio).

Extrae SOLO información que sea útil recordar A LARGO PLAZO para futuras conversaciones.

TIPOS DE MEMORIA:
- preference: Preferencias del cliente (profesional favorito, horario preferido, servicio usual)
- pattern: Patrones de comportamiento (siempre viene los viernes, siempre pregunta por precios primero)
- complaint: Quejas o problemas recurrentes (no le gusta esperar, tuvo mala experiencia con X)
- allergy: Alergias o restricciones (alérgico al gel, no puede ciertos productos)
- insight: Datos personales relevantes (cumpleaños, trabajo, familia, mascotas)
- note: Otra información relevante que no encaje en las categorías anteriores

REGLAS:
1. SOLO extrae información NUEVA y RELEVANTE para el servicio
2. NO extraigas saludos, despedidas o conversación trivial
3. NO extraigas información que ya está en el sistema (nombre, teléfono, etc.)
4. Cada memoria debe ser una frase CLARA y CONCRETA
5. Máximo 5 memorias por conversación
6. Si NO hay información relevante, retorna un array vacío []
7. Asigna confidence: 1.0 si el cliente lo dijo explícitamente, 0.7 si es inferido

CONVERSACIÓN:
{conversation}

Responde SOLO con un JSON array válido. NADA más. Sin markdown, sin explicación.
Ejemplo: [{"type": "preference", "content": "Prefiere corte con Alexander los viernes después de las 5pm", "confidence": 1.0}]
Si no hay nada relevante: []"""


def extract_memories_from_conversation(conv_id: int) -> List[Dict]:
    """Extract memories from a conversation using Claude.

    Returns list of dicts: [{"type": str, "content": str, "confidence": float}]
    """
    if not ANTHROPIC_API_KEY:
        print("[MEMORY EXTRACTOR] No ANTHROPIC_API_KEY — skipping")
        return []

    db = SessionLocal()
    try:
        # Get conversation with client info
        conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
        if not conv or not conv.client_id:
            return []  # Only extract for known clients

        # Get last 20 messages from this conversation
        messages = (
            db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.conversation_id == conv_id)
            .order_by(WhatsAppMessage.created_at.desc())
            .limit(20)
            .all()
        )
        messages.reverse()

        if len(messages) < 3:
            return []  # Too short to extract anything meaningful

        # Build conversation text
        conv_text = ""
        for m in messages:
            sender = "Cliente" if m.direction == "inbound" else "Lina"
            conv_text += f"{sender}: {m.content}\n"

        # Call Claude to extract memories
        # Use replace instead of .format() to avoid interpreting {action...} in conv_text as format placeholders
        prompt = EXTRACTION_PROMPT.replace("{conversation}", conv_text)

        try:
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",  # Same model Lina uses — precise extraction matters
                        "max_tokens": 500,
                        "temperature": 0.1,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                data = resp.json()

                if resp.status_code != 200:
                    print(f"[MEMORY EXTRACTOR] Claude API returned {resp.status_code}: {data.get('error', {}).get('message', str(data)[:200])}")
                    return []

                if "content" not in data or not data["content"]:
                    print(f"[MEMORY EXTRACTOR] No content in Claude response: {data.get('error', '')}")
                    return []

                raw_text = data["content"][0].get("text", "").strip()

                # Parse JSON — handle potential markdown wrapping
                if raw_text.startswith("```"):
                    raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

                memories = json.loads(raw_text)

                if not isinstance(memories, list):
                    return []

                # Validate structure
                valid = []
                for m in memories[:5]:  # Max 5
                    if isinstance(m, dict) and "type" in m and "content" in m:
                        valid.append({
                            "type": m["type"],
                            "content": m["content"],
                            "confidence": float(m.get("confidence", 0.8)),
                        })

                print(f"[MEMORY EXTRACTOR] Extracted {len(valid)} memories from conv {conv_id}")
                return valid

        except json.JSONDecodeError as e:
            print(f"[MEMORY EXTRACTOR] JSON parse error: {e}")
            return []
        except Exception as e:
            print(f"[MEMORY EXTRACTOR] Claude API error: {e}")
            return []

    finally:
        db.close()


def save_memories_sync(conv_id: int):
    """Extract and save memories from a conversation. Runs in a background thread.
    Fully synchronous — no asyncio needed."""
    from ai_embeddings import create_embedding_sync, cosine_similarity

    # Small delay to let the main reply finish and DB settle
    import time
    time.sleep(3)

    db = SessionLocal()
    try:
        # Get conversation to find client
        conv = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conv_id).first()
        if not conv or not conv.client_id:
            return

        # Get tenant from the conversation's tenant_id (set by webhook)
        from database.models import Tenant
        conv_tenant_id = getattr(conv, 'tenant_id', None)
        if conv_tenant_id:
            tenant_id = conv_tenant_id
        else:
            tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
            tenant_id = tenant.id if tenant else 1

        # Extract memories using Claude
        memories = extract_memories_from_conversation(conv_id)
        if not memories:
            return

        saved_count = 0
        for mem in memories:
            # Generate embedding for deduplication and future search
            embedding = create_embedding_sync(mem["content"])

            # Deduplication: check if a similar memory already exists for this client
            if embedding:
                existing_memories = (
                    db.query(ClientMemory)
                    .filter(
                        ClientMemory.client_id == conv.client_id,
                        ClientMemory.is_active == True,
                    )
                    .all()
                )

                is_duplicate = False
                for existing in existing_memories:
                    if existing.embedding:
                        try:
                            existing_emb = _safe_parse_embedding(existing.embedding)
                            if not existing_emb:
                                continue
                            sim = cosine_similarity(embedding, existing_emb)
                            if sim > 0.9:
                                # Update existing memory instead of creating duplicate
                                existing.content = mem["content"]
                                existing.confidence = max(existing.confidence or 0, mem["confidence"])
                                existing.embedding = json.dumps(embedding)
                                existing.updated_at = datetime.utcnow()
                                db.commit()
                                print(f"[MEMORY] Updated existing memory (sim={sim:.2f}): {mem['content'][:60]}")
                                is_duplicate = True
                                saved_count += 1
                                break
                        except Exception:
                            continue

                if is_duplicate:
                    continue

            # Save new memory
            new_memory = ClientMemory(
                tenant_id=tenant_id,
                client_id=conv.client_id,
                memory_type=mem["type"],
                content=mem["content"],
                embedding=json.dumps(embedding) if embedding else None,
                source="conversation",
                confidence=mem["confidence"],
                is_active=True,
            )
            db.add(new_memory)
            db.commit()
            saved_count += 1
            print(f"[MEMORY] Saved: [{mem['type']}] {mem['content'][:60]}")

        if saved_count > 0:
            from activity_log import log_event
            log_event(
                "sistema",
                f"Memoria actualizada — {saved_count} recuerdo(s) guardado(s)",
                detail=f"Conversacion {conv_id}: {', '.join(m['content'][:40] for m in memories[:3])}",
                conv_id=conv_id,
                status="ok",
            )

    except Exception as e:
        print(f"[MEMORY] Error saving memories for conv {conv_id}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


def get_relevant_memories(client_id: int, query_text: str, limit: int = 5) -> List[Dict]:
    """Retrieve relevant memories for a client based on the current message.

    Uses vector similarity if embeddings are available, otherwise returns recent memories.
    """
    from ai_embeddings import create_embedding_sync, cosine_similarity

    db = SessionLocal()
    try:
        all_memories = (
            db.query(ClientMemory)
            .filter(
                ClientMemory.client_id == client_id,
                ClientMemory.is_active == True,
            )
            .order_by(ClientMemory.updated_at.desc())
            .all()
        )

        if not all_memories:
            return []

        # Try vector search first
        query_embedding = create_embedding_sync(query_text)

        if query_embedding:
            # Score all memories by cosine similarity
            scored = []
            for mem in all_memories:
                mem_emb = _safe_parse_embedding(mem.embedding)
                if mem_emb:
                    try:
                        sim = cosine_similarity(query_embedding, mem_emb)
                        scored.append((mem, sim))
                    except Exception:
                        scored.append((mem, 0.3))  # Low default score
                else:
                    scored.append((mem, 0.3))

            # Sort by similarity, take top N
            scored.sort(key=lambda x: x[1], reverse=True)
            results = []
            for mem, sim in scored[:limit]:
                if sim > 0.2:  # Minimum relevance threshold
                    results.append({
                        "type": mem.memory_type,
                        "content": mem.content,
                        "confidence": mem.confidence or 1.0,
                        "similarity": round(sim, 2),
                    })
            return results
        else:
            # No embeddings available — return most recent memories
            return [
                {
                    "type": mem.memory_type,
                    "content": mem.content,
                    "confidence": mem.confidence or 1.0,
                    "similarity": None,
                }
                for mem in all_memories[:limit]
            ]

    except Exception as e:
        print(f"[MEMORY] Error retrieving memories for client {client_id}: {e}")
        return []
    finally:
        db.close()
