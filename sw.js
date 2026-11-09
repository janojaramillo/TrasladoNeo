/* STABLE Neo — service worker
   Funciona con o sin internet. Rutas relativas: sirve en cualquier
   carpeta de GitHub Pages (p. ej., /STABLE-Neo/).
   Al publicar una versión nueva de index.html, sube el número de VERSION. */
const VERSION = 'stableneo-v1.1.2';
const CORE = ['./', './index.html'];
const FONTS = 'stableneo-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Página: red primero (para recibir actualizaciones), copia local si no hay conexión
  if (req.mode === 'navigate' || (url.origin === location.origin && url.pathname.endsWith('.html'))) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Tipografías de Google: caché primero; si nunca se descargaron, la app usa fuentes del sistema
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then((c) =>
        c.match(req).then((hit) =>
          hit || fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; })
                         .catch(() => new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } }))
        )
      )
    );
    return;
  }

  // Resto del mismo origen: caché primero
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
