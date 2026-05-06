# ============================================================================
# Plexify Studio - Background Scheduler (v3 — DB-aware, deploy-safe)
# Runs periodic tasks:
#   1. 30-min default reminder for ALL appointments
#   2. Custom reminders from PENDIENTE notes (e.g. "avisame 10 min antes")
#   3. 24-hour no-show follow-up to re-engage clients
#   4. Expire old PENDIENTE notes
#
# IMPORTANT: All deduplication uses the DATABASE, not in-memory sets.
# This means the scheduler survives redeploys without sending duplicates.
# ============================================================================

import os
import time
import threading
import httpx
from datetime import datetime, date, timedelta

from database.connection import SessionLocal
from sqlalchemy import func
from database.models import (
    Appointment, Client, ClientNote, Staff, Service, Tenant,
    WhatsAppConversation, WhatsAppMessage,
)
from routes._helpers import normalize_phone, now_colombia as _now_colombia, _COL_OFFSET
from activity_log import log_event

WA_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v22.0")

SCHEDULER_INTERVAL = 120  # Check every 2 minutes

# Days of the week in Spanish for suggestions
_DAYS_ES = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


# ============================================================================
# Extracted to services/ during Phase 8 refactor
# ============================================================================
from services.automation.helpers import (
    _replace_note_prefix, _get_wa_config, _wa_headers, _send_whatsapp_sync,
    _store_outbound_message, _conv_rate_limited, _already_sent_today,
    _already_sent_for_date, _match_phone_to_conversation,
    _create_conversation_for_client, _find_conversation, _get_appt_details,
    _suggest_day,
)
from services.automation.reminders import _check_30min_reminders, _check_custom_reminders
from services.automation.noshow import _check_noshow_followups, _expire_old_notes
from services.automation.daily import (
    _is_business_hours, _morning_review, _sweep_missed_conversations,
    _execute_pending_tasks, _detect_unresolved_messages,
)
from services.whatsapp.health import (
    _check_token_health, _auto_refresh_meta_tokens,
    _proactive_reconnect, _send_staff_briefings,
)
from services.automation.tasks import (
    _check_closed_day_appointments, _daily_summary_push,
)

# ============================================================================
# MAIN LOOP
# ============================================================================
def _scheduler_loop():
    """Main scheduler loop — runs in a background thread."""
    print("[SCHEDULER] Started v7 (DB-aware, deploy-safe, off-hours, sweep, token-aware, unresolved detector)")
    print("[SCHEDULER] Features: 30-min reminders, custom reminders, no-show status, morning review, sweep, token health, unresolved messages")
    log_event("sistema", "Lina IA iniciada", detail="Sistema de tareas automaticas activo: recordatorios, seguimientos, revision matutina, verificacion de token.", status="ok")
    # Wait 60 seconds on startup before first check (let everything initialize)
    time.sleep(60)

    while True:
        try:
            # Always check token health (even outside business hours)
            _check_token_health()

            db = SessionLocal()
            try:
                # Check for appointments on closed days (runs once daily, even outside business hours)
                try:
                    _check_closed_day_appointments(db)
                except Exception as e:
                    print(f"[SCHEDULER] Closed-day check error: {e}")

                # Only run appointment-related tasks during business hours
                if _is_business_hours():
                    _check_30min_reminders(db)
                    _check_custom_reminders(db)
                    _execute_pending_tasks(db)

                    # Lina background task worker (bulk operations)
                    try:
                        from lina_task_worker import process_lina_tasks
                        process_lina_tasks(db)
                    except Exception as e:
                        print(f"[SCHEDULER] Lina task worker error: {e}")

                    _morning_review(db)
                    _send_staff_briefings(db)
                    _sweep_missed_conversations(db)
                    _detect_unresolved_messages(db)

                    # Legacy workflow engine REMOVED (Phase 5 refactor)
                    # All automations now run through Automation Studio only.

                    # Automation Studio engine (user-created automations)
                    try:
                        from automation_engine import run_automations
                        run_automations(db)
                    except Exception as e:
                        print(f"[SCHEDULER] Automation engine error: {e}")

                # Daily summary push (runs once at ~8 PM)
                try:
                    _daily_summary_push(db)
                except Exception as e:
                    print(f"[SCHEDULER] Daily summary error: {e}")

                # Resume Web campaigns paused on quota (auto-rolls when day changes)
                try:
                    from services.whatsapp.campaign_resume import resume_paused_web_campaigns
                    resume_paused_web_campaigns(db)
                except Exception as e:
                    print(f"[SCHEDULER] Campaign resume error: {e}")

                _check_noshow_followups(db)
                _expire_old_notes(db)

                # Proactive Reconnect — contact overdue clients (once daily at 10 AM)
                try:
                    _proactive_reconnect(db)
                except Exception as e:
                    print(f"[SCHEDULER] Reconnect error: {e}")

                # Meta Token Auto-Refresh — renew tokens expiring within 7 days (once daily at 6 AM)
                try:
                    _auto_refresh_meta_tokens(db)
                except Exception as e:
                    print(f"[SCHEDULER] Token refresh error: {e}")
            finally:
                db.close()
        except Exception as e:
            print(f"[SCHEDULER] Error: {e}")

        time.sleep(SCHEDULER_INTERVAL)


def start_scheduler():
    """Start the scheduler in a daemon thread."""
    thread = threading.Thread(target=_scheduler_loop, daemon=True)
    thread.start()
    print("[SCHEDULER] Background thread launched (v5)")
