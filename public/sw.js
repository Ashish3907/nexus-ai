const CACHE_NAME = 'nexus-ai-cache-v1';
const assets = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/particles.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.Power'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(assets);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('push', event => {
    const data = event.data ? event.data.json() : { title: 'NexusAI', body: 'System Update Completed' };
    const options = {
        body: data.body,
        icon: 'https://cdn-icons-png.flaticon.com/512/2103/2103633.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/2103/2103633.png',
        vibrate: [100, 50, 100]
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
});
