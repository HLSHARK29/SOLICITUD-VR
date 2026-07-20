const CACHE_NAME = 'solicitud-vr-v1';

// Lista de archivos para precachear
const ASSETS = [
  '/SOLICITUD-VR/index.html',
  '/SOLICITUD-VR/js/app.js',
  '/SOLICITUD-VR/js/auth.js',
  '/SOLICITUD-VR/manifest.json',
  '/SOLICITUD-VR/assets/icon-192x192.png',
  '/SOLICITUD-VR/assets/icon-512x512.png'
];

// Instalar y forzar el control del sitio
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Estrategia: Network First (Red primero, si falla, usa caché)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Si la red responde, guardamos la versión fresca en caché
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, res.clone());
          return res;
        });
      })
      .catch(() => {
        // Si no hay red, buscamos en caché
        return caches.match(e.request);
      })
  );
});

// Limpieza de versiones viejas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
});