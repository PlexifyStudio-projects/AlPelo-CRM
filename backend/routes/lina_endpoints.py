"""
Lina IA Endpoints — Activity monitoring, learnings, client memory, health check.
Moved from main.py for better organization.
"""

import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database.connection import get_db, SessionLocal
from database.models import (
    ClientNote, Client, LinaLearning, ClientMemory, Tenant, LinaTask,
)
from activity_log import get_recent_events, get_stats as get_activity_stats
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter(prefix="/lina", tags=["Lina IA"])


# ============================================================================
# ACTIVITY LOG
# ============================================================================

@router.get("/activity")
async def lina_activity(limit: int = 100, offset: int = 0, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Real-time Lina activity events for the monitoring dashboard."""
    tid = safe_tid(user, db)
    events = get_recent_events(limit=limit, offset=offset, tenant_id=tid)
    stats = get_activity_stats(tenant_id=tid)
    return {"events": events, "stats": stats}


# ============================================================================
# MEMORY — Consolidated view (learnings + client notes + pgvector memories)
# ============================================================================

@router.get("/memory")
async def lina_memory(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get ALL of Lina's knowledge: global learnings + per-client patterns + long-term memories."""
    tid = safe_tid(user, db)
    # Global learnings (admin-taught rules)
    q_learn = db.query(LinaLearning).filter(LinaLearning.is_active == True)
    if tid:
        q_learn = q_learn.filter(LinaLearning.tenant_id == tid)
    learnings = q_learn.order_by(LinaLearning.created_at.desc()).all()
    global_items = [{
        "id": f"L{l.id}",
        "type": "regla",
        "category": l.category,
        "client_name": "General",
        "content": l.content[:400],
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in learnings]

    # Per-client learnings + feedback (from notes)
    q_notes = db.query(ClientNote).filter(or_(
        ClientNote.content.ilike("%APRENDIZAJE:%"),
        ClientNote.content.ilike("%FEEDBACK:%"),
    ))
    if tid:
        q_notes = q_notes.filter(ClientNote.tenant_id == tid)
    notes = q_notes.order_by(ClientNote.created_at.desc()).limit(50).all()
    client_items = []
    for n in notes:
        client = db.query(Client).filter(Client.id == n.client_id).first()
        content = n.content or ""
        if "APRENDIZAJE:" in content:
            mem_type, text = "aprendizaje", content.split("APRENDIZAJE:")[-1].strip()
        elif "FEEDBACK:" in content:
            mem_type, text = "feedback", content.split("FEEDBACK:")[-1].strip()
        else:
            mem_type, text = "otro", content
        client_items.append({
            "id": f"N{n.id}",
            "type": mem_type,
            "client_name": client.name if client else "?",
            "content": text[:300],
            "created_at": n.created_at.isoformat() if n.created_at else None,
        })

    # Long-term memories (pgvector client_memory table)
    long_term = []
    try:
        q_mem = db.query(ClientMemory).filter(ClientMemory.is_active == True)
        if tid:
            q_mem = q_mem.filter(ClientMemory.tenant_id == tid)
        lt_memories = q_mem.order_by(ClientMemory.updated_at.desc()).limit(50).all()
        for m in lt_memories:
            client = db.query(Client).filter(Client.id == m.client_id).first()
            long_term.append({
                "id": f"M{m.id}",
                "type": f"memoria_{m.memory_type}",
                "category": m.memory_type,
                "client_name": client.name if client else "?",
                "content": m.content[:300],
                "source": m.source,
                "confidence": m.confidence,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })
    except Exception as e:
        print(f"[LINA] Error loading long-term memories: {e}")

    all_items = global_items + client_items + long_term
    return {
        "total": len(all_items),
        "global_count": len(global_items),
        "client_count": len(client_items),
        "longterm_count": len(long_term),
        "items": all_items,
    }


# ============================================================================
# LEARNINGS — Global rules taught by admin
# ============================================================================

@router.get("/learnings")
async def list_learnings(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List all active global learnings."""
    tid = safe_tid(user, db)
    q = db.query(LinaLearning).filter(LinaLearning.is_active == True)
    if tid:
        q = q.filter(LinaLearning.tenant_id == tid)
    items = q.order_by(LinaLearning.created_at.desc()).all()
    return [{
        "id": l.id,
        "category": l.category,
        "content": l.content,
        "original_input": l.original_input,
        "created_by": l.created_by,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in items]


@router.post("/learnings")
async def create_learning(request: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Admin teaches Lina something new. AI processes and stores it."""
    tid = safe_tid(user, db)
    raw_input = (request.get("content") or "").strip()
    category = (request.get("category") or "general").strip().lower()

    if not raw_input:
        raise HTTPException(status_code=400, detail="Contenido vacio")

    processed = await _process_learning(raw_input, category)

    learning = LinaLearning(
        tenant_id=tid,
        category=category,
        original_input=raw_input,
        content=processed,
        created_by="admin",
    )
    db.add(learning)
    db.commit()
    db.refresh(learning)
    return {
        "id": learning.id,
        "category": learning.category,
        "content": learning.content,
        "original_input": learning.original_input,
        "created_at": learning.created_at.isoformat() if learning.created_at else None,
    }


@router.delete("/learnings/{learning_id}")
async def delete_learning(learning_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Soft-delete a global learning."""
    tid = safe_tid(user, db)
    item = db.query(LinaLearning).filter(LinaLearning.id == learning_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="No encontrado")
    if tid and item.tenant_id != tid:
        raise HTTPException(status_code=403, detail="No autorizado")
    item.is_active = False
    db.commit()
    return {"ok": True}


# ============================================================================
# CLIENT MEMORIES — Long-term AI memory per client (pgvector Phase 4)
# ============================================================================

@router.get("/client-memories/{client_id}")
async def get_client_memories(client_id: int, db: Session = Depends(get_db)):
    """Get all long-term memories for a specific client."""
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    memories = (
        db.query(ClientMemory)
        .filter(ClientMemory.client_id == client_id, ClientMemory.is_active == True)
        .order_by(ClientMemory.updated_at.desc())
        .all()
    )
    return {
        "client_id": client_id,
        "client_name": client.name,
        "total": len(memories),
        "memories": [{
            "id": m.id,
            "type": m.memory_type,
            "content": m.content,
            "source": m.source,
            "confidence": m.confidence,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        } for m in memories],
    }


@router.delete("/client-memories/{memory_id}")
async def delete_client_memory(memory_id: int, db: Session = Depends(get_db)):
    """Soft-delete a specific client memory."""
    mem = db.query(ClientMemory).filter(ClientMemory.id == memory_id).first()
    if not mem:
        raise HTTPException(status_code=404, detail="Memoria no encontrada")
    mem.is_active = False
    db.commit()
    return {"ok": True, "message": "Memoria eliminada"}


@router.post("/client-memories")
async def create_client_memory_manual(request: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Admin manually adds a memory for a client."""
    client_id = request.get("client_id")
    content = (request.get("content") or "").strip()
    memory_type = request.get("type", "note")

    if not client_id or not content:
        raise HTTPException(status_code=400, detail="client_id y content son requeridos")

    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    # Get tenant from authenticated user, fallback to client's tenant_id
    tid = safe_tid(user, db)
    client_tenant_id = getattr(client, 'tenant_id', None)
    if tid:
        tenant_id = tid
        # Verify client belongs to this tenant
        if client_tenant_id and client_tenant_id != tid:
            raise HTTPException(status_code=403, detail="Cliente no pertenece a tu negocio")
    elif client_tenant_id:
        tenant_id = client_tenant_id
    else:
        raise HTTPException(status_code=403, detail="No tenant asociado")

    # Generate embedding
    embedding_json = None
    try:
        from ai_embeddings import create_embedding_sync
        import json
        embedding = create_embedding_sync(content)
        if embedding:
            embedding_json = json.dumps(embedding)
    except Exception:
        pass  # Embeddings are optional — memory still saved without them

    mem = ClientMemory(
        tenant_id=tenant_id,
        client_id=client_id,
        memory_type=memory_type,
        content=content,
        embedding=embedding_json,
        source="admin_note",
        confidence=1.0,
        is_active=True,
    )
    db.add(mem)
    db.commit()
    db.refresh(mem)
    return {
        "id": mem.id,
        "type": mem.memory_type,
        "content": mem.content,
        "source": mem.source,
        "created_at": mem.created_at.isoformat() if mem.created_at else None,
    }


# ============================================================================
# TASKS — Background bulk task progress
# ============================================================================

@router.get("/tasks")
async def list_lina_tasks(
    tenant_id: int = None,
    status: str = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """List all background tasks, optionally filtered by tenant and status."""
    import json as _json

    q = db.query(LinaTask).order_by(LinaTask.created_at.desc())
    if tenant_id:
        q = q.filter(LinaTask.tenant_id == tenant_id)
    if status:
        q = q.filter(LinaTask.status == status)
    tasks = q.limit(limit).all()

    return [{
        "id": t.id,
        "tenant_id": t.tenant_id,
        "task_type": t.task_type,
        "description": t.description,
        "total_items": t.total_items,
        "completed_items": t.completed_items,
        "status": t.status,
        "progress_pct": round((t.completed_items / t.total_items * 100) if t.total_items > 0 else 0, 1),
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    } for t in tasks]


@router.get("/tasks/{task_id}")
async def get_lina_task(task_id: int, db: Session = Depends(get_db)):
    """Get detailed progress for a specific background task."""
    import json as _json

    task = db.query(LinaTask).filter(LinaTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    # Parse result_log
    result_log = []
    if task.result_log:
        try:
            result_log = _json.loads(task.result_log)
        except (ValueError, TypeError):
            pass

    # Count successes and failures in result_log
    ok_count = sum(1 for r in result_log if r.get("status") == "ok")
    error_count = sum(1 for r in result_log if r.get("status") == "error")

    return {
        "id": task.id,
        "tenant_id": task.tenant_id,
        "task_type": task.task_type,
        "description": task.description,
        "total_items": task.total_items,
        "completed_items": task.completed_items,
        "status": task.status,
        "progress_pct": round((task.completed_items / task.total_items * 100) if task.total_items > 0 else 0, 1),
        "ok_count": ok_count,
        "error_count": error_count,
        "result_log": result_log[-20:],  # Last 20 results (avoid huge payloads)
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "updated_at": task.updated_at.isoformat() if task.updated_at else None,
    }


# ============================================================================
# HEALTH — WhatsApp token check
# ============================================================================

@router.get("/health")
async def lina_health(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Check if WhatsApp token is valid for the current user's tenant."""
    from routes._helpers import get_wa_token, get_wa_phone_id, safe_tid
    _tid = safe_tid(user, db)
    token = get_wa_token(db, _tid)
    phone_id = get_wa_phone_id(db, _tid)
    api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")

    if not token:
        return {"status": "error", "token_set": False, "message": "Token de WhatsApp no configurado"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://graph.facebook.com/{api_version}/{phone_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            data = resp.json()
            if resp.status_code == 200:
                return {"status": "ok", "token_set": True, "message": "Token valido, WhatsApp conectado"}
            else:
                error = data.get("error", {}).get("message", "Error desconocido")
                return {"status": "error", "token_set": True, "message": f"Token invalido: {error}"}
    except Exception as e:
        return {"status": "error", "token_set": True, "message": f"Error de conexion: {str(e)[:100]}"}


# ============================================================================
# INTERNAL — AI processing for learnings
# ============================================================================

async def _process_learning(raw_input: str, category: str) -> str:
    """Use AI to process and improve the admin's instruction into a clear rule for Lina."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return raw_input

    system = """Eres un editor de instrucciones para una IA asistente llamada Lina.
El admin te da una instruccion en lenguaje informal de como debe actuar Lina.
Tu trabajo: reescribirla como una REGLA CLARA y CONCISA que Lina pueda seguir.
- Mantén el significado exacto
- Hazla directa, en imperativo: "Cuando X pase, haz Y"
- Maximo 2-3 oraciones
- NO cambies la intencion, solo mejora la redaccion
- Si el admin dice algo como "no hagas X", convierte en "NUNCA hagas X"
- Responde SOLO con la regla reescrita, nada mas"""

    try:
        payload = {
            "model": "claude-sonnet-4-20250514",
            "max_tokens": 300,
            "system": system,
            "messages": [{"role": "user", "content": f"Categoria: {category}\nInstruccion del admin: {raw_input}"}],
            "temperature": 0.3,
        }
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                text = ""
                for block in data.get("content", []):
                    if block.get("type") == "text":
                        text += block.get("text", "")
                return text.strip() if text.strip() else raw_input
    except Exception as e:
        print(f"[LINA] Learning AI processing failed: {e}")

    return raw_input
