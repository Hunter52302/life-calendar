// Push notification handler — merged into the Workbox service worker at build time
// via vite-plugin-pwa's additionalManifestEntries / custom SW setup.
// This file is imported by the SW precache manifest entry.

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { title: 'PLS Calendar' }; }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'PLS Calendar', {
      body:  data.body  ?? 'Tap to open',
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      data:  { url: data.url ?? '/' },
      tag:   data.tag ?? 'pls-calendar',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const url = event.notification.data?.url ?? '/';
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
