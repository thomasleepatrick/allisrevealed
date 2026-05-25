// All is Revealed — Service Worker PWA
// Versione cache: incrementa per forzare aggiornamento
const CACHE_VERSION = 'air-v1';
const CACHE_STATIC = [
  '/allisrevealed/',
  '/allisrevealed/index.html',
  '/allisrevealed/manifest.json',
  '/allisrevealed/img/icon-192.png',
  '/allisrevealed/img/icon-512.png',
  '/allisrevealed/img/apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Raleway:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap',
];

// Install: pre-cacha i file statici
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(CACHE_STATIC).catch(err => {
        console.warn('[SW] Pre-cache parziale:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: rimuovi cache vecchie
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first per asset statici, network-first per HTML
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Solo GET
  if (e.request.method !== 'GET') return;

  // Font Google: stale-while-revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE_VERSION).then(cache =>
        cache.match(e.request).then(cached => {
          const network = fetch(e.request).then(resp => {
            cache.put(e.request, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // index.html: network-first (per aggiornamenti)
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Tutto il resto (img, manifest, sw): cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});
