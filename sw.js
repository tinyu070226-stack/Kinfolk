// Service Worker - No Cache (always fetch fresh)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => self.clients.claim())
    );
});
self.addEventListener('fetch', event => {
    event.respondWith(fetch(event.request));
});
