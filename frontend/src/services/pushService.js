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
    console.log('[Push] Service Worker registered');

    // 2. Check if already subscribed
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      console.log('[Push] Already subscribed');
      return true;
    }

    // 3. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Permission denied');
      return false;
    }

    // 4. Get VAPID public key from backend
    const res = await fetch(`${API}/push/vapid-key`, { credentials: 'include' });
    if (!res.ok) {
      console.log('[Push] No VAPID key configured');
      return false;
    }
    const { public_key } = await res.json();

    // 5. Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    });

    // 6. Send subscription to backend
    const sub = subscription.toJSON();
    await fetch(`${API}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: sub.keys,
        user_agent: navigator.userAgent,
      }),
    });

    console.log('[Push] Subscribed successfully');
    return true;
  } catch (err) {
    console.error('[Push] Registration failed:', err);
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
