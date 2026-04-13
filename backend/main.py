import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from middleware import setup_cors_middleware
from auth import auth_router
from routes import create_router, search_router, update_router, delete_router, ai_router, whatsapp_router, dev_router, finance_router, content_studio_router, template_router, lina_router, staff_router, settings_router, campaign_router, schedule_router, loyalty_router, review_router, pos_router, ai_strategy_router, push_router
from routes.staff_payment_endpoints import router as staff_payment_router
from routes.walkin_endpoints import router as walkin_router
from database.connection import engine, Base
from database.migrations import run_migrations, ensure_vapid_keys



@asynccontextmanager
async def lifespan(app: FastAPI):
    import traceback
    try:
        print("[STARTUP] Step 1: create_all...")
        Base.metadata.create_all(bind=engine)
        print("[STARTUP] Step 2: migrations...")
        run_migrations(engine)
        print("[STARTUP] Step 3: scheduler...")
        from scheduler import start_scheduler
        start_scheduler()
        print("[STARTUP] Step 4: VAPID keys...")
        ensure_vapid_keys()
        print("[STARTUP] Plexify Studio API ready")
    except Exception as e:
        print(f"[STARTUP ERROR] {e}")
        traceback.print_exc()
    yield
    print("[SHUTDOWN] Stopped")


app = FastAPI(
    title="Plexify Studio API",
    version="1.0.0",
    lifespan=lifespan,
)

setup_cors_middleware(app)


# ============================================================================
# ERROR LOGGING MIDDLEWARE — Captures 5xx and unhandled exceptions
# ============================================================================
from fastapi import Request
from database.connection import SessionLocal
from database.models import ErrorLog
import traceback as tb_module

@app.middleware("http")
async def error_logging_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        if response.status_code >= 500:
            try:
                db = SessionLocal()
                db.add(ErrorLog(
                    endpoint=str(request.url.path),
                    method=request.method,
                    status_code=response.status_code,
                    error_type="HTTP_5xx",
                    message=f"Server returned {response.status_code}",
                ))
                db.commit()
                db.close()
            except Exception:
                pass
        return response
    except Exception as exc:
        try:
            db = SessionLocal()
            db.add(ErrorLog(
                endpoint=str(request.url.path),
                method=request.method,
                status_code=500,
                error_type=type(exc).__name__,
                message=str(exc)[:500],
                traceback_text=tb_module.format_exc()[:2000],
            ))
            db.commit()
            db.close()
        except Exception:
            pass
        raise


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
# automation_router REMOVED (Phase 5 — replaced by automation_studio_router)
app.include_router(template_router, prefix="/api", tags=["Message Templates"])
app.include_router(lina_router, prefix="/api", tags=["Lina IA"])
app.include_router(staff_router, prefix="/api", tags=["Staff Portal"])
app.include_router(staff_payment_router, prefix="/api", tags=["Staff Payments"])
app.include_router(walkin_router, prefix="/api", tags=["Walk-in Queue"])
app.include_router(settings_router, prefix="/api", tags=["Settings"])
app.include_router(campaign_router, prefix="/api", tags=["Campaigns"])
app.include_router(schedule_router, prefix="/api", tags=["Staff Schedule"])
app.include_router(loyalty_router, prefix="/api", tags=["Loyalty Program"])
app.include_router(review_router, prefix="/api", tags=["Reviews"])
app.include_router(pos_router, prefix="/api", tags=["POS"])
app.include_router(ai_strategy_router, prefix="/api", tags=["AI Strategy"])
app.include_router(push_router, prefix="/api", tags=["Push Notifications"])
# dev_mega_router merged into dev_router (Phase 4 refactor)

from routes.notification_endpoints import router as notification_router
app.include_router(notification_router, prefix="/api", tags=["Notifications"])

from routes.inventory_endpoints import router as inventory_router
app.include_router(inventory_router, prefix="/api", tags=["Inventory"])

from routes.register_endpoints import router as register_router
app.include_router(register_router, prefix="/api", tags=["Public Register"])

from routes.booking_endpoints import router as booking_router
app.include_router(booking_router, prefix="/api", tags=["Public Booking"])

from routes.automation_studio_endpoints import router as automation_studio_router
app.include_router(automation_studio_router, prefix="/api", tags=["Automation Studio"])

from routes.location_endpoints import router as location_router
app.include_router(location_router, prefix="/api", tags=["Locations"])

from routes.order_endpoints import router as order_router
app.include_router(order_router, tags=["Orders"])


# ============================================================================
# FACTORY RESET — Dev-only endpoint to wipe all tenant data
# ============================================================================

@app.post("/api/dev/factory-reset")
async def factory_reset(request: dict = {}):
    """
    Wipe ALL data from the database (except dev user).
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
        "campaign",
        "lina_task",
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

            # Delete admin users EXCEPT dev role
            try:
                result = conn.execute(text(
                    "DELETE FROM public.admin WHERE role != 'dev'"
                ))
                count = result.rowcount
                results["admin (except dev)"] = count
                print(f"[FACTORY RESET] Deleted {count} admin rows (kept dev)")
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

        # Clear dev user tenant_id since tenants were wiped
        try:
            with engine.begin() as conn:
                conn.execute(text(
                    "UPDATE public.admin SET tenant_id = NULL WHERE role = 'dev'"
                ))
                print("[FACTORY RESET] Cleared dev tenant_id")
        except Exception as e:
            print(f"[FACTORY RESET] Clear dev tenant_id: {e}")

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
        run_migrations(engine)
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
