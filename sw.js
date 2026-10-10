/* Service worker de Focus OS. Solo guarda en caché los archivos de la app (versión 87a586613c); NO toca los datos (localStorage).
   Caché primero para que funcione sin conexión; en la instalación se salta la caché HTTP del navegador (cache:'reload') para no guardar copias viejas; cada build cambia la versión y retira cachés antiguas. */
const V = 'focusos-87a586613c', FILES = ["./","icon-180.png","icon-192.png","icon-512.png","icon-maskable-512.png","index.html","manifest.webmanifest"];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => Promise.all(FILES.map(f => c.add(new Request(f, { cache: 'reload' }))))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('focusos-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => { if (res && res.ok && new URL(r.url).origin === self.location.origin) { const c = res.clone(); caches.open(V).then(x => x.put(r, c)); } return res; })
    .catch(() => r.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
