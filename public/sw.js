/* MoneyFlow service worker.
 * Deliberately has NO fetch handler — it never caches page assets, so it can
 * never serve stale HTML/icons. It exists only to show notifications (local
 * "due soon" reminders now, and server web-push later if wired up).
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  const title = data.title || 'MoneyFlow';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/app-icon-v4-192.png',
      badge: '/icons/app-icon-v4-192.png',
      tag: data.tag || 'moneyflow',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
