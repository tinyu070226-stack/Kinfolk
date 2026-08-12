// Service Worker - Cache Buster v3
// Always fetch fresh from network, no caching
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.clients.claim())
    );
});
self.addEventListener('fetch', event => {
    // Pass through all requests without caching
    event.respondWith(fetch(event.request));
});
