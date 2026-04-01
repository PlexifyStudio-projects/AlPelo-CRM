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
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/AlPelo-CRM/' });
    await navigator.serviceWorker.ready;

    const res = await fetch(`${API}/push/vapid-key`, { credentials: 'include' });
    if (!res.ok) return false;
    const { public_key } = await res.json();

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const existingKey = existing.options?.applicationServerKey;
      const newKeyBytes = urlBase64ToUint8Array(public_key);
      let keyMatch = false;
      if (existingKey) {
        const existingArr = new Uint8Array(existingKey);
        keyMatch = existingArr.length === newKeyBytes.length &&
          existingArr.every((v, i) => v === newKeyBytes[i]);
      }
      if (keyMatch) {
        const sub = existing.toJSON();
        fetch(`${API}/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, user_agent: navigator.userAgent }),
        }).catch(() => {});
        return true;
      }
      await existing.unsubscribe();
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const appServerKey = urlBase64ToUint8Array(public_key);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });

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

    return true;
  } catch {
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

    await subscription.unsubscribe();

    await fetch(`${API}/push/unsubscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch { /* silent */ }
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
