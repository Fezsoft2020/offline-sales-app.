// Service Worker for Inventory & Sales Management System
// Version: 2.0

const CACHE_NAME = 'inventory-sales-v2';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Install event - cache essential files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker installed');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached response if found
        if (cachedResponse) {
          console.log('Serving from cache:', event.request.url);
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache if not a successful response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Clone the response
            const responseToCache = networkResponse.clone();
            
            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('Caching new resource:', event.request.url);
              });
            
            return networkResponse;
          })
          .catch(error => {
            console.log('Fetch failed; returning offline page:', error);
            
            // If it's an HTML request, return the cached index.html
            if (event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            // For other file types, return a fallback
            return new Response(JSON.stringify({
              error: 'Network error',
              message: 'You are offline. Please check your connection.'
            }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' }
            });
          });
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', event => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncSalesData());
  }
});

// Sync sales data when back online
function syncSalesData() {
  // This would sync with a server if you had one
  // For now, just log that sync was attempted
  console.log('Attempting to sync sales data...');
  return Promise.resolve();
}

// Push notifications (optional - for future enhancements)
self.addEventListener('push', event => {
  console.log('Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'Inventory update',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'inventory-update'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Inventory Manager', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event.notification.tag);
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Message handler for communication with app
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_DATA') {
    // Cache additional data if needed
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache specific data here
        console.log('Caching additional data');
      });
  }
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', event => {
    if (event.tag === 'backup-sync') {
      event.waitUntil(performBackupSync());
    }
  });
}

async function performBackupSync() {
  console.log('Performing periodic backup sync...');
  // Implement backup sync logic here
}

// Error handling
self.addEventListener('error', event => {
  console.error('Service Worker error:', event.error);
});

// Handle service worker updates
self.addEventListener('controllerchange', () => {
  console.log('Controller changed - reloading page');
  // Send message to refresh the page
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.postMessage({ type: 'RELOAD_PAGE' }));
  });
});
