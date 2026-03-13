import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from middleware import setup_cors_middleware
from auth import auth_router
from routes import create_router, search_router, update_router, delete_router, ai_router, whatsapp_router, dev_router, finance_router
from database.connection import engine, Base


def _run_migrations(engine):
    """Add columns that create_all doesn't handle (new columns on existing tables)."""
    from sqlalchemy import text

    migrations = [
        ("whatsapp_message", "media_url", "TEXT"),
        ("whatsapp_message", "media_mime_type", "VARCHAR"),
        ("whatsapp_conversation", "tags", "JSON DEFAULT '[]'"),
        ("whatsapp_conversation", "wa_profile_photo_url", "TEXT"),
        ("staff", "color", "VARCHAR"),
        ("admin", "tenant_id", "INTEGER"),
        # Tenant columns (may be missing if table was created before model updates)
        ("tenant", "owner_email", "VARCHAR(200)"),
        ("tenant", "wa_phone_number_id", "VARCHAR(50)"),
        ("tenant", "wa_business_account_id", "VARCHAR(50)"),
        ("tenant", "wa_access_token", "TEXT"),
        ("tenant", "wa_webhook_token", "VARCHAR(100)"),
        ("tenant", "wa_phone_display", "VARCHAR(20)"),
        ("tenant", "ai_personality", "TEXT"),
        ("tenant", "ai_model", "VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-5-20250929'"),
        ("tenant", "address", "TEXT"),
        ("tenant", "updated_at", "TIMESTAMP DEFAULT NOW()"),
        # Finance module
        ("visit_history", "payment_method", "VARCHAR"),
    ]

    for table, column, col_type in migrations:
        try:
            with engine.begin() as conn:
                result = conn.execute(text(
                    f"SELECT column_name FROM information_schema.columns "
                    f"WHERE table_schema='public' AND table_name='{table}' AND column_name='{column}'"
                ))
                if result.fetchone() is None:
                    conn.execute(text(
                        f"ALTER TABLE public.{table} ADD COLUMN {column} {col_type}"
                    ))
                    print(f"[MIGRATION] Added {table}.{column}")
        except Exception as e:
            print(f"[MIGRATION] Error on {table}.{column}: {e}")

    # Fix: ensure ai_model column has a DEFAULT so raw SQL inserts don't fail
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE public.tenant ALTER COLUMN ai_model SET DEFAULT 'claude-sonnet-4-5-20250929'"
            ))
    except Exception:
        pass
    # Also make ai_name nullable or set default (same issue)
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE public.tenant ALTER COLUMN ai_name SET DEFAULT 'Lina'"
            ))
    except Exception:
        pass

    # Switch AI model from Haiku to Sonnet (Haiku too dumb for WhatsApp)
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "UPDATE public.ai_config SET model = 'claude-sonnet-4-5-20250929' WHERE model = 'claude-haiku-4-5-20251001'"
            ))
            if result.rowcount > 0:
                print(f"[MIGRATION] Switched {result.rowcount} AI config(s) from Haiku to Sonnet")
    except Exception:
        pass

    # --- Seed: DeveloperLuis admin user (role=dev) ---
    try:
        with engine.begin() as conn:
            existing = conn.execute(text(
                "SELECT id FROM public.admin WHERE username = 'DeveloperLuis'"
            )).fetchone()
            if existing is None:
                from auth.security import hash_password
                hashed = hash_password("DeveloperLuis")
                conn.execute(text(
                    "INSERT INTO public.admin (name, email, phone, username, password, role, is_active) "
                    "VALUES (:name, :email, :phone, :username, :password, :role, true)"
                ), {
                    "name": "Luis Developer",
                    "email": "dev@plexify.studio",
                    "phone": "+573000000000",
                    "username": "DeveloperLuis",
                    "password": hashed,
                    "role": "dev",
                })
                print("[SEED] Created DeveloperLuis admin user (role=dev)")
    except Exception as e:
        print(f"[SEED] DeveloperLuis: {e}")

    # --- Seed: AlPelo as first tenant ---
    try:
        with engine.begin() as conn:
            existing = conn.execute(text(
                "SELECT id FROM public.tenant WHERE slug = 'alpelo'"
            )).fetchone()
            if existing is None:
                conn.execute(text(
                    "INSERT INTO public.tenant (slug, name, business_type, owner_name, owner_phone, "
                    "owner_email, ai_name, ai_model, plan, monthly_price, messages_limit, messages_used, "
                    "city, country, is_active, ai_is_paused, timezone, currency, "
                    "booking_url) "
                    "VALUES (:slug, :name, :btype, :owner, :phone, "
                    ":email, :ai_name, :ai_model, :plan, :price, :limit, 0, "
                    ":city, :country, true, false, :tz, :currency, "
                    ":booking)"
                ), {
                    "slug": "alpelo",
                    "name": "AlPelo Peluqueria",
                    "btype": "peluqueria",
                    "owner": "Jaime",
                    "phone": "+573147083182",
                    "email": "somosalpelo@gmail.com",
                    "ai_name": "Lina",
                    "ai_model": "claude-sonnet-4-5-20250929",
                    "plan": "standard",
                    "price": 250000,
                    "limit": 5000,
                    "city": "Bucaramanga",
                    "country": "CO",
                    "tz": "America/Bogota",
                    "currency": "COP",
                    "booking": "https://book.weibook.co/alpelo-peluqueria",
                })
                print("[SEED] Created AlPelo tenant (slug=alpelo, plan=standard)")

    except Exception as e:
        print(f"[SEED] AlPelo tenant: {e}")

    # --- Link admin users to AlPelo tenant ---
    # Try multiple strategies: exact 'admin', 'admin_alpelo', or any non-dev admin without tenant
    try:
        with engine.begin() as conn:
            tenant_row = conn.execute(text(
                "SELECT id FROM public.tenant WHERE slug = 'alpelo'"
            )).fetchone()
            if tenant_row:
                tid = tenant_row[0]
                # Check if any admin is already linked to this tenant
                already_linked = conn.execute(text(
                    "SELECT id FROM public.admin WHERE tenant_id = :tid LIMIT 1"
                ), {"tid": tid}).fetchone()

                if not already_linked:
                    # Try specific usernames first, then any non-dev admin
                    for uname in ['admin', 'admin_alpelo']:
                        admin_row = conn.execute(text(
                            "SELECT id FROM public.admin WHERE username = :u"
                        ), {"u": uname}).fetchone()
                        if admin_row:
                            conn.execute(text(
                                "UPDATE public.admin SET tenant_id = :tid WHERE id = :aid"
                            ), {"tid": tid, "aid": admin_row[0]})
                            print(f"[MIGRATION] Linked '{uname}' (id={admin_row[0]}) to AlPelo tenant (id={tid})")
                            break
                    else:
                        # Fallback: any admin user that's not dev and has no tenant
                        fallback = conn.execute(text(
                            "SELECT id, username FROM public.admin WHERE role != 'dev' AND (tenant_id IS NULL) LIMIT 1"
                        )).fetchone()
                        if fallback:
                            conn.execute(text(
                                "UPDATE public.admin SET tenant_id = :tid WHERE id = :aid"
                            ), {"tid": tid, "aid": fallback[0]})
                            print(f"[MIGRATION] Linked '{fallback[1]}' (id={fallback[0]}) to AlPelo tenant (id={tid})")
    except Exception as e:
        print(f"[MIGRATION] Link admin to tenant: {e}")

    # --- Cleanup: remove duplicate admin_alpelo if 'admin' already linked ---
    try:
        with engine.begin() as conn:
            real_admin = conn.execute(text(
                "SELECT id FROM public.admin WHERE username = 'admin' AND tenant_id IS NOT NULL"
            )).fetchone()
            if real_admin:
                conn.execute(text(
                    "DELETE FROM public.admin WHERE username = 'admin_alpelo'"
                ))
                print("[CLEANUP] Removed duplicate admin_alpelo user")
    except Exception as e:
        print(f"[CLEANUP] admin_alpelo: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations(engine)

    # Start background scheduler for reminders and pending tasks
    from scheduler import start_scheduler
    start_scheduler()

    print("[STARTUP] Plexify Studio API ready")
    yield
    print("[SHUTDOWN] Stopped")


app = FastAPI(
    title="AlPelo API",
    version="1.0.0",
    lifespan=lifespan,
)

setup_cors_middleware(app)

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(create_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(update_router, prefix="/api")
app.include_router(delete_router, prefix="/api")
app.include_router(ai_router, prefix="/api", tags=["AI"])
app.include_router(whatsapp_router, prefix="/api", tags=["WhatsApp"])
app.include_router(dev_router, prefix="/api", tags=["Dev Panel"])
app.include_router(finance_router, prefix="/api", tags=["Finance"])


# ============================================================================
# LINA ACTIVITY LOG — Real-time monitoring endpoint
# ============================================================================
from activity_log import get_recent_events, get_stats as get_activity_stats

@app.get("/api/lina/activity")
async def lina_activity(limit: int = 100, offset: int = 0):
    """Get Lina IA recent activity events for the monitoring dashboard."""
    events = get_recent_events(limit=limit, offset=offset)
    stats = get_activity_stats()
    return {"events": events, "stats": stats}


@app.get("/api/lina/memory")
async def lina_memory():
    """Get ALL of Lina's knowledge: global learnings + per-client patterns."""
    from database.connection import SessionLocal
    from database.models import ClientNote, Client, LinaLearning
    from sqlalchemy import or_

    db = SessionLocal()
    try:
        # --- Global learnings (admin-taught rules) ---
        learnings = (
            db.query(LinaLearning)
            .filter(LinaLearning.is_active == True)
            .order_by(LinaLearning.created_at.desc())
            .all()
        )
        global_items = []
        for l in learnings:
            global_items.append({
                "id": f"L{l.id}",
                "type": "regla",
                "category": l.category,
                "client_name": "General",
                "content": l.content[:400],
                "created_at": l.created_at.isoformat() if l.created_at else None,
            })

        # --- Per-client learnings + feedback ---
        notes = (
            db.query(ClientNote)
            .filter(or_(
                ClientNote.content.ilike("%APRENDIZAJE:%"),
                ClientNote.content.ilike("%FEEDBACK:%"),
            ))
            .order_by(ClientNote.created_at.desc())
            .limit(50)
            .all()
        )

        client_items = []
        for n in notes:
            client = db.query(Client).filter(Client.id == n.client_id).first()
            content = n.content or ""
            if "APRENDIZAJE:" in content:
                mem_type = "aprendizaje"
                text = content.split("APRENDIZAJE:")[-1].strip()
            elif "FEEDBACK:" in content:
                mem_type = "feedback"
                text = content.split("FEEDBACK:")[-1].strip()
            else:
                mem_type = "otro"
                text = content

            client_items.append({
                "id": f"N{n.id}",
                "type": mem_type,
                "client_name": client.name if client else "?",
                "content": text[:300],
                "created_at": n.created_at.isoformat() if n.created_at else None,
            })

        all_items = global_items + client_items
        return {
            "total": len(all_items),
            "global_count": len(global_items),
            "client_count": len(client_items),
            "items": all_items,
        }
    finally:
        db.close()


@app.get("/api/lina/learnings")
async def list_learnings():
    """Get all global learnings for Lina."""
    from database.connection import SessionLocal
    from database.models import LinaLearning

    db = SessionLocal()
    try:
        items = db.query(LinaLearning).filter(LinaLearning.is_active == True).order_by(LinaLearning.created_at.desc()).all()
        return [{
            "id": l.id,
            "category": l.category,
            "content": l.content,
            "original_input": l.original_input,
            "created_by": l.created_by,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        } for l in items]
    finally:
        db.close()


@app.post("/api/lina/learnings")
async def create_learning(request: dict):
    """Admin teaches Lina something new. AI processes and stores it."""
    from database.connection import SessionLocal
    from database.models import LinaLearning

    raw_input = (request.get("content") or "").strip()
    category = (request.get("category") or "general").strip().lower()

    if not raw_input:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Contenido vacio")

    # Let AI process and improve the instruction
    processed = await _process_learning(raw_input, category)

    db = SessionLocal()
    try:
        learning = LinaLearning(
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
    finally:
        db.close()


@app.delete("/api/lina/learnings/{learning_id}")
async def delete_learning(learning_id: int):
    """Delete a global learning."""
    from database.connection import SessionLocal
    from database.models import LinaLearning

    db = SessionLocal()
    try:
        item = db.query(LinaLearning).filter(LinaLearning.id == learning_id).first()
        if not item:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="No encontrado")
        item.is_active = False
        db.commit()
        return {"ok": True}
    finally:
        db.close()


async def _process_learning(raw_input: str, category: str) -> str:
    """Use AI to process and improve the admin's instruction into a clear rule for Lina."""
    import httpx

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return raw_input  # fallback: use as-is

    system = """Eres un editor de instrucciones para una IA asistente de peluqueria llamada Lina.
El admin te da una instruccion en lenguaje informal de como debe actuar Lina en una situacion.
Tu trabajo: reescribirla como una REGLA CLARA y CONCISA que Lina pueda seguir.
- Mantén el significado exacto
- Hazla directa, en imperativo: "Cuando X pase, haz Y"
- Maximo 2-3 oraciones
- NO cambies la intencion, solo mejora la redaccion
- Si el admin dice algo como "no hagas X", convierte en "NUNCA hagas X"
- Responde SOLO con la regla reescrita, nada mas"""

    try:
        payload = {
            "model": "claude-sonnet-4-5-20250929",
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
        print(f"[Learning AI] Failed to process: {e}")

    return raw_input


@app.get("/api/lina/health")
async def lina_health():
    """Check if WhatsApp token is valid by making a test API call."""
    import httpx
    token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
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


@app.get("/")
async def root():
    return {"status": "running", "api": "AlPelo CRM"}




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
