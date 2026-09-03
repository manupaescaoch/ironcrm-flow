/* EVO OPS — service worker exclusivo de notificações push (Web Push).
   Não faz cache de app shell nem intercepta navegações. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_e) {
    payload = { titulo: 'EVO OPS', mensagem: event.data ? event.data.text() : '' };
  }

  const title = payload.titulo || payload.title || 'EVO OPS';
  const body = payload.mensagem || payload.body || '';
  const url = payload.url || '/ops/alertas';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/ops-icon-192.png',
      badge: '/ops-icon-192.png',
      tag: payload.tag || undefined,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/ops/alertas';
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.includes('/ops')) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
