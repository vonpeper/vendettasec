const CACHE_NAME = "vendetta-player-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/icon.png",
  "/library",
  "/stage",
  "/diagnostics",
  "/settings"
];

// Instalar service worker y cachear assets iniciales
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activar service worker y limpiar cachés antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia Cache-First con fallback a Red para assets estáticos
self.addEventListener("fetch", (event) => {
  // Ignorar peticiones que no sean GET
  if (event.request.method !== "GET") return;

  // Ignorar peticiones de APIs internas, WebSockets, o almacenamiento (como OPFS)
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Devolver el asset desde caché y actualizar en background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Si no hay red y es una navegación de página, intentar devolver la raíz
        if (event.request.mode === "navigate") {
          return caches.match("/");
        }
      });
    })
  );
});
