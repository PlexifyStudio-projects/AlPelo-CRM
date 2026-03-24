"""
Web Push Notification sender — fire-and-forget push to user devices.

Usage:
    from push_sender import send_push
    send_push(tenant_id=1, title="Nueva cita", body="Carlos a las 3pm", url="/agenda")
"""
import json
import threading

_vapid_cache = {}


def send_push(tenant_id: int, title: str, body: str = "", url: str = None,
              user_type: str = None, user_id: int = None):
    """Send Web Push to all active subscriptions for a tenant (or a specific user).
    Runs in a background thread — never blocks the caller.
    """
    def _do():
        from database.connection import SessionLocal
        from database.models import PushSubscription, PlatformConfig

        db = SessionLocal()
        try:
            # Load VAPID keys (cached after first call)
            if not _vapid_cache:
                configs = db.query(PlatformConfig).filter(
                    PlatformConfig.key.in_(["VAPID_PRIVATE_KEY", "VAPID_PUBLIC_KEY", "VAPID_CONTACT_EMAIL"])
                ).all()
                for c in configs:
                    _vapid_cache[c.key] = c.value
                if not _vapid_cache.get("VAPID_PRIVATE_KEY"):
                    return  # No VAPID keys configured

            private_key = _vapid_cache.get("VAPID_PRIVATE_KEY")
            contact = _vapid_cache.get("VAPID_CONTACT_EMAIL", "mailto:dev@plexifystudio.com")
            if not private_key:
                return

            # Query subscriptions
            q = db.query(PushSubscription).filter(
                PushSubscription.tenant_id == tenant_id,
                PushSubscription.is_active == True,
            )
            if user_type and user_id:
                q = q.filter(PushSubscription.user_type == user_type, PushSubscription.user_id == user_id)

            subs = q.all()
            if not subs:
                return

            try:
                from pywebpush import webpush, WebPushException
            except ImportError:
                print("[PUSH] pywebpush not installed")
                return

            payload = json.dumps({
                "title": title or "Plexify Studio",
                "body": body or "",
                "url": url,
            })

            for sub in subs:
                try:
                    webpush(
                        subscription_info={
                            "endpoint": sub.endpoint,
                            "keys": {
                                "p256dh": sub.p256dh,
                                "auth": sub.auth_key,
                            },
                        },
                        data=payload,
                        vapid_private_key=private_key,
                        vapid_claims={"sub": contact},
                        ttl=86400,
                    )
                except WebPushException as e:
                    status = getattr(e, 'response', None)
                    code = status.status_code if status else 0
                    if code in (404, 410):
                        # Subscription expired/invalid — deactivate
                        sub.is_active = False
                        db.commit()
                        print(f"[PUSH] Deactivated expired subscription {sub.id}")
                    else:
                        print(f"[PUSH] Error sending to sub {sub.id}: {e}")
                except Exception as e:
                    print(f"[PUSH] Unexpected error for sub {sub.id}: {e}")

        except Exception as e:
            print(f"[PUSH] send_push error: {e}")
        finally:
            db.close()

    threading.Thread(target=_do, daemon=True).start()
