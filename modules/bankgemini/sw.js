const CACHE_NAME = 'gemini-prep-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './ai-helper.html',
  './style.css',
  './script.js',
  './questions.js',
  './icoppdag.png',
  './manifest.json'
];

// 1. Install Service Worker & Cache Fail Utama
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching semua aset...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Activate & Bersihkan Cache Lama (Jika Ada Update)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Membuang cache lama:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
});

// 3. Fetch Strategy: Cache First, Fallback to Network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Jika ada dalam cache, guna cache. Jika tiada, ambil dari internet.
      return cachedResponse || fetch(event.request);
    })
  );
});