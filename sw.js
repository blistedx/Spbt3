// S.P. Badminton Tourney 3 · Service Worker
const CACHE_NAME = 'sp3-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  '/404.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.png',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/alert-modal.js',
  '/cookie-consent.js',
  '/pwa-install.js',
  '/analytics.js',
  '/social-share.js'
];

// Install: Cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SP3 ServiceWorker] Pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clear out outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests or socket.io / mqtt
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/socket.io') || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Network-first for dynamic API endpoints
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // Stale-While-Revalidate for app shell & static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // If offline and requesting navigation HTML, return cached index
        if (request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/404.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// ================= WEB PUSH NOTIFICATIONS =================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'S.P. Badminton Tourney 3', body: event.data.text() };
    }
  }

  const title = data.title || 'S.P. Badminton Tourney 3';
  const options = {
    body: data.body || 'Live Match & Tournament Update',
    icon: data.icon || '/logo.png',
    badge: data.badge || '/favicon-32x32.png',
    tag: data.tag || 'sp3-alert',
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      url: (data.data && data.data.url) || data.url || '/',
      timestamp: (data.data && data.data.timestamp) || Date.now()
    },
    actions: [
      { action: 'open', title: '🏸 Open View' },
      { action: 'dismiss', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(self.location.origin)) {
            client.focus();
            if ('navigate' in client && targetUrl !== '/') {
              client.navigate(targetUrl);
            }
            return;
          }
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
