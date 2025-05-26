const CACHE_NAME = "plagknight-v1.0.3";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/pages/about.html",
  "/pages/guide.html",
  "/pages/contact.html",
  "/css/style.css",
  "/css/about.css",
  "/css/contact.css",
  "/css/guide.css",
  "/css/index.css",
  "/js/script.js",
  "/js/main.js",
  "/js/main.worker.js",
  "/js/mammoth.browser.js",
  "/js/pdf.mjs",
  "/js/pdf.worker.mjs",
  "/images/plagknight_128.png",
  "/images/plagknight_512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
