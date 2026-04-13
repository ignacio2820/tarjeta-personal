(function () {
  "use strict";

  var cfg = window.normalizeTarjetaData ? window.normalizeTarjetaData() : {};
  var analyticsTrack = function () {};

  function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function buildVCard(c) {
    var full = (c.nombreCompleto || c.nombre || "").trim();
    var family;
    var given;
    if (c.vcardApellidos != null && String(c.vcardApellidos).trim() !== "") {
      family = String(c.vcardApellidos).trim();
      given = String(c.vcardNombres || "").trim();
    } else {
      var parts = full.split(/\s+/).filter(Boolean);
      family = parts.length > 1 ? parts[parts.length - 1] : full;
      given = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
    }

    var lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "FN:" + escapeVCard(full),
      "N:" + escapeVCard(family) + ";" + escapeVCard(given) + ";;;",
    ];

    if (c.telefono) {
      lines.push("TEL;TYPE=VOICE:" + escapeVCard(String(c.telefono).trim()));
    }
    if (c.email) {
      lines.push("EMAIL;TYPE=INTERNET:" + escapeVCard(c.email));
    }
    if (c.emailInstitucional) {
      lines.push("EMAIL;TYPE=WORK:" + escapeVCard(c.emailInstitucional));
    }
    var waDigits = onlyDigits(c.whatsappNumero || c.whatsapp);
    if (waDigits) {
      lines.push("TEL;TYPE=CELL:" + escapeVCard(waDigits));
    }
    var orgVcard = c.vcardOrganizacion || c.organizacion || c.empresa;
    if (orgVcard) {
      lines.push("ORG:" + escapeVCard(String(orgVcard).trim()));
    }
    var tit =
      (c.vcardTitulo && String(c.vcardTitulo).trim()) ||
      (c.cargo && String(c.cargo).trim());
    if (tit) {
      lines.push("TITLE:" + escapeVCard(tit));
    }
    if (c.sitioWeb) {
      lines.push("URL:" + escapeVCard(c.sitioWeb));
    }
    if (c.linkedin) {
      lines.push("URL;type=LinkedIn:" + escapeVCard(c.linkedin));
    }
    if (c.instagram) {
      lines.push("URL;type=Instagram:" + escapeVCard(c.instagram));
    }
    if (c.direccionTexto) {
      lines.push("ADR;TYPE=WORK:;;" + escapeVCard(c.direccionTexto) + ";;;;");
    }
    if (c.bio) {
      lines.push("NOTE:" + escapeVCard(c.bio));
    }

    lines.push("END:VCARD");
    return lines.join("\r\n");
  }

  function escapeVCard(text) {
    return String(text || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }

  async function downloadVCard() {
    var body = buildVCard(cfg);
    var filename = "contacto.vcf";
    var nombre = String(cfg.nombreCompleto || cfg.nombre || "Contacto").trim();

    try {
      var file = new File([body], filename, { type: "text/vcard" });
      if (navigator.share && navigator.canShare) {
        var fileOnly = { files: [file] };
        if (navigator.canShare(fileOnly)) {
          await navigator.share({
            files: [file],
            title: "Guardar contacto",
            text: nombre || "Tarjeta de contacto",
          });
          showToast("Elegí Contactos para guardar en el teléfono");
          return;
        }
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }

    var blob = new Blob([body], { type: "text/vcard;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.setAttribute("aria-label", "Descargar contacto " + nombre);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 600);
    showToast("Abrí el archivo para añadir a contactos");
  }

  function showToast(msg) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.add("hidden");
    }, 2500);
  }

  async function shareCard() {
    var url = window.location.href;
    var nombreShare = String(cfg.nombreCompleto || cfg.nombre || "").trim();
    var title = cfg.tituloPagina || nombreShare || "EliteCard - Tarjeta Profesional Digital";
    var text =
      (nombreShare ? nombreShare + " — " : "") + (cfg.cargo || "Mi tarjeta de contacto");

    if (navigator.share) {
      try {
        await navigator.share({ title: title, text: text, url: url });
      } catch (e) {
        if (e && e.name !== "AbortError") {
          await copyFallback(url);
        }
      }
    } else {
      await copyFallback(url);
    }
  }

  async function copyFallback(url) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showToast("Enlace copiado al portapapeles");
      } else {
        window.prompt("Copia este enlace:", url);
      }
    } catch (err) {
      window.prompt("Copia este enlace:", url);
    }
  }

  function pill(href, label, iconClass, iconCircleClass, metricKey) {
    var a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className =
      "ec-contact-button link-pill pill-action grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center overflow-hidden rounded-full border border-neutral-700 bg-[#0a0a0a] py-0.5 pl-0.5 pr-0.5 text-[0.8125rem] font-light tracking-[0.07em] text-[#ebe6dc]";
    a.setAttribute("aria-label", label);

    var circle = document.createElement("span");
    circle.className =
      "pill-icon-disc flex shrink-0 items-center justify-center rounded-full " + iconCircleClass;
    var i = document.createElement("i");
    i.className = iconClass + " text-white";
    i.setAttribute("aria-hidden", "true");
    circle.appendChild(i);

    var labelEl = document.createElement("span");
    labelEl.className = "col-start-2 justify-self-center text-center";
    labelEl.textContent = label;

    var spacer = document.createElement("span");
    spacer.className = "col-start-3";
    spacer.setAttribute("aria-hidden", "true");

    a.appendChild(circle);
    a.appendChild(labelEl);
    a.appendChild(spacer);
    if (metricKey) {
      a.addEventListener("click", function () {
        analyticsTrack(metricKey);
      });
    }
    return a;
  }

  function pillButton(label, iconClass, iconCircleClass, onClick, extraClass, metricKey) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "ec-contact-button link-pill pill-action grid w-full grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center overflow-hidden rounded-full border border-neutral-700 bg-[#0a0a0a] py-0.5 pl-0.5 pr-0.5 text-[0.8125rem] font-light tracking-[0.07em] text-[#ebe6dc] " +
      (extraClass || "");
    btn.setAttribute("aria-label", label);
    btn.addEventListener("click", function (ev) {
      if (metricKey) analyticsTrack(metricKey);
      onClick(ev);
    });

    var circle = document.createElement("span");
    circle.className =
      "pill-icon-disc flex shrink-0 items-center justify-center rounded-full " + iconCircleClass;
    var i = document.createElement("i");
    i.className = iconClass + " text-white";
    i.setAttribute("aria-hidden", "true");
    circle.appendChild(i);

    var labelEl = document.createElement("span");
    labelEl.className = "col-start-2 justify-self-center text-center";
    labelEl.textContent = label;

    var spacer = document.createElement("span");
    spacer.className = "col-start-3";
    spacer.setAttribute("aria-hidden", "true");

    btn.appendChild(circle);
    btn.appendChild(labelEl);
    btn.appendChild(spacer);
    return btn;
  }

  function openWaModal() {
    var modal = document.getElementById("wa-modal");
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.getElementById("wa-nombre").focus();
  }

  function closeWaModal() {
    var modal = document.getElementById("wa-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  function openCalendlyModal(url) {
    var modal = document.getElementById("cal-modal");
    var frame = document.getElementById("cal-iframe");
    if (!modal || !frame) return;
    frame.src = url;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }

  function closeCalendlyModal() {
    var modal = document.getElementById("cal-modal");
    var frame = document.getElementById("cal-iframe");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    if (frame) frame.src = "about:blank";
  }

  function openAgendarCita() {
    var url = (cfg.calendlyUrl || "").trim();
    if (url) {
      openCalendlyModal(url);
      return;
    }
    var num = onlyDigits(cfg.whatsappNumero);
    if (!num) {
      showToast("Configurá Calendly o WhatsApp para agendar");
      return;
    }
    var msg =
      cfg.mensajeCitaWhatsapp ||
      "Hola, me gustaría agendar una reunión con usted.";
    window.open(
      "https://wa.me/" + num + "?text=" + encodeURIComponent(msg),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function buildWhatsAppMessage() {
    var nom = (document.getElementById("wa-nombre").value || "").trim();
    var ape = (document.getElementById("wa-apellido").value || "").trim();
    var tel = (document.getElementById("wa-telefono").value || "").trim();
    var com = (document.getElementById("wa-comentario").value || "").trim();
    var nombreForm = [nom, ape].filter(Boolean).join(" ");
    var parts = [];
    parts.push("Hola, soy " + (nombreForm || "[sin nombre]") + ".");
    parts.push("Mi teléfono: " + (tel || "—") + ".");
    if (com) {
      parts.push("");
      parts.push("Comentario:");
      parts.push(com);
    }
    return parts.join("\n");
  }

  function iniciarWhatsApp() {
    var num = onlyDigits(cfg.whatsappNumero || cfg.whatsapp);
    if (!num) {
      showToast("Falta configurar el número de WhatsApp");
      return;
    }
    var text = buildWhatsAppMessage();
    var url = "https://wa.me/" + num + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener,noreferrer");
    closeWaModal();
  }

  /**
   * URLs remotas (Firebase Storage): solo setAttribute("src") — máxima compatibilidad móvil.
   */
  function setRemoteImageSrc(img, rawUrl) {
    if (!img) return;
    var url = String(rawUrl || "").trim();
    if (!url) {
      img.removeAttribute("src");
      return;
    }
    try {
      img.referrerPolicy = "no-referrer";
    } catch (e0) {}
    if (img.getAttribute("src") !== url) {
      img.removeAttribute("src");
    }
    img.setAttribute("src", url);
    try {
      if (img.decode && typeof img.decode === "function") {
        var p = img.decode();
        if (p && typeof p.catch === "function") p.catch(function () {});
      }
    } catch (e2) {}
  }

  function initMeta() {
    if (cfg.tituloPagina) {
      document.title = cfg.tituloPagina;
    } else {
      var n = String(cfg.nombreCompleto || cfg.nombre || "").trim();
      if (n) document.title = n + " — EliteCard";
    }
    var meta = document.querySelector('meta[name="description"]');
    if (meta && cfg.metaDescription) {
      meta.setAttribute("content", cfg.metaDescription);
    }
  }

  function initHeader() {
    var nombre = String(cfg.nombreCompleto || cfg.nombre || "").trim();
    var cargo = String(cfg.cargo || "").trim();
    var cargoDetalle = String(cfg.cargoDetalle || "").trim();
    var empresaLine = String(cfg.empresa || cfg.organizacion || "").trim();
    var foto = String(cfg.fotoUrl || cfg.photoURL || "").trim();
    var logo = String(cfg.logoUrl || cfg.logo || "").trim();

    var avatar = document.getElementById("avatar-img");
    var nameEl = document.getElementById("display-name");
    var roleEl = document.getElementById("display-role");
    var footImg = document.getElementById("footer-avatar");
    var orgEl = document.getElementById("display-org");
    var bioEl = document.getElementById("display-bio");
    if (!avatar || !nameEl || !roleEl || !footImg || !orgEl || !bioEl) {
      console.warn("[EliteCard] initHeader: faltan nodos del DOM");
      return;
    }

    var inner = avatar && avatar.closest ? avatar.closest(".avatar-inner") : null;
    avatar.removeAttribute("data-fallback-applied");
    if (foto) {
      if (inner) inner.classList.remove("avatar-inner--empty");
      avatar.classList.remove("hidden");
      avatar.onerror = function () {
        if (avatar.getAttribute("data-fallback-applied")) return;
        avatar.setAttribute("data-fallback-applied", "1");
        avatar.removeAttribute("src");
        if (inner) inner.classList.add("avatar-inner--empty");
        avatar.classList.add("hidden");
      };
      setRemoteImageSrc(avatar, foto);
    } else {
      avatar.onerror = null;
      avatar.removeAttribute("src");
      if (inner) inner.classList.add("avatar-inner--empty");
      avatar.classList.remove("hidden");
    }
    avatar.alt = nombre || "Foto de perfil — EliteCard";

    var detalleEl = document.getElementById("display-cargo-detalle");
    nameEl.textContent = nombre;
    if (cargo) {
      roleEl.textContent = cargo;
      roleEl.removeAttribute("hidden");
      roleEl.setAttribute("aria-hidden", "false");
    } else {
      roleEl.textContent = "";
      roleEl.setAttribute("hidden", "");
      roleEl.setAttribute("aria-hidden", "true");
    }

    if (detalleEl) {
      if (cargoDetalle) {
        detalleEl.textContent = cargoDetalle;
        detalleEl.removeAttribute("hidden");
        detalleEl.setAttribute("aria-hidden", "false");
      } else {
        detalleEl.textContent = "";
        detalleEl.setAttribute("hidden", "");
        detalleEl.setAttribute("aria-hidden", "true");
      }
    }

    if (empresaLine) {
      orgEl.textContent = empresaLine;
      orgEl.removeAttribute("hidden");
      orgEl.setAttribute("aria-hidden", "false");
    } else {
      orgEl.textContent = "";
      orgEl.setAttribute("hidden", "");
      orgEl.setAttribute("aria-hidden", "true");
    }

    var bio = (cfg.bio || "").trim();
    if (bio) {
      bioEl.textContent = bio;
      bioEl.classList.remove("hidden");
    } else {
      bioEl.textContent = "";
      bioEl.classList.add("hidden");
    }

    footImg.removeAttribute("data-fallback-applied");
    if (foto) {
      footImg.classList.remove("hidden");
      footImg.onerror = function () {
        if (footImg.getAttribute("data-fallback-applied")) return;
        footImg.setAttribute("data-fallback-applied", "1");
        footImg.removeAttribute("src");
        footImg.classList.add("hidden");
      };
      setRemoteImageSrc(footImg, foto);
    } else {
      footImg.onerror = null;
      footImg.removeAttribute("src");
      footImg.classList.add("hidden");
    }
    footImg.alt = nombre || "Foto de perfil — EliteCard";

    var sealWrap = document.getElementById("footer-seal-wrap");
    var sealImg = document.getElementById("footer-institutional-logo");
    if (logo && sealImg && sealWrap) {
      setRemoteImageSrc(sealImg, logo);
      var orgSeal = empresaLine || String(cfg.organizacion || cfg.empresa || "").trim();
      sealImg.alt = orgSeal ? orgSeal + " — logo en EliteCard" : "Logo institucional — EliteCard";
      sealWrap.classList.remove("hidden-seal");
    } else if (sealWrap) {
      sealWrap.classList.add("hidden-seal");
    }
  }

  function initLinks() {
    var container = document.getElementById("links-container");
    if (!container) return;
    container.innerHTML = "";

    if (cfg.telefono) {
      var telHref = "tel:" + cfg.telefono.replace(/\s/g, "");
      container.appendChild(
        pill(telHref, "Llamame", "fa-solid fa-phone", "bg-neutral-600", "clics_telefono")
      );
    }

    var waNum = onlyDigits(cfg.whatsappNumero || cfg.whatsapp);
    if (waNum) {
      container.appendChild(
        pillButton(
          "Contactame por WhatsApp",
          "fa-brands fa-whatsapp",
          "bg-[#25D366]",
          openWaModal,
          "",
          "clics_whatsapp"
        )
      );
    }

    if (cfg.email) {
      container.appendChild(
        pill(
          "mailto:" + cfg.email,
          "Escríbeme (correo)",
          "fa-solid fa-envelope",
          "bg-[#EA4335]",
          "clics_email"
        )
      );
    }

    if (cfg.emailInstitucional) {
      container.appendChild(
        pill(
          "mailto:" + cfg.emailInstitucional,
          "Correo institucional",
          "fa-solid fa-building",
          "bg-[#0A66C2]",
          "clics_email_institucional"
        )
      );
    }

    if (cfg.instagram) {
      container.appendChild(
        pill(
          cfg.instagram,
          "Instagram",
          "fa-brands fa-instagram",
          "bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]",
          "clics_instagram"
        )
      );
    }

    if (cfg.sitioWeb) {
      container.appendChild(
        pill(cfg.sitioWeb, "Página web", "fa-solid fa-globe", "bg-amber-600", "clics_perfil")
      );
    }

    if (cfg.linkedin) {
      container.appendChild(
        pill(
          cfg.linkedin,
          "LinkedIn",
          "fa-brands fa-linkedin-in",
          "bg-[#0A66C2]",
          "clics_linkedin"
        )
      );
    }

    if (cfg.mapsUrl) {
      container.appendChild(
        pill(
          cfg.mapsUrl,
          "Dirección / mapa",
          "fa-solid fa-location-dot",
          "bg-[#34A853]",
          "clics_mapa"
        )
      );
    }

    if ((cfg.calendlyUrl || "").trim() || onlyDigits(cfg.whatsappNumero)) {
      container.appendChild(
        pillButton(
          "Agendar cita",
          "fa-regular fa-calendar-check",
          "bg-amber-600",
          openAgendarCita,
          "ring-2 ring-amber-500/40 border-amber-600/50",
          "clics_agendar_cita"
        )
      );
    }
  }

  function applyCardAppearance() {
    var theme = String(cfg.cardTheme || "gold").trim().toLowerCase();
    if (["gold", "minimal", "electric"].indexOf(theme) < 0) theme = "gold";
    var avatarShape = String(cfg.avatarShape || "rect").trim().toLowerCase();
    if (avatarShape !== "circle") avatarShape = "rect";
    var linkLayout = String(cfg.buttonLayout || "pills").trim().toLowerCase();
    if (linkLayout !== "icons") linkLayout = "pills";

    var root = document.documentElement;
    root.classList.remove("ec-theme-gold", "ec-theme-minimal", "ec-theme-electric");
    root.classList.add("ec-theme-" + theme);
    if (document.body) {
      document.body.classList.remove("ec-theme-gold", "ec-theme-minimal", "ec-theme-electric");
      document.body.classList.add("ec-theme-" + theme);
    }

    var app = document.getElementById("app-root");
    if (app) {
      app.classList.remove("ec-theme-gold", "ec-theme-minimal", "ec-theme-electric");
      app.classList.add("ec-theme-" + theme);
      app.setAttribute("data-avatar-shape", avatarShape);
      app.setAttribute("data-link-layout", linkLayout);
    }
  }

  function applyCardUI() {
    applyCardAppearance();
    initMeta();
    initHeader();
    initLinks();

    // Actualizar Open Graph dinámico para preview de WhatsApp/redes
    (function updateOgMeta() {
      try {
        var nombre = String(cfg.nombreCompleto || cfg.nombre || "").trim();
        var foto = String(cfg.fotoUrl || cfg.photoURL || "").trim();
        var cargo = String(cfg.cargo || "").trim();
        var bio = String(cfg.bio || "").trim();

        var ogTitle = document.querySelector('meta[property="og:title"]');
        var ogDesc = document.querySelector('meta[property="og:description"]');
        var ogImage = document.querySelector('meta[property="og:image"]');
        var twTitle = document.querySelector('meta[name="twitter:title"]');
        var twDesc = document.querySelector('meta[name="twitter:description"]');
        var twImage = document.querySelector('meta[name="twitter:image"]');

        var titleText = nombre
          ? nombre + (cargo ? " — " + cargo : "") + " | EliteCard"
          : "EliteCard | Perfil Profesional";
        var descText = bio
          || (nombre && cargo
              ? nombre + ", " + cargo + ". Tarjeta digital profesional."
              : "Haz clic para ver mis datos de contacto actualizados.");

        if (ogTitle)  ogTitle.setAttribute("content", titleText);
        if (ogDesc)   ogDesc.setAttribute("content", descText);
        if (ogImage && foto) ogImage.setAttribute("content", foto);
        if (twTitle)  twTitle.setAttribute("content", titleText);
        if (twDesc)   twDesc.setAttribute("content", descText);
        if (twImage && foto) twImage.setAttribute("content", foto);

        if (document.title) document.title = titleText;
      } catch(e) {}
    })();
  }

  function isDisplayModeApp() {
    if (window.navigator.standalone === true) return true;
    if (!window.matchMedia) return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches
    );
  }

  function initFullscreenOnFirstGesture() {
    try {
      if (isDisplayModeApp()) return;
      if (!window.matchMedia("(pointer: coarse)").matches) return;
      if (window.innerWidth > 1024) return;
      var done = false;
      function attempt() {
        if (done) return;
        done = true;
        window.removeEventListener("pointerdown", attempt, true);
        window.removeEventListener("touchend", attempt, true);
        if (document.fullscreenElement) return;
        var root = document.documentElement;
        var req =
          root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
        if (!req) return;
        var p = req.call(root);
        if (p && typeof p.catch === "function") p.catch(function () {});
      }
      window.addEventListener("pointerdown", attempt, { capture: true, passive: true });
      window.addEventListener("touchend", attempt, { capture: true, passive: true });
    } catch (e) {}
  }

  function isRemoteProfileEnabled() {
    var c = window.FIREBASE_WEB_CONFIG;
    return (
      c &&
      c.apiKey &&
      String(c.apiKey).indexOf("REEMPLAZAR") === -1 &&
      typeof firebase !== "undefined" &&
      !!firebase.firestore &&
      !!firebase.auth
    );
  }

  function usersCollection() {
    return (window.FIRESTORE_USERS_COLLECTION || "usuarios").trim() || "usuarios";
  }

  function isValidPublicUserId(id) {
    var s = String(id || "").trim();
    if (!s || s.length > 256) return false;
    if (s.indexOf("/") >= 0) return false;
    if (s === "." || s === "..") return false;
    return true;
  }

  /**
   * Solo URL: ?id= / ?user= / ?uid= → documento usuarios/{id}.
   * También admite #id=… / #…?id=… (algunos hosts o redirecciones dejan el query en el hash).
   * Sin parámetro en URL se resuelve después con Firebase Auth (sesión) o doc por defecto.
   * @returns {{ invalid: true } | { id: string } | { none: true }}
   */
  function getUrlProfileExplicitId() {
    function idFromSearchParams(params) {
      if (!params) return "";
      var raw =
        params.get("id") ||
        params.get("ID") ||
        params.get("Id") ||
        params.get("user") ||
        params.get("uid") ||
        "";
      return String(raw || "").trim();
    }
    try {
      var params = new URLSearchParams(window.location.search);
      var idParam = idFromSearchParams(params);
      if (!idParam && window.location.hash) {
        var hash = window.location.hash.replace(/^#/, "");
        var q = hash.indexOf("?");
        if (q >= 0) {
          idParam = idFromSearchParams(new URLSearchParams(hash.slice(q)));
        }
        if (!idParam) {
          var m = hash.match(/(?:^|[?&#])id=([^&]+)/i);
          if (m && m[1]) {
            try {
              idParam = decodeURIComponent(m[1].replace(/\+/g, " "));
            } catch (e1) {
              idParam = m[1];
            }
          }
        }
      }
      if (idParam) {
        if (!isValidPublicUserId(idParam)) return { invalid: true };
        return { id: idParam };
      }
    } catch (e) {}
    return { none: true };
  }

  function defaultPublicDocId() {
    var def = String(window.FIRESTORE_DEFAULT_CARD_UID || "").trim();
    return def && isValidPublicUserId(def) ? def : "perfil";
  }

  function showPublicProfileMessage(title, description) {
    var wrap = document.getElementById("profile-not-found");
    var t = document.getElementById("profile-not-found-title");
    var d = document.getElementById("profile-not-found-desc");
    var app = document.getElementById("app-root");
    if (t) t.textContent = title || "Perfil no encontrado";
    if (d) d.textContent = description || "";
    if (app) app.classList.add("hidden");
    if (wrap) {
      wrap.classList.remove("hidden");
      wrap.classList.add("flex");
    }
  }

  function hidePublicProfileMessage() {
    var wrap = document.getElementById("profile-not-found");
    var app = document.getElementById("app-root");
    if (wrap) {
      wrap.classList.add("hidden");
      wrap.classList.remove("flex");
    }
    if (app) app.classList.remove("hidden");
  }

  /** Cierra el splash con la misma transición que antes. */
  function dismissPreloader(minWaitFromStartMs) {
    var el = document.getElementById("preloader");
    if (!el || el.classList.contains("preloader--done")) return;
    var tStart = window.__tarjetaSplashT0 || Date.now();
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var minTotal = reduced ? 0 : typeof minWaitFromStartMs === "number" ? minWaitFromStartMs : 1400;
    var elapsed = Date.now() - tStart;
    var waitBeforeFade = Math.max(0, minTotal - elapsed);

    function forceDone() {
      el.classList.add("preloader--hide");
      el.classList.add("preloader--done");
      el.setAttribute("aria-busy", "false");
      document.body.classList.remove("preloader-active");
    }

    setTimeout(function () {
      el.classList.add("preloader--hide");
      el.setAttribute("aria-busy", "false");
      document.body.classList.remove("preloader-active");
      var finished = false;
      function onEnd(ev) {
        if (ev && ev.propertyName !== "opacity") return;
        if (finished) return;
        finished = true;
        el.removeEventListener("transitionend", onEnd);
        el.classList.add("preloader--done");
      }
      el.addEventListener("transitionend", onEnd);
      setTimeout(function () {
        if (!el.classList.contains("preloader--done")) {
          el.removeEventListener("transitionend", onEnd);
          forceDone();
        }
      }, 1200);
    }, waitBeforeFade);
  }

  /** Sin Firestore: splash hasta window.load + tiempo mínimo de marca. */
  function initPreloaderFallbackOnLoad() {
    document.body.classList.add("preloader-active");
    function scheduleDismiss() {
      dismissPreloader(1400);
    }
    if (document.readyState === "complete") scheduleDismiss();
    else window.addEventListener("load", scheduleDismiss);
  }

  /**
   * Firestore usuarios/{uid}: ?id= en URL prioriza ese doc; si no hay id, usa la sesión Auth
   * (mismo uid que el dashboard) o el documento por defecto (perfil / FIRESTORE_DEFAULT_CARD_UID).
   */
  function wireFirestoreProfile() {
    var c = window.FIREBASE_WEB_CONFIG;
    if (!isRemoteProfileEnabled()) return false;
    try {
      firebase.initializeApp(c);
    } catch (e) {
      if (e.code !== "app/duplicate-app") {
        console.warn(e);
        return false;
      }
    }

    var db = firebase.firestore();
    var auth = firebase.auth();
    var urlProf = getUrlProfileExplicitId();
    var urlExplicit = !!urlProf.id;

    if (urlProf.invalid) {
      showPublicProfileMessage(
        "Enlace no válido",
        "El identificador del perfil en la URL no es válido. Revisá el enlace que recibiste."
      );
      dismissPreloader(0);
      return true;
    }

    var profileUnsub = null;
    var splashDismissed = false;
    var analyticsLastViewDocId = "";

    function applyRemoteAndMaybeDismissSplash() {
      if (splashDismissed) return;
      splashDismissed = true;
      dismissPreloader(450);
    }

    function looksLikeFirebaseStorageDownloadUrl(u) {
      var s = String(u || "").trim();
      if (!s || !/^https?:\/\//i.test(s)) return false;
      return (
        /firebasestorage\.googleapis\.com/i.test(s) ||
        /firebasestorage\.app/i.test(s) ||
        /\/v0\/b\/[^/]+\/o\//i.test(s) ||
        /\.appspot\.com\//i.test(s) ||
        /storage\.googleapis\.com/i.test(s)
      );
    }

    function logMediaUrlsFromFirestore(raw) {
      var d = raw && typeof raw === "object" ? raw : {};
      var fotoRaw = String(d.fotoUrl != null ? d.fotoUrl : d.photoURL != null ? d.photoURL : "").trim();
      var logoRaw = String(d.logoUrl != null ? d.logoUrl : "").trim();
      console.log("[EliteCard] Imágenes leídas desde Firestore (index / card-app.js):", {
        fotoUrl_en_documento: fotoRaw || "(vacío — sin URL en el doc)",
        logoUrl_en_documento: logoRaw || "(vacío — sin URL en el doc)",
        foto_parece_downloadURL_de_Firebase_Storage: fotoRaw
          ? looksLikeFirebaseStorageDownloadUrl(fotoRaw)
          : false,
        logo_parece_downloadURL_de_Firebase_Storage: logoRaw
          ? looksLikeFirebaseStorageDownloadUrl(logoRaw)
          : false,
      });
    }

    function applySnapshot(snap, explicitFromUrl) {
      if (explicitFromUrl && (!snap || !snap.exists)) {
        showPublicProfileMessage(
          "Perfil no encontrado",
          "No hay un perfil publicado con este identificador. Puede haber sido movido o el enlace es incorrecto."
        );
        applyRemoteAndMaybeDismissSplash();
        return;
      }

      hidePublicProfileMessage();
      if (snap && snap.exists) {
        var data = snap.data();
        logMediaUrlsFromFirestore(data);
        cfg = window.normalizeTarjetaData(
          Object.assign({}, window.DEFAULT_TARJETA_RAW, data)
        );
      } else {
        console.log("[EliteCard] Sin documento Firestore; fotoUrl/logoUrl no aplicables.");
        cfg = window.normalizeTarjetaData({});
      }
      // Actualizar logo del preloader con el logo institucional del usuario
      (function updatePreloaderLogo() {
        try {
          var logo = String(
            (snap && snap.exists && snap.data().logoUrl) || ""
          ).trim();
          if (!logo) return;
          var preloaderImg = document.getElementById("preloader-logo-img");
          if (!preloaderImg) return;
          var tmpImg = new Image();
          tmpImg.onload = function () {
            preloaderImg.src = logo;
          };
          tmpImg.onerror = function () {
            // Si falla, mantener el ícono genérico
          };
          tmpImg.src = logo;
        } catch (e) {}
      })();
      applyCardUI();
      applyRemoteAndMaybeDismissSplash();
    }

    function subscribeToProfileDoc(cardDocId, explicitFromUrl) {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }
      try {
        window.__tarjetaPublicDocId = cardDocId;
        window.__tarjetaExplicitProfile = explicitFromUrl;
      } catch (e2) {}

      var userId = cardDocId;
      console.log("Cargando perfil para ID:", userId);

      var docRef = db.collection(usersCollection()).doc(userId);

      function incrementMetric(metricKey) {
        if (!metricKey) return;
        try {
          var payload = {};
          payload[metricKey] = firebase.firestore.FieldValue.increment(1);
          payload.clics_totales = firebase.firestore.FieldValue.increment(1);
          docRef.set(payload, { merge: true }).catch(function () {});
        } catch (eInc) {}
      }
      analyticsTrack = incrementMetric;

      function attachSnapshotListener() {
        profileUnsub = docRef.onSnapshot(
          function (snap) {
            if (snap && snap.exists && analyticsLastViewDocId !== cardDocId) {
              analyticsLastViewDocId = cardDocId;
              try {
                docRef
                  .set(
                    { vistas_totales: firebase.firestore.FieldValue.increment(1) },
                    { merge: true }
                  )
                  .catch(function () {});
              } catch (eViews) {}
            }
            applySnapshot(snap, explicitFromUrl);
          },
          function (err) {
            console.warn("[EliteCard] onSnapshot error:", err);
            if (explicitFromUrl) {
              showPublicProfileMessage(
                "No se pudo cargar el perfil",
                "Comprobá tu conexión o intentá de nuevo más tarde."
              );
            } else {
              cfg = window.normalizeTarjetaData({});
              applyCardUI();
            }
            applyRemoteAndMaybeDismissSplash();
          }
        );
      }

      /* Lectura inicial desde el servidor: evita datos en caché desactualizados tras Publicar cambios. */
      docRef
        .get({ source: "server" })
        .then(function (snap0) {
          applySnapshot(snap0, explicitFromUrl);
        })
        .catch(function (errG) {
          console.warn("[EliteCard] get({ source: 'server' }) inicial:", errG);
          if (explicitFromUrl) {
            showPublicProfileMessage(
              "No se pudo cargar el perfil",
              (errG && errG.message) || "Error de red. Intentá de nuevo."
            );
            applyRemoteAndMaybeDismissSplash();
          }
        })
        .finally(function () {
          attachSnapshotListener();
        });
    }

    if (urlProf.id) {
      subscribeToProfileDoc(urlProf.id, true);
    } else {
      auth.onAuthStateChanged(function (user) {
        var id = user ? user.uid : defaultPublicDocId();
        subscribeToProfileDoc(id, false);
      });
    }

    window.setTimeout(function firestoreSlowFallbackMobile() {
      if (splashDismissed) return;
      if (urlExplicit) {
        dismissPreloader(0);
        return;
      }
      splashDismissed = true;
      try {
        hidePublicProfileMessage();
      } catch (eFb) {}
      cfg = window.normalizeTarjetaData({});
      applyCardUI();
      dismissPreloader(0);
    }, 3000);

    window.setTimeout(function () {
      if (splashDismissed) return;
      splashDismissed = true;
      if (urlExplicit) {
        showPublicProfileMessage(
          "No se pudo cargar el perfil",
          "La solicitud tardó demasiado. Comprobá tu conexión e intentá de nuevo."
        );
      } else {
        cfg = window.normalizeTarjetaData({});
        applyCardUI();
      }
      dismissPreloader(450);
    }, 12000);

    return true;
  }

  function eliteCardAppInit() {
    if (!window.normalizeTarjetaData) {
      console.error("config.js no cargó normalizeTarjetaData");
      return;
    }
    try {
      window.__tarjetaSplashT0 = Date.now();
      document.body.classList.add("preloader-active");
      cfg = window.normalizeTarjetaData();

      initFullscreenOnFirstGesture();

      if ("serviceWorker" in navigator) {
        var ecV = "";
        try {
          var m = document.querySelector('meta[name="ec-asset-version"]');
          ecV = m && m.getAttribute("content") ? String(m.getAttribute("content")).trim() : "";
        } catch (eSwMeta) {}
        var swPath = ecV ? "sw.js?v=" + encodeURIComponent(ecV) : "sw.js";
        navigator.serviceWorker.register(swPath).catch(function () {});
      }

      if (wireFirestoreProfile()) {
        /* Splash hasta primera respuesta de Firestore; UI se pinta en el snapshot. */
      } else {
        applyCardUI();
        initPreloaderFallbackOnLoad();
      }

      var btnVcard = document.getElementById("btn-vcard");
      if (btnVcard) {
        btnVcard.addEventListener("click", function () {
          void downloadVCard();
        });
      }

      var btnShare = document.getElementById("btn-share");
      if (btnShare) btnShare.addEventListener("click", shareCard);

      var waModal = document.getElementById("wa-modal");
      var waClose = document.getElementById("wa-modal-close");
      var waIniciar = document.getElementById("wa-iniciar");
      var waPanel = waModal && waModal.querySelector(".ec-modal-elite-panel");
      if (waClose) waClose.addEventListener("click", closeWaModal);
      if (waIniciar) waIniciar.addEventListener("click", iniciarWhatsApp);
      if (waModal) {
        waModal.addEventListener("click", function (e) {
          if (e.target === waModal) closeWaModal();
        });
      }
      if (waPanel) {
        waPanel.addEventListener("click", function (e) {
          e.stopPropagation();
        });
      }

      var calModal = document.getElementById("cal-modal");
      var calClose = document.getElementById("cal-modal-close");
      var calPanel = calModal && calModal.querySelector(".cal-modal-panel");
      if (calClose) calClose.addEventListener("click", closeCalendlyModal);
      if (calModal) {
        calModal.addEventListener("click", function (e) {
          if (e.target === calModal) closeCalendlyModal();
        });
      }
      if (calPanel) {
        calPanel.addEventListener("click", function (e) {
          e.stopPropagation();
        });
      }

      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (waModal && !waModal.classList.contains("hidden")) closeWaModal();
        if (calModal && !calModal.classList.contains("hidden")) closeCalendlyModal();
      });
    } catch (fatalErr) {
      console.error("[EliteCard] Error fatal en init:", fatalErr);
      try {
        if (window.normalizeTarjetaData) {
          cfg = window.normalizeTarjetaData();
          applyCardUI();
        }
      } catch (e2) {}
      dismissPreloader(0);
    }
  }

  if (document.readyState === "complete") {
    eliteCardAppInit();
  } else {
    window.onload = eliteCardAppInit;
  }
})();
