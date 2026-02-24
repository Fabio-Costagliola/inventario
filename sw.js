// ====== CONFIGURAZIONE VERSIONE ======
const CACHE_VERSION = 'v1.0.3';  // <--- aggiorna qui a ogni release
const CACHE_NAME = `inventario-${CACHE_VERSION}`;

// Elenco asset da mettere in cache all'install
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-1024.png',
  // Aggiungi eventuali altri asset statici (css/js separati, font, ecc.)
];

// Invia la versione a tutte le pagine controllate
async function broadcastVersion() {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clientsList) {
    client.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }
}

// Install: precache asset
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  // Forza il passaggio allo stato "activated" subito
  self.skipWaiting();
});

// Activate: pulizia cache vecchie + broadcast versione
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(key => (key.startsWith('inventario-') && key !== CACHE_NAME) ? caches.delete(key) : Promise.resolve())
    );
    await self.clients.claim();
    await broadcastVersion();
  })());
});

// Strategia di fetch: cache-first con fallback alla rete, e fallback alla cache se offline
self.addEventListener('fetch', (event) => {
  const req = event.request;
  event.respondWith((async () => {
    // Prova cache
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Metti in cache solo richieste GET stesse-origin (per evitare problemi con CORS/POST)
      if (req.method === 'GET' && new URL(req.url).origin === location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // Se sei offline e non c'è cache, prova a ripiegare sulla homepage
      const fallback = await caches.match('./index.html');
      return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

// Gestione messaggi dalla pagina (es. richiesta esplicita della versione)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_SW_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: CACHE_VERSION });
  }

});
