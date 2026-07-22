// Service worker minimal — cuma untuk syarat "installable" PWA.
// Sengaja TIDAK cache data/API (Supabase, Google Sheets) supaya data selalu real-time,
// tidak ada risiko data basi/stale karena caching.
self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  // Passthrough langsung ke network — tidak ada caching sama sekali.
  e.respondWith(fetch(e.request).catch(() => new Response('Offline — sambungkan internet dulu.', {status: 503, statusText: 'Offline'})));
});
