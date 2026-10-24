// Service worker: app-shell offline beschikbaar (cache-first), nieuwe versies via "Vernieuwen".
const VERSION = 'filmatelier-v8';
const FONT_CACHE = 'filmatelier-fonts';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
  './js/app.js', './js/util.js', './js/store.js', './js/fountain.js', './js/scenes.js', './js/ai.js', './js/sun.js', './js/timecode.js', './js/grid.js', './js/folder.js', './js/palette.js', './js/docx.js', './js/collab.js', './js/modules/collab.js',
  ...['dashboard', 'ideas', 'structure', 'characters', 'world', 'treatment', 'script', 'cards', 'analysis', 'tableread', 'writer', 'guide', 'breakdown', 'shots', 'stripboard', 'people', 'locations', 'gear', 'budget', 'mood', 'tasks', 'callsheet', 'takes', 'post', 'festivals', 'tools', 'project']
    .map((m) => `./js/modules/${m}.js`),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION && k !== FONT_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Lettertypes (Google Fonts): na de eerste keer uit de cache, zodat de app ook offline zijn typografie houdt.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; } catch { return new Response('', { status: 503 }); }
    })());
    return;
  }
  if (url.origin !== location.origin) return; // API-verkeer en de SDK (AI-hulp) altijd via het netwerk
  // Netwerk eerst (altijd de nieuwste versie), met de cache als terugval wanneer je offline bent of het netwerk traag is.
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const fromCache = async () => await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    // cache: 'no-cache' = altijd bij de server hervalideren (304 als er niets veranderd is), zodat modules nooit door elkaar lopen.
    const net = fetch(req, { cache: 'no-cache' }).then((res) => { if (res.ok && res.type === 'basic') cache.put(req, res.clone()); return res; });
    try {
      return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
    } catch {
      const hit = await fromCache();
      if (hit) return hit;
      try { return await net; } catch { return new Response('Offline', { status: 503, statusText: 'Offline' }); }
    }
  })());
});
