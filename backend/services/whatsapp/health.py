"""WhatsApp token health + Meta token auto-refresh.
Extracted from scheduler.py Phase 8."""
import os, time, httpx
from datetime import datetime, timedelta
from database.connection import SessionLocal
from database.models import Tenant
from routes._helpers import now_colombia as _now_colombia

# TOKEN HEALTH CHECK — Auto-resume Lina when token is restored
# ============================================================================
def _check_token_health():
    """Check if WA token is valid. Auto-resume Lina if it was paused and token is back."""
    from routes.whatsapp_endpoints import _wa_token_paused, _trigger_token_resume

    if not _wa_token_paused:
        return  # Token is fine, nothing to do

    # Token is paused — check if it's back (read from tenant DB first, not stale env var)
    db = SessionLocal()
    try:
        token, phone_id = _get_wa_config(db)
    finally:
        db.close()

    api_version = os.getenv("WHATSAPP_API_VERSION", "v22.0")

    if not token:
        return

    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(
                f"https://graph.facebook.com/{api_version}/{phone_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                _trigger_token_resume()
                print("[SCHEDULER] Token health check PASSED — Lina resumed!")
            else:
                print(f"[SCHEDULER] Token still expired — Lina remains paused.")
    except Exception as e:
        print(f"[SCHEDULER] Token health check error: {e}")


# ============================================================================
# PROACTIVE RECONNECT — Contact clients overdue for visits
# ============================================================================
_reconnect_ran_today = None  # Track daily execution

def _proactive_reconnect(db):
    """Once daily at ~10 AM, find overdue clients and send them a personalized
    reconnect message via approved WhatsApp template."""
    global _reconnect_ran_today

    now = _now_colombia()
    today = now.date()

    # Only run once per day, between 10:00-10:30 AM
    if _reconnect_ran_today == today:
        return
    if not (10 <= now.hour <= 10 and now.minute < 30):
        return

    _reconnect_ran_today = today

    try:
        from client_intelligence import get_reconnect_candidates
        from database.models import Tenant, MessageTemplate, ClientNote, WhatsAppConversation, WhatsAppMessage

        # Process each active tenant
        tenants = db.query(Tenant).filter(Tenant.is_active == True, Tenant.ai_is_paused == False).all()

        for tenant in tenants:
            candidates = get_reconnect_candidates(tenant.id, limit=5, db=db)
            if not candidates:
                continue

            # Find approved reconnect template for this tenant
            template = db.query(MessageTemplate).filter(
                MessageTemplate.tenant_id == tenant.id,
                MessageTemplate.category == "reactivacion",
                MessageTemplate.status == "approved",
            ).first()

            for client in candidates:
                phone = client.get("phone")
                name = client.get("client_name", "")
                if not phone:
                    continue

                # Check if we already sent a reconnect to this client today
                first_name = name.split()[0] if name else ""

                # Find or create conversation
                conv = db.query(WhatsAppConversation).filter(
                    WhatsAppConversation.wa_contact_phone == phone,
                ).first()

                if template:
                    # Use approved template (works outside 24h window)
                    try:
                        from routes.whatsapp_endpoints import _get_wa_base_url, wa_headers, _get_wa_phone_id
                        import httpx

                        # Build template params
                        params = []
                        for var in (template.variables or []):
                            if var == "nombre":
                                params.append(first_name or "cliente")
                            elif var == "negocio":
                                params.append(tenant.name or "nuestro negocio")
                            elif var == "dias":
                                params.append(str(client.get("days_since", "?")))
                            elif var == "profesional":
                                params.append(client.get("preferred_staff") or "nuestro equipo")
                            elif var == "servicio":
                                params.append(client.get("favorite_service") or "tu servicio favorito")
                            else:
                                params.append("")

                        body_components = [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}] if params else []

                        with httpx.Client(timeout=15) as http:
                            resp = http.post(
                                f"{_get_wa_base_url(db)}/messages",
                                headers=wa_headers(db),
                                json={
                                    "messaging_product": "whatsapp",
                                    "to": phone,
                                    "type": "template",
                                    "template": {
                                        "name": template.slug,
                                        "language": {"code": template.language or "es"},
                                        "components": body_components,
                                    },
                                },
                            )

                        if resp.status_code == 200:
                            # Log reconnect note to prevent re-sending
                            note = ClientNote(
                                tenant_id=tenant.id,
                                client_id=client["client_id"],
                                content=f"RECONNECT: Mensaje de reactivacion enviado (llevaba {client.get('days_since', '?')} dias sin venir, ciclo normal: {client.get('avg_cycle', '?')} dias)",
                                created_by="lina_ia",
                            )
                            db.add(note)
                            db.commit()

                            log_event("tarea", f"Reconnect enviado a {first_name}", detail=f"Llevaba {client.get('days_since', '?')} dias sin venir (ciclo: {client.get('avg_cycle', '?')}d). Template: {template.slug}", contact_name=name, conv_id=conv.id if conv else None, status="ok", tenant_id=tenant.id)
                        else:
                            log_event("error", f"Reconnect fallido para {first_name}", detail=f"HTTP {resp.status_code}: {resp.text[:200]}", contact_name=name, status="error", tenant_id=tenant.id)

                    except Exception as send_err:
                        log_event("error", f"Error enviando reconnect a {first_name}", detail=str(send_err)[:200], contact_name=name, status="error", tenant_id=tenant.id)
                else:
                    # No approved template — log warning (admin needs to create one)
                    log_event("skip", f"Reconnect pendiente: {first_name} ({client.get('days_since', '?')}d)", detail=f"No hay template de reactivacion aprobada. Crea una en Plantillas y enviala a Meta.", contact_name=name, status="warning", tenant_id=tenant.id)

        print(f"[SCHEDULER] Proactive reconnect completed for {len(tenants)} tenant(s)")

    except Exception as e:
        print(f"[SCHEDULER] Reconnect error: {e}")
        log_event("error", "Error en reconnect automatico", detail=str(e)[:200], status="error")


# ============================================================================
# 8. STAFF PREPARATION AI — Briefing 30 min before appointment
# ============================================================================
_sent_briefings = set()  # Track (apt_id) to avoid duplicates

def _send_staff_briefings(db):
    """Send staff a prep briefing 30 min before their next appointment."""
    from database.models import Appointment, Client, VisitHistory, Notification, Staff, Service

    now = _now_colombia()
    today = now.date()
    target_time_start = now + timedelta(minutes=25)
    target_time_end = now + timedelta(minutes=35)

    # Find appointments 25-35 min from now
    apts = db.query(Appointment).filter(
        Appointment.date == today,
        Appointment.status == "confirmed",
    ).all()

    for apt in apts:
        if apt.id in _sent_briefings:
            continue
        try:
            h, m = int(apt.time.split(":")[0]), int(apt.time.split(":")[1])
            apt_dt = now.replace(hour=h, minute=m, second=0, microsecond=0)
            diff_min = (apt_dt - now).total_seconds() / 60

            if not (25 <= diff_min <= 35):
                continue

            # Build briefing
            staff = db.query(Staff).filter(Staff.id == apt.staff_id).first()
            if not staff:
                continue

            svc = db.query(Service).filter(Service.id == apt.service_id).first()
            client = db.query(Client).filter(Client.id == apt.client_id).first() if apt.client_id else None

            briefing_parts = [f"Proxima cita {apt.time}"]
            briefing_parts.append(f"Cliente: {apt.client_name}")
            briefing_parts.append(f"Servicio: {svc.name if svc else '?'} ({apt.duration_minutes or 30}min)")

            if client:
                total_visits = len(client.visits) if client.visits else 0
                if total_visits == 0:
                    briefing_parts.append("NUEVO: Primera visita")
                elif total_visits >= 10:
                    briefing_parts.append(f"VIP: {total_visits} visitas")
                else:
                    briefing_parts.append(f"Visitas: {total_visits}")

                # Favorite service
                if client.favorite_service:
                    briefing_parts.append(f"Servicio favorito: {client.favorite_service}")

                # Notes/preferences
                if client.notes:
                    for note in client.notes[:2]:
                        if 'APRENDIZAJE' in (note.content or '').upper() or 'PREFERENCIA' in (note.content or '').upper():
                            briefing_parts.append(f"Nota: {note.content[:80]}")

                # No-show risk
                try:
                    from no_show_predictor import calculate_no_show_risk
                    risk = calculate_no_show_risk(apt, db)
                    if risk["risk_score"] >= 45:
                        briefing_parts.append(f"RIESGO NO-SHOW: {risk['risk_score']}%")
                except Exception:
                    pass

            # Create notification for staff
            notif = Notification(
                tenant_id=apt.tenant_id,
                type="staff_briefing",
                title=f"En 30min: {apt.client_name}",
                detail=" | ".join(briefing_parts),
                icon="briefing",
            )
            db.add(notif)
            _sent_briefings.add(apt.id)

            print(f"[SCHEDULER] Staff briefing for {staff.name}: {apt.client_name} at {apt.time}")

        except Exception as e:
            print(f"[SCHEDULER] Briefing error for apt {apt.id}: {e}")

    db.commit()


# ============================================================================
# 9. META TOKEN AUTO-REFRESH — Renew tokens before they expire
# ============================================================================
_last_token_refresh_date = None

def _auto_refresh_meta_tokens(db):
    """Once daily, check all tenant tokens and refresh any expiring within 7 days.
    Reads Meta App credentials from PlatformConfig (DB), not env vars."""
    global _last_token_refresh_date

    now = _now_colombia()
    today = now.date()

    # Only run once per day, at ~6 AM
    if _last_token_refresh_date == today:
        return
    if now.hour != 6:
        return

    _last_token_refresh_date = today

    from database.models import Tenant, PlatformConfig

    # Get Meta App credentials from PlatformConfig
    creds = {}
    configs = db.query(PlatformConfig).filter(
        PlatformConfig.key.in_(["META_APP_ID", "META_APP_SECRET"])
    ).all()
    for c in configs:
        if c.value:
            creds[c.key] = c.value

    # Fallback to env vars
    app_id = creds.get("META_APP_ID", "")
    app_secret = creds.get("META_APP_SECRET", "")

    if not app_id or not app_secret:
        return  # Can't refresh without credentials

    # Find tenants with tokens expiring within 7 days
    threshold = datetime.utcnow() + timedelta(days=7)
    expiring_tenants = (
        db.query(Tenant)
        .filter(
            Tenant.is_active == True,
            Tenant.wa_access_token.isnot(None),
            Tenant.wa_token_expires_at.isnot(None),
            Tenant.wa_token_expires_at <= threshold,
        )
        .all()
    )

    if not expiring_tenants:
        return

    for tenant in expiring_tenants:
        days_left = (tenant.wa_token_expires_at - datetime.utcnow()).days if tenant.wa_token_expires_at else 0
        print(f"[SCHEDULER] Token refresh: {tenant.name} (expires in {days_left} days)")

        try:
            resp = httpx.get(
                f"https://graph.facebook.com/v22.0/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "fb_exchange_token": tenant.wa_access_token,
                },
                timeout=15,
            )

            if resp.status_code == 200:
                token_data = resp.json()
                new_token = token_data.get("access_token")
                expires_in = token_data.get("expires_in", 5184000)

                if new_token:
                    tenant.wa_access_token = new_token
                    tenant.wa_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
                    db.commit()

                    new_days = expires_in // 86400
                    print(f"[SCHEDULER] Token refreshed for {tenant.name} — valid for {new_days} more days")
                    log_event(
                        "sistema",
                        f"Token Meta renovado automaticamente para {tenant.name}",
                        detail=f"Token valido por {new_days} dias mas. Expira: {tenant.wa_token_expires_at.strftime('%Y-%m-%d')}",
                        status="ok", tenant_id=tenant.id,
                    )
            else:
                error_msg = ""
                try:
                    error_msg = resp.json().get("error", {}).get("message", f"HTTP {resp.status_code}")
                except Exception:
                    error_msg = f"HTTP {resp.status_code}"

                print(f"[SCHEDULER] Token refresh FAILED for {tenant.name}: {error_msg}")
                log_event(
                    "error",
                    f"Fallo renovacion de token para {tenant.name}",
                    detail=f"Error: {error_msg}. Token expira en {days_left} dias. El admin debe reconectar Facebook.",
                    status="error", tenant_id=tenant.id,
                )

        except Exception as e:
            print(f"[SCHEDULER] Token refresh error for {tenant.name}: {e}")

    print(f"[SCHEDULER] Token refresh check complete — {len(expiring_tenants)} tenant(s) checked")


