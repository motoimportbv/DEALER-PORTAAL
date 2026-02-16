const CACHE_VERSION = 'v3';
const CACHE_NAME = `moto-import-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Only cache essential offline files
const OFFLINE_ASSETS = [
  '/offline.html',
  '/manifest.json'
];

// Install event - cache only essential offline files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching offline assets');
      return cache.addAll(OFFLINE_ASSETS).catch(err => {
        console.log('[SW] Failed to cache some assets:', err);
      });
    })
  );
  // Force immediate activation - don't wait for old SW to stop
  self.skipWaiting();
});

// Activate event - clean up ALL old caches immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - NETWORK FIRST for everything (fixes iOS refresh issues)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip external requests
  if (!url.origin.includes(self.location.origin)) {
    return;
  }

  // API requests - always network only, no caching
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline - geen verbinding' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // For ALL other requests: Network First strategy
  // This ensures iOS users always get fresh content on refresh
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response.ok && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed - try cache as fallback
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For navigation requests, show offline page
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          // For other requests, return error
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Listen for skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting requested');
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW] Clear cache requested');
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    });
  }
});

// Handle push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = { title: 'Moto Import', body: 'Nieuwe update beschikbaar', url: '/' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    vibrate: [200, 100, 200, 100, 200], // Motorcycle-like vibration pattern
    tag: 'moto-import-notification',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/',
      timestamp: data.timestamp
    },
    actions: [
      { action: 'open', title: 'Bekijken' },
      { action: 'close', title: 'Sluiten' }
    ]
  };

  // Try to play sound in any open client windows
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Send message to all clients to play sound
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'PLAY_NOTIFICATION_SOUND' });
        });
      })
    ])
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus().then((focusedClient) => {
            if (focusedClient) {
              focusedClient.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: urlToOpen
              });
            }
            return focusedClient;
          }).catch(() => {
            return clients.openWindow(urlToOpen);
          });
        }
      }
      return clients.openWindow(urlToOpen);
    }).catch((err) => {
      console.error('[SW] Error handling notification click:', err);
      return clients.openWindow(urlToOpen);
    })
  );
});
