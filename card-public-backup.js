/**
 * MascotBook — carga mínima (v2).
 * Reemplaza card-public.js cuando lo renombres en card.html.
 */
(function () {
  "use strict";

  function uidFromUrl() {
    var q = new URLSearchParams(window.location.search);
    var uid =
      q.get("id") ||
      q.get("ID") ||
      q.get("user") ||
      q.get("uid") ||
      "";
    if (!uid && window.location.hash) {
      var m = window.location.hash.match(/(?:^|[?&#])id=([^&]+)/i);
      if (m && m[1]) {
        try {
          uid = decodeURIComponent(m[1]);
        } catch (e) {
          uid = m[1];
        }
      }
    }
    return String(uid || "").trim();
  }

  function loadingLayer() {
    var el = document.getElementById("ec-mb-v2-loading");
    if (el) return el;
    el = document.createElement("div");
    el.id = "ec-mb-v2-loading";
    el.textContent = "Cargando...";
    el.setAttribute(
      "style",
      [
        "position:fixed",
        "inset:0",
        "margin:0",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "background:#ffffff",
        "color:#1a1a1a",
        "font-family:system-ui,-apple-system,sans-serif",
        "font-size:1rem",
        "z-index:2147483647",
      ].join(";")
    );
    document.body.appendChild(el);
    return el;
  }

  function applyDoc(d) {
    // Funcion repetitiva para matar modales rebeldes
    var cleanup = function () {
      var junk = document.querySelectorAll(
        '[id*="modal"], [class*="modal"], [id*="share"], [class*="backdrop"], .fixed.inset-0, button[onclick*="close"]'
      );
      junk.forEach(function (el) {
        el.remove();
      });
      document.body.classList.remove("overflow-hidden");
    };

    // Limpiamos ahora y durante los proximos 3 segundos
    cleanup();
    var timer = setInterval(cleanup, 500);
    setTimeout(function () {
      clearInterval(timer);
    }, 3000);

    // Inyectar los datos de Roko
    var nombre = document.getElementById("mascot-name");
    var raza = document.getElementById("mascot-sub");
    var historia = document.getElementById("mascot-bio");

    if (nombre) nombre.innerText = d.nombre || "Sin nombre";
    if (raza) raza.innerText = d.raza || "";
    if (historia) historia.innerText = d.historia || "";

    // Forzar visibilidad del contenedor principal
    var layout = document.getElementById("layout-mascot");
    if (layout) {
      layout.style.setProperty("display", "block", "important");
      layout.classList.remove("hidden");
    }
  }


  loadingLayer();

  var uid = uidFromUrl();
  if (!uid || typeof firebase === "undefined" || !window.FIREBASE_WEB_CONFIG) {
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_WEB_CONFIG);
    }
  } catch (e) {}

  firebase
    .firestore()
    .collection("mascotas")
    .doc(uid)
    .get()
    .then(function (snap) {
      if (!snap.exists) {
        return;
      }
      document.body.style.display = "block";

      var layer = document.getElementById("ec-mb-v2-loading");
      if (layer) {
        layer.remove();
      }

      var layout = document.getElementById("layout-mascot");
      if (layout) {
        layout.classList.remove("hidden");
      }

      applyDoc(snap.data() || {});
      document.querySelectorAll(".hidden, .invisible").forEach(function (el) {
        el.classList.remove("hidden", "invisible");
      });
    })
    .catch(function () {});
})();
