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

    # Activate Lina IA on all existing conversations
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "UPDATE public.whatsapp_conversation SET is_ai_active = true WHERE is_ai_active = false"
            ))
            if result.rowcount > 0:
                print(f"[MIGRATION] Activated Lina IA on {result.rowcount} conversations")
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations(engine)
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


@app.get("/")
async def root():
    return {"status": "running", "api": "AlPelo CRM"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
