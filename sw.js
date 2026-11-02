const CACHE_NAME = 'geovoyage-v2';

// Liste des ressources essentielles à mettre en cache lors de l'installation
const ASSETS_TO_CACHE = [
  './',
  './pvi.html',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/exif-js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Installation : Mise en cache explicite des fichiers de base
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Active immédiatement le nouveau Service Worker
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Mise en cache des ressources PWA...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => console.error('[Service Worker] Erreur au pré-caching:', err))
  );
});

// Activation : Nettoyage des anciens caches si la version change
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Suppression de l\'ancien cache :', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes réseau : Stratégie Cache-First avec Fallback Réseau
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET (ex: POST, extensions)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // 1. Si la ressource est déjà dans le cache, on la renvoie immédiatement
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Sinon, on va la chercher sur le réseau et on tente de la mettre en cache
      return fetch(event.request).then((networkResponse) => {
        // Ne mettre en cache que les réponses valides (200 ou opaque pour CDN)
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // 3. Secours hors-ligne : Si la navigation vers une page HTML échoue, renvoyer pvi.html
        if (event.request.mode === 'navigate') {
          return caches.match('./pvi.html') || caches.match('./');
        }
      });
    })
  );
});