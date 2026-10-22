// Service Worker untuk Empayar S Kreatif PWA
// Version: 1.0

const CACHE_NAME = 'esk-cache-v2'; // Tukar v1 jadi v2
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  if (url.includes('supabase') || 
      url.includes('arleta.site') ||
      url.includes('jsdelivr') ||
      url.includes('unpkg') ||
      url.includes('github.com') ||
      url.includes('githubusercontent')) {
    return; 
  }
  
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        fetch(event.request).then(freshResponse => {
          if (freshResponse && freshResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, freshResponse.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(err => {
        console.log('[SW] Fetch failed:', err);
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
