// sw.js — service worker minimal
// Rôle : rendre l'app installable (condition technique des navigateurs) et
// permettre une ouverture de secours hors-ligne. Ne fait pas de cache agressif
// pour éviter de servir une version périmée de l'app.

const CACHE_NAME = 'ansahni-shell-v1';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie "réseau d'abord" : on essaie toujours d'avoir la dernière version,
// et on ne retombe sur le cache que si le réseau est indisponible (hors-ligne).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('/index.html')))
  );
});
