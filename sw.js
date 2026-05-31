self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("qmos-cache").then(cache => {
      return cache.addAll([
        "./",
        "./index.html",
        "./ii6k.css",
        "./ii6k.js",
        "./SA.png"
      ]);
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
