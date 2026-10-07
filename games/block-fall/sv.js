const CACHE_NAME = 'block-fall-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './js/constants.js',
    './js/piece.js',
    './js/board.js',
    './js/main.js'
];

// Кэшируем файлы при установке
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

// Отдаем файлы из кэша, если нет интернета
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});