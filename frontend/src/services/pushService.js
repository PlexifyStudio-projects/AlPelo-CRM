/**
 * Web Push Notifications — registration and management.
 */

const API = import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api';
const SW_PATH = '/AlPelo-CRM/sw.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Not supported in this browser');
    return false;
  }

  try {
    // 1. Register service worker
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/AlPelo-CRM/' });
    await navigator.serviceWorker.ready;
    console.log('[Push] Service Worker ready');

    // 2. Get VAPID public key from backend FIRST (before checking subscription)
    const res = await fetch(`${API}/push/vapid-key`, { credentials: 'include' });
    if (!res.ok) {
      console.log('[Push] No VAPID key configured (HTTP', res.status, ')');
      return false;
    }
    const { public_key } = await res.json();
    console.log('[Push] VAPID key received:', public_key.substring(0, 20) + '...');

    // 3. Check existing subscription — unsubscribe if VAPID key changed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Verify the existing subscription uses the same VAPID key
      const existingKey = existing.options?.applicationServerKey;
      const newKeyBytes = urlBase64ToUint8Array(public_key);
      let keyMatch = false;
      if (existingKey) {
        const existingArr = new Uint8Array(existingKey);
        keyMatch = existingArr.length === newKeyBytes.length &&
          existingArr.every((v, i) => v === newKeyBytes[i]);
      }
      if (keyMatch) {
        console.log('[Push] Already subscribed with correct key');
        // Re-send to backend in case it was lost
        const sub = existing.toJSON();
        fetch(`${API}/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, user_agent: navigator.userAgent }),
        }).catch(() => {});
        return true;
      }
      // Different key — unsubscribe old one first
      console.log('[Push] VAPID key changed, re-subscribing...');
      await existing.unsubscribe();
    }

    // 4. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Permission:', permission);
      return false;
    }

    // 5. Subscribe to push service
    console.log('[Push] Subscribing with key length:', public_key.length);
    const appServerKey = urlBase64ToUint8Array(public_key);
    console.log('[Push] applicationServerKey bytes:', appServerKey.length, 'first byte:', appServerKey[0]);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });

    // 6. Send subscription to backend
    const sub = subscription.toJSON();
    const saveRes = await fetch(`${API}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.keys,
        user_agent: navigator.userAgent,
      }),
    });

    console.log('[Push] Subscribed! Backend save:', saveRes.status);
    return true;
  } catch (err) {
    console.error('[Push] Registration failed:', err.name, err.message);
    // If subscription failed, try to clean up
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {}
    return false;
  }
}

export async function unregisterPush() {
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!registration) return;

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // Unsubscribe from browser
    await subscription.unsubscribe();

    // Remove from backend
    await fetch(`${API}/push/unsubscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    console.log('[Push] Unsubscribed');
  } catch (err) {
    console.error('[Push] Unregister failed:', err);
  }
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function isPushSubscribed() {
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
