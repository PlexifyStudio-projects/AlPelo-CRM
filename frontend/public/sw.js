/* Plexify Studio — Service Worker for Web Push Notifications */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: 'Plexify Studio', body: event.data?.text() || '' };
  }

  const options = {
    body: data.body || '',
    icon: '/AlPelo-CRM/icon-192.png',
    badge: '/AlPelo-CRM/badge-72.png',
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
      // Focus existing tab if found
      for (const client of windowClients) {
        if (client.url.includes('/AlPelo-CRM') && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      // Open new tab
      return clients.openWindow(fullUrl);
    })
  );
});

// Keep service worker alive
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
