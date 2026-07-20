const CACHE_NAME = 'solicitud-vr-v1';

// Al instalar, solo cacheamos lo esencial
self.addEventListener('install', (e) => {
    self.skipWaiting(); // Fuerza a que tome el control inmediatamente
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([
        './index.html',
        './js/app.js',
        './js/auth.js',
        './manifest.json'
    ])));
});

// Estrategia: Network First (Red primero, luego caché)
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((res) => {
                // Si la red responde, actualizamos la caché con la nueva versión
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, res.clone());
                    return res;
                });
            })
            .catch(() => {
                // Si falla la red (sin internet), vamos a la caché
                return caches.match(e.request);
            })
    );
});

// Limpieza de cachés viejas al actualizar
self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => {
        return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    }));
});