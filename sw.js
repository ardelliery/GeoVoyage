const CACHE_NAME = 'geovoyage-v7';
const TILE_CACHE_NAME = 'geovoyage-tiles-v1';

// Liste des ressources statiques essentielles de l'application
const ASSETS_TO_CACHE = [
  './',
  './pvi.html',
  './map.js',
  './modals.js',
  './state.js',
  './ui.js',
  './pvi.css',
  './manifest.json',
  './pvi_192.png',
  './pvi_512.png',
  'https://unpkg.com/leaflset@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/exif-js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Installation : Mise en cache initiale des fichiers de base
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force l'activation immédiate du nouveau Service Worker
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Mise en cache des actifs statiques...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => console.error('[Service Worker] Erreur pré-caching:', err))
  );
});

// Activation : Nettoyage des anciens caches obsolètes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== TILE_CACHE_NAME) {
            console.log('[Service Worker] Suppression de l\'ancien cache :', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes réseau
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Gestion spécifique des tuiles OpenStreetMap (Cache-First dédié)
  if (url.hostname.includes('openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            return new Response('Tuile hors-ligne non disponible', { status: 404, statusText: 'Offline' });
          });
        });
      })
    );
    return;
  }

  // 2. Gestion standard pour l'application et ses dépendances (Cache-First avec fallback réseau)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback de navigation hors-ligne
        if (event.request.mode === 'navigate') {
          return caches.match('./pvi.html') || caches.match('./');
        }
      });
    })
  );
});