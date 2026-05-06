"""
Auto-resume worker for paused WhatsApp Web campaigns.

When a Web campaign hits the daily quota or an anti-ban rule, we set its
status to 'paused_quota' and persist the remaining audience in
Campaign.pending_client_ids. This module re-launches those campaigns when
the tenant's daily counter rolls over and there's quota available again.

Called from scheduler.py every 2 minutes — cheap query + bail-out fast.
"""
import asyncio
import threading
from datetime import date

from database.models import Campaign, Tenant
from services.whatsapp.sender import reset_daily_counter_if_needed


def _launch_in_thread(coro_factory):
    """Run an async coroutine in its own thread + event loop.

    The scheduler thread doesn't have an asyncio loop, and we don't want
    to block the loop while the campaign sends (could take hours with pacing).
    """
    def runner():
        try:
            asyncio.run(coro_factory())
        except Exception as e:
            print(f"[campaign-resume] thread crashed: {e}")
    threading.Thread(target=runner, daemon=True).start()


def resume_paused_web_campaigns(db) -> int:
    """Scan paused_quota campaigns and re-launch any whose tenant has fresh quota.

    Returns the number of campaigns relaunched. Idempotent — safe to call
    every scheduler tick.
    """
    paused = (
        db.query(Campaign)
        .filter(Campaign.status == "paused_quota")
        .filter(Campaign.transport == "web")
        .all()
    )
    if not paused:
        return 0

    relaunched = 0
    # Defer import so we don't create a circular dep at module load
    from routes.campaign_endpoints import _run_web_campaign_background

    for c in paused:
        pending = list(c.pending_client_ids or [])
        if not pending:
            # Already finished — flip to sent so it stops showing as paused
            c.status = "sent"
            db.commit()
            continue

        tenant = db.query(Tenant).filter(Tenant.id == c.tenant_id).first()
        if not tenant:
            continue
        if (tenant.wa_web_status or "") != "connected":
            continue  # waiting on reconnect — different state path

        # Roll counter over if it's a new day
        reset_daily_counter_if_needed(db, tenant)

        sent_today = int(tenant.wa_web_sent_today or 0)
        cap = int(tenant.wa_web_daily_limit or 20)
        if sent_today >= cap:
            continue  # still maxed for today — try again tomorrow

        # Mark as sending and launch
        c.status = "sending"
        db.commit()
        cid, tid = c.id, c.tenant_id
        _launch_in_thread(lambda cid=cid, tid=tid, pending=pending:
                          _run_web_campaign_background(cid, tid, pending))
        relaunched += 1
        print(f"[campaign-resume] relaunched campaign {cid} for tenant {tid} ({len(pending)} pending)")

    return relaunched
