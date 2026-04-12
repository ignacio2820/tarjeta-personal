var CACHE_NAME = "elitecard-shell-v1";
var PRECACHE = [
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(PRECACHE); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event) {
  var req = event.request;
  // Solo interceptamos GET
  if (req.method !== "GET") return;
  // Firestore, Auth, Storage y APIs externas: directo a red, sin cache
  var url = req.url;
  if (
    url.indexOf("firestore.googleapis.com") >= 0 ||
    url.indexOf("firebasestorage.googleapis.com") >= 0 ||
    url.indexOf("identitytoolkit.googleapis.com") >= 0 ||
    url.indexOf("securetoken.googleapis.com") >= 0 ||
    url.indexOf("googleapis.com") >= 0 ||
    url.indexOf("gstatic.com") >= 0 ||
    url.indexOf("fonts.googleapis.com") >= 0 ||
    url.indexOf("cdnjs.cloudflare.com") >= 0 ||
    url.indexOf("cdn.tailwindcss.com") >= 0
  ) {
    return;
  }
  // HTML y JS: network-first, sin cachear (Cache-Control del servidor manda)
  if (
    req.destination === "document" ||
    req.destination === "script" ||
    url.indexOf(".html") >= 0 ||
    url.indexOf(".js") >= 0
  ) {
    event.respondWith(
      fetch(req).catch(function() { return caches.match(req); })
    );
    return;
  }
  // Íconos y assets estáticos: cache-first
  event.respondWith(
    caches.match(req).then(function(cached) {
      return cached || fetch(req).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(req, clone);
          });
        }
        return response;
      });
    })
  );
});
