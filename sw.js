// Service Worker for Restaurant Ordering App
// Enables offline functionality and caching

const CACHE_NAME = 'restaurant-app-v7';
const urlsToCache = [
  '/',
  '/index.html',
  '/menu-book.css',
  '/menu-book-cover.css',
  '/menu-book.js',
  '/recommendation.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Force update all clients
      return self.clients.claim();
    })
  );
  // Force skip waiting to activate immediately
  self.skipWaiting();
});

// Fetch event - network first, cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API requests (let them go to network)
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  // For HTML files, COMPLETELY BYPASS Service Worker - let browser handle it directly
  const isHTML = event.request.destination === 'document' || 
                 event.request.url.endsWith('.html') ||
                 (event.request.url.endsWith('/') && !event.request.url.includes('.'));
  
  if (isHTML) {
    console.log('🔄 Service Worker: Bypassing for HTML - letting browser handle:', event.request.url);
    // Don't intercept HTML requests at all - let browser fetch directly
    return;
  }
  
  // For other files (CSS, JS, images), use network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Don't cache if not a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone the response for caching
        const responseToCache = response.clone();
        
        // Cache the response for offline use
        caches.open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache);
          });
        
        return response;
      })
      .catch(() => {
        // If network fails, try cache as fallback
        return caches.match(event.request);
      })
  );
});

