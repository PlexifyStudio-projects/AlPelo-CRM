import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from middleware import setup_cors_middleware
from auth import auth_router
from routes import create_router, search_router, update_router, delete_router, ai_router, whatsapp_router
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations(engine)

    # Start background scheduler for reminders and pending tasks
    from scheduler import start_scheduler
    start_scheduler()

    print("[STARTUP] AlPelo API ready")
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
