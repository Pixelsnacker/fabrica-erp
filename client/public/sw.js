// Fabrica ERP Service Worker
const CACHE_NAME = 'fabrica-erp-v1';

// Beim Installieren: App-Shell cachen
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Beim Aktivieren: alten Cache löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network-first für API, Cache-first für Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API-Anfragen immer vom Server (kein Caching)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Für alle anderen Anfragen: Network-first mit Cache-Fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Nur erfolgreiche GET-Anfragen cachen
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
