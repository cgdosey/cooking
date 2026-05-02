// Recipe Ripper — Service Worker
// BUILD: 2026-05-01c
// ─────────────────────────────────────────────────────────────────────────────
// HOW UPDATES WORK
//   When you deploy a new version of recipe-ripper.html, also update the
//   BUILD date above (e.g. 2025-05-02). That single change makes browsers
//   treat this as a new service worker, which kicks off the install → activate
//   cycle and shows the "New version available" banner to anyone who already
//   has the app open.
// ─────────────────────────────────────────────────────────────────────────────

const BUILD    = '2026-05-01c';
const CACHE    = 'recipe-ripper-' + BUILD;
const APP_FILE = './recipe-ripper.html';

// ── INSTALL ──────────────────────────────────────────────────────────────────
// Cache the app shell immediately and skip the waiting phase so the new
// service worker takes over all open tabs without requiring a manual reload.
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.add(APP_FILE))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
// Purge all caches that don't match the current BUILD, claim all clients so
// the new SW takes effect immediately, then notify every open tab.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────
// Navigation requests (opening the app): network-first so you always get
// the latest HTML when online; fall back to cache when offline.
//
// Everything else (API calls to Groq / USDA / Jina): pass straight through —
// we never want to cache dynamic API responses.
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Only intercept same-origin requests for the app file itself
  const isAppShell =
    request.mode === 'navigate' ||
    url.pathname.endsWith('recipe-ripper.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/');

  if (!isAppShell) return; // Let API / external requests go straight to network

  e.respondWith(
    fetch(request)
      .then(res => {
        // Refresh the cache with the latest copy from GitHub
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
        return res;
      })
      .catch(() =>
        // Offline fallback — serve what we have in cache
        caches.match(request) || caches.match(APP_FILE)
      )
  );
});
