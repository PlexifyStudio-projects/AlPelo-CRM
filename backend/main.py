import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from middleware import setup_cors_middleware
from auth import auth_router
from routes import create_router, search_router, update_router, delete_router, ai_router, whatsapp_router, dev_router, finance_router, content_studio_router, automation_router, template_router, lina_router
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
        ("visit_history", "is_invoiced", "BOOLEAN DEFAULT false"),
        # Expense detail fields
        ("expense", "subcategory", "VARCHAR"),
        ("expense", "vendor", "VARCHAR"),
        ("expense", "is_recurring", "BOOLEAN DEFAULT false"),
        ("expense", "recurring_frequency", "VARCHAR"),
        # Invoice item → visit link
        ("invoice_item", "visit_id", "INTEGER"),
        # Multi-tenant isolation
        ("client", "tenant_id", "INTEGER"),
        ("whatsapp_conversation", "tenant_id", "INTEGER"),
        # Multi-tenant: all remaining tables
        ("staff", "tenant_id", "INTEGER"),
        ("service", "tenant_id", "INTEGER"),
        ("appointment", "tenant_id", "INTEGER"),
        ("visit_history", "tenant_id", "INTEGER"),
        ("client_note", "tenant_id", "INTEGER"),
        ("expense", "tenant_id", "INTEGER"),
        ("invoice", "tenant_id", "INTEGER"),
        ("invoice_item", "tenant_id", "INTEGER"),
        ("staff_commission", "tenant_id", "INTEGER"),
        ("ai_config", "tenant_id", "INTEGER"),
        ("lina_learning", "tenant_id", "INTEGER"),
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

    # --- client_memory table (long-term AI memory with embeddings) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='client_memory'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.client_memory (
                        id SERIAL PRIMARY KEY,
                        tenant_id INTEGER NOT NULL REFERENCES public.tenant(id),
                        client_id INTEGER NOT NULL REFERENCES public.client(id),
                        memory_type VARCHAR(50) NOT NULL,
                        content TEXT NOT NULL,
                        embedding TEXT,
                        source VARCHAR(50) DEFAULT 'conversation',
                        confidence FLOAT DEFAULT 1.0,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX idx_client_memory_client ON public.client_memory(client_id)"))
                conn.execute(text("CREATE INDEX idx_client_memory_tenant ON public.client_memory(tenant_id)"))
                conn.execute(text("CREATE INDEX idx_client_memory_active ON public.client_memory(client_id, is_active)"))
                print("[MIGRATION] Created client_memory table with indexes")
    except Exception as e:
        print(f"[MIGRATION] client_memory table: {e}")

    # --- Index for tenant isolation on client and conversation tables ---
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_client_tenant ON public.client(tenant_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wa_conv_tenant ON public.whatsapp_conversation(tenant_id)"))
            print("[MIGRATION] Created tenant isolation indexes")
    except Exception as e:
        print(f"[MIGRATION] Tenant indexes: {e}")

    # Fix: ensure ai_model column has a DEFAULT so raw SQL inserts don't fail
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE public.tenant ALTER COLUMN ai_model SET DEFAULT 'claude-sonnet-4-5-20250929'"
            ))
    except Exception as e:
        print(f"[MIGRATION] ai_model default: {e}")
    # Also make ai_name nullable or set default (same issue)
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE public.tenant ALTER COLUMN ai_name SET DEFAULT 'Lina'"
            ))
    except Exception as e:
        print(f"[MIGRATION] ai_name default: {e}")

    # Switch AI model from Haiku to Sonnet (Haiku too dumb for WhatsApp)
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "UPDATE public.ai_config SET model = 'claude-sonnet-4-5-20250929' WHERE model = 'claude-haiku-4-5-20251001'"
            ))
            if result.rowcount > 0:
                print(f"[MIGRATION] Switched {result.rowcount} AI config(s) from Haiku to Sonnet")
    except Exception as e:
        print(f"[MIGRATION] AI model switch Haiku->Sonnet: {e}")

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

    # NOTE: Tenants are created manually from the Developer panel.


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
    title="Plexify Studio API",
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
app.include_router(content_studio_router, prefix="/api", tags=["Content Studio"])
app.include_router(automation_router, prefix="/api", tags=["Automations"])
app.include_router(template_router, prefix="/api", tags=["Message Templates"])
app.include_router(lina_router, prefix="/api", tags=["Lina IA"])


# ============================================================================
# FACTORY RESET — Dev-only endpoint to wipe all tenant data
# ============================================================================

@app.post("/api/dev/factory-reset")
async def factory_reset(request: dict = {}):
    """
    Wipe ALL data from the database (except DeveloperLuis).
    Requires secret key or dev role. Use with extreme caution.
    """
    from fastapi import HTTPException
    from sqlalchemy import text

    # Safety: require secret key
    secret = (request.get("secret") or "").strip()
    expected = os.getenv("FACTORY_RESET_SECRET", "plexify-reset-2026")
    if secret != expected:
        raise HTTPException(status_code=403, detail="Invalid secret key")

    # Tables in deletion order (respecting foreign keys)
    tables = [
        "workflow_execution",
        "workflow_template",
        "client_memory",
        "invoice_item",
        "invoice",
        "expense",
        "staff_commission",
        "visit_history",
        "client_note",
        "appointment",
        "whatsapp_message",
        "whatsapp_conversation",
        "generated_content",
        "message_template",
        "brand_kits",
        "billing_record",
        "usage_metrics",
        "service",
        "client",
        "staff",
        "lina_learning",
        "ai_config",
    ]

    results = {}

    try:
        with engine.begin() as conn:
            # Delete data from each table
            for table in tables:
                try:
                    result = conn.execute(text(f"DELETE FROM public.{table}"))
                    count = result.rowcount
                    results[table] = count
                    print(f"[FACTORY RESET] Deleted {count} rows from {table}")
                except Exception as e:
                    results[table] = f"ERROR: {str(e)[:80]}"
                    print(f"[FACTORY RESET] Error on {table}: {e}")

            # Delete admin users EXCEPT DeveloperLuis
            try:
                result = conn.execute(text(
                    "DELETE FROM public.admin WHERE username != 'DeveloperLuis'"
                ))
                count = result.rowcount
                results["admin (except DeveloperLuis)"] = count
                print(f"[FACTORY RESET] Deleted {count} admin rows (kept DeveloperLuis)")
            except Exception as e:
                results["admin"] = f"ERROR: {str(e)[:80]}"
                print(f"[FACTORY RESET] Error on admin: {e}")

            # Delete all tenants
            try:
                result = conn.execute(text("DELETE FROM public.tenant"))
                count = result.rowcount
                results["tenant"] = count
                print(f"[FACTORY RESET] Deleted {count} tenants")
            except Exception as e:
                results["tenant"] = f"ERROR: {str(e)[:80]}"
                print(f"[FACTORY RESET] Error on tenant: {e}")

            # Reset sequences for all tables
            all_tables = tables + ["admin", "tenant"]
            for table in all_tables:
                try:
                    conn.execute(text(
                        f"ALTER SEQUENCE IF EXISTS {table}_id_seq RESTART WITH 1"
                    ))
                except Exception as e:
                    print(f"[FACTORY RESET] Sequence reset {table}_id_seq: {e}")

            print("[FACTORY RESET] All sequences reset to 1")

        # Clear DeveloperLuis tenant_id since tenants were wiped
        try:
            with engine.begin() as conn:
                conn.execute(text(
                    "UPDATE public.admin SET tenant_id = NULL WHERE username = 'DeveloperLuis'"
                ))
                print("[FACTORY RESET] Cleared DeveloperLuis tenant_id")
        except Exception as e:
            print(f"[FACTORY RESET] Clear DeveloperLuis tenant_id: {e}")

        print("[FACTORY RESET] === COMPLETE ===")
        return {
            "status": "ok",
            "message": "Factory reset complete. Restart server to re-seed tenants.",
            "deleted": results,
        }

    except Exception as e:
        print(f"[FACTORY RESET] FATAL ERROR: {e}")
        raise HTTPException(status_code=500, detail=f"Factory reset failed: {str(e)[:200]}")


@app.post("/api/dev/run-migrations")
async def run_migrations_endpoint(request: dict = {}):
    """Force run migrations without restarting the server.
    Optionally pass tenant_id to assign orphan records to a tenant."""
    from sqlalchemy import text as sql_text
    try:
        _run_migrations(engine)
        # Reset the tenant_cols_ready cache so safe_tid re-checks
        import routes._helpers
        routes._helpers._TENANT_COLS_READY = None

        # If tenant_id provided, assign all orphan records (tenant_id=NULL) to that tenant
        fix_tenant = request.get("fix_tenant_id")
        fixed = {}
        if fix_tenant:
            tables_to_fix = ["client", "staff", "service", "appointment", "visit_history",
                             "client_note", "expense", "invoice", "invoice_item",
                             "staff_commission", "ai_config", "lina_learning",
                             "whatsapp_conversation"]
            with engine.begin() as conn:
                for table in tables_to_fix:
                    try:
                        result = conn.execute(sql_text(
                            f"UPDATE public.{table} SET tenant_id = :tid WHERE tenant_id IS NULL"
                        ), {"tid": fix_tenant})
                        if result.rowcount > 0:
                            fixed[table] = result.rowcount
                    except Exception:
                        pass

        return {"status": "ok", "message": "Migrations executed.", "orphans_fixed": fixed}
    except Exception as e:
        return {"status": "error", "message": str(e)[:300]}


@app.get("/")
async def root():
    return {"status": "running", "api": "Plexify Studio"}




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
