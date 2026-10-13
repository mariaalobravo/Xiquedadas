// src/sw.ts — service worker: caché de la app + notificaciones push
/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const d = event.data?.json() ?? { title: 'Planes', body: '' };
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: '/icon-192.png',
      data: { url: d.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});
