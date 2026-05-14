const CACHE_NAME = 'arisan-ladarua-v11';
const urlsToCache = ['./', './index.html', './app.js', './manifest.json', './logo.png'];

self.addEventListener('install', event => {
    self.skipWaiting(); event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); }))));
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('firestore.googleapis.com')) return;
    event.respondWith(caches.match(event.request).then(r => r || fetch(event.request)));
});
