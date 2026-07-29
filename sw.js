/* ============================================================
   My Secret Diary — service worker

   Its only job is to keep the app itself available offline.
   It never touches your pages: your diary lives in localStorage,
   which a service worker cannot read. Nothing here is sent
   anywhere — there is no network call in this file at all beyond
   fetching the app's own files.
   ============================================================ */

const CACHE = 'my-secret-diary-v2';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/styles.css',
  './assets/crypto.js',
  './assets/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Fonts are a nicety, not a dependency: cache them if they arrive,
  // fall back to the local stack if they never do.
  const isFont = url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com');

  if (isFont) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => new Response('', { status: 504 })))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App shell: serve from cache first so it opens instantly and offline,
  // and refresh the copy in the background when there is a network.
  e.respondWith(
    caches.match(req).then(hit => {
      const live = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || live;
    })
  );
});
