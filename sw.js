var CACHE_NAME = "elitecard-shell-v2";
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
  // HTML: network-first; offline → caché del documento o index shell
  if (
    req.destination === "document" ||
    url.indexOf(".html") >= 0 ||
    url.indexOf("/card") >= 0
  ) {
    // Si la URL tiene ?id= siempre va directo a red, sin caché.
    // Evita que la PWA instalada de un usuario sirva su tarjeta
    // cuando otro usuario abre un link diferente.
    var hasId = url.indexOf("?id=") >= 0 ||
                url.indexOf("&id=") >= 0 ||
                url.indexOf("/card") >= 0;
    if (hasId) {
      // Network-only: nunca cachear tarjetas con ?id=
      event.respondWith(fetch(req));
      return;
    }
    // Sin ?id=: network-first con fallback a caché
    event.respondWith(
      fetch(req).catch(function() {
        return caches.match(req).then(function(cached) {
          if (cached) return cached;
          return caches.match("./");
        });
      })
    );
    return;
  }
  // JS: network-first, sin cachear (Cache-Control del servidor manda)
  if (
    req.destination === "script" ||
    url.indexOf(".js") >= 0
  ) {
    event.respondWith(
      fetch(req).catch(function() { return caches.match(req); })
    );
    return;
  }
  // Íconos y assets estáticos: cache-first
  // Nunca cachear URLs con ?id= (son tarjetas de usuarios específicos)
  if (url.indexOf("?id=") >= 0 || url.indexOf("&id=") >= 0) {
    event.respondWith(fetch(req));
    return;
  }
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
