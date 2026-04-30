/* Plexify Studio — Service Worker
   Push Notifications + Asset Caching para rendimiento */

const CACHE_VERSION = 'plexify-v66';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Assets estaticos para pre-cachear (shell de la app)
const PRECACHE_URLS = [
  '/AlPelo-CRM/',
  '/AlPelo-CRM/index.html',
];

// ============================================
// INSTALL — pre-cachear assets criticos
// ============================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ============================================
// ACTIVATE — limpiar caches antiguos
// ============================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================
// FETCH — estrategia de caching por tipo
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo cachear requests GET del mismo origen
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
    return;
  }

  // API calls — network-only (no cachear datos dinamicos)
  if (url.pathname.includes('/api/')) {
    return;
  }

  // Assets estaticos (JS, CSS, imagenes, fuentes) — cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|eot)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Solo cachear respuestas exitosas
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // HTML / navegacion — network-first con fallback a cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/AlPelo-CRM/')))
    );
    return;
  }
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: 'Plexify Studio', body: event.data?.text() || '' };
  }

  const options = {
    body: data.body || '',
    icon: '/AlPelo-CRM/icon-192.svg',
    badge: '/AlPelo-CRM/badge-72.svg',
    data: { url: data.url || '/' },
    tag: 'plexify-' + (data.url || Date.now()),
    renotify: true,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Plexify Studio', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  const fullUrl = self.location.origin + '/AlPelo-CRM' + url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/AlPelo-CRM') && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});
