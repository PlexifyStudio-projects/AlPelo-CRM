from contextlib import asynccontextmanager
from fastapi import FastAPI
from middleware import setup_cors_middleware
from auth import auth_router
from routes import create_router, search_router, update_router, delete_router, ai_router, whatsapp_router
from database.connection import engine, Base


def _run_migrations(engine):
    """Add columns that create_all doesn't handle (new columns on existing tables)."""
    from sqlalchemy import text, inspect
    inspector = inspect(engine)

    # WhatsApp message: media_url, media_mime_type
    if "whatsapp_message" in inspector.get_table_names(schema="public"):
        existing = [c["name"] for c in inspector.get_columns("whatsapp_message", schema="public")]
        with engine.begin() as conn:
            if "media_url" not in existing:
                conn.execute(text("ALTER TABLE public.whatsapp_message ADD COLUMN media_url TEXT"))
                print("[MIGRATION] Added media_url to whatsapp_message")
            if "media_mime_type" not in existing:
                conn.execute(text("ALTER TABLE public.whatsapp_message ADD COLUMN media_mime_type VARCHAR"))
                print("[MIGRATION] Added media_mime_type to whatsapp_message")

    # WhatsApp conversation: tags
    if "whatsapp_conversation" in inspector.get_table_names(schema="public"):
        existing_conv = [c["name"] for c in inspector.get_columns("whatsapp_conversation", schema="public")]
        with engine.begin() as conn:
            if "tags" not in existing_conv:
                conn.execute(text("ALTER TABLE public.whatsapp_conversation ADD COLUMN tags JSON DEFAULT '[]'"))
                print("[MIGRATION] Added tags to whatsapp_conversation")

    # Activate Lina IA on ALL existing conversations (fix for is_ai_active default=False)
    if "whatsapp_conversation" in inspector.get_table_names(schema="public"):
        with engine.begin() as conn:
            result = conn.execute(text(
                "UPDATE public.whatsapp_conversation SET is_ai_active = true WHERE is_ai_active = false"
            ))
            if result.rowcount > 0:
                print(f"[MIGRATION] Activated Lina IA on {result.rowcount} conversations")


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
    lifespan=lifespan
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
