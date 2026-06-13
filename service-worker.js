/* service-worker.js
   Offline support for the app shell + runtime caching of hashed build assets.

   Strategy:
   - Navigations (HTML): network-first, fall back to cached shell so a fresh deploy is
     always picked up online but the app still loads offline.
   - Hashed static assets (JS/CSS/fonts/images): stale-while-revalidate. Filenames are
     content-hashed by CRA, so a cached copy is never wrong; we serve it instantly and
     refresh in the background.
   - Large remote media (exercise GIFs/images from third-party hosts) are left to the
     network and degrade gracefully when offline.
*/

const VERSION = 'v2';
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;
const SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations → network-first with offline shell fallback.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Same-origin static assets → stale-while-revalidate.
  if (sameOrigin) {
    e.respondWith(
      caches.open(ASSET_CACHE).then(async cache => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then(res => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
