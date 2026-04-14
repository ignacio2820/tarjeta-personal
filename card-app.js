(function () {
  "use strict";

  var cfg = window.normalizeTarjetaData ? window.normalizeTarjetaData() : {};
  var analyticsTrack = function () {};

  function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function igUrlPet(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    var u = s.replace(/^@/, "");
    return "https://instagram.com/" + u;
  }

  function detectPublicViewPet() {
    function fromParams(params) {
      if (!params) return false;
      var v = String(params.get("view") || "")
        .trim()
        .toLowerCase();
      if (v === "pet" || v === "mascota" || v === "mascotbook") return true;
      var p1 = String(params.get("pet") || "").trim();
      if (p1 === "1" || p1.toLowerCase() === "true") return true;
      return false;
    }
    try {
      if (fromParams(new URLSearchParams(window.location.search))) return true;
      var h = window.location.hash || "";
      if (h) {
        var q = h.indexOf("?");
        if (q >= 0 && fromParams(new URLSearchParams(h.slice(q)))) return true;
        if (/[?&#](view=pet|view=mascota|view=mascotbook|pet=1)(?:&|$)/i.test(h)) return true;
      }
    } catch (e) {}
    return false;
  }

  function isPublicCardAdminPreview() {
    try {
      return new URLSearchParams(window.location.search).get("ec_admin_preview") === "1";
    } catch (e) {
      return false;
    }
  }

  function mergePetProfileCfg(baseCfg, rawDoc) {
    if (!rawDoc || typeof rawDoc !== "object") return baseCfg;
    var m = rawDoc;
    var out = Object.assign({}, baseCfg);
    var nom = String(m.mascotaNombre || "").trim();
    if (nom) out.nombreCompleto = nom;
    var cg = String(m.mascotaCargo || "").trim();
    if (cg) out.cargo = cg;
    var bio = String(m.mascotaBio || "").trim();
    if (bio) out.bio = bio;
    var tel = String(m.mascotaTelefono || "").trim();
    out.telefono = tel;
    out.whatsappNumero = onlyDigits(m.mascotaWhatsapp);
    out.instagram = igUrlPet(m.mascotaInstagram);
    out.email = "";
    out.emailInstitucional = "";
    out.linkedin = "";
    out.sitioWeb = "";
    out.mapsUrl = "";
    out.calendlyUrl = "";
    out.leadCaptureEnabled = false;
    out.empresa = "";
    out.cargoDetalle = "";
    out.logoUrl = "";
    var mf = String(m.mascotaFotoUrl || "").trim();
    if (mf) {
      out.fotoUrl = mf;
      out.photoURL = mf;
    }
    return out;
  }

  function applyMascotaAlertClasses(on) {
    var app = document.getElementById("app-root");
    var html = document.documentElement;
    if (app) app.classList.toggle("ec-mascota-alerta", !!on);
    if (html) html.classList.toggle("ec-mascota-alerta", !!on);
  }

  function closeLostPetGeoModal() {
    var modal = document.getElementById("ec-lost-pet-geo-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }

  function openLostPetGeoModal(rawData, storageKey) {
    var modal = document.getElementById("ec-lost-pet-geo-modal");
    if (!modal || !rawData) return;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.setAttribute("data-ec-geo-key", storageKey || "");
    modal.setAttribute("data-ec-owner-wa", onlyDigits(rawData.mascotaWhatsapp));
    var petName = String(rawData.mascotaNombre || "").trim() || "esta mascota";
    var sub = document.getElementById("ec-lost-pet-geo-sub");
    if (sub) sub.textContent = "Si aceptás, enviaremos tu ubicación a quien cuida a " + petName + " por WhatsApp.";
  }

  function scheduleLostPetGeoPrompt(rawData) {
    if (!rawData || !window.__ecPublicViewPet || !rawData.mascotaPerdida) return;
    if (isPublicCardAdminPreview()) return;
    var wa = onlyDigits(rawData.mascotaWhatsapp);
    if (!wa) return;
    var uid = String(window.__tarjetaPublicDocId || "");
    var key = "ec_lost_geo_dismissed_" + uid;
    try {
      if (sessionStorage.getItem(key) === "1") return;
    } catch (e) {}
    setTimeout(function () {
      openLostPetGeoModal(rawData, key);
    }, 700);
  }

  /** Fuera de Firestore (p. ej. demo local): oculta banners de plan rescate. */
  function hideRescueBannersDom() {
    ["ec-rescue-banner-a", "ec-rescue-banner-c", "ec-rescue-banner"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
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
    var isPetMode = !!window.__ecPublicViewPet;
    if (cfg.tituloPagina && !isPetMode) {
      document.title = cfg.tituloPagina;
    } else {
      var n = String(cfg.nombreCompleto || cfg.nombre || "").trim();
      if (n) document.title = n + (isPetMode ? " — MascotBook" : " — EliteCard");
    }
    var meta = document.querySelector('meta[name="description"]');
    if (meta) {
      if (cfg.metaDescription && !isPetMode) {
        meta.setAttribute("content", cfg.metaDescription);
      } else if (isPetMode) {
        var petDesc = String(cfg.bio || "").trim() || "Perfil social de mascota en MascotBook.";
        meta.setAttribute("content", petDesc);
      }
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
    var isPetMode = !!window.__ecPublicViewPet;
    if (isPetMode) {
      renderPetSocialFeed(container);
      return;
    }

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
          isPetMode ? "Contactar al dueño" : "Contactame por WhatsApp",
          isPetMode ? "fa-solid fa-paw" : "fa-brands fa-whatsapp",
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

  function mapPetLikeIcon(raw) {
    var s = String(raw || "").toLowerCase();
    if (/pelota|jugar|parque|correr/.test(s)) return "fa-solid fa-baseball";
    if (/comida|snack|premio|comer/.test(s)) return "fa-solid fa-bone";
    if (/dormir|siesta/.test(s)) return "fa-solid fa-bed";
    if (/agua|rio|río|playa/.test(s)) return "fa-solid fa-water";
    return "fa-solid fa-paw";
  }

  function readPetGustos(raw) {
    var txt = String((raw && raw.mascotaGustos) || "").trim();
    if (!txt) return [];
    return txt
      .split(",")
      .map(function (x) {
        return x.trim();
      })
      .filter(Boolean)
      .slice(0, 6);
  }

  function renderPetSocialFeed(container) {
    var raw = window.__ecPetFirestoreRaw || {};
    var petName = String(raw.mascotaNombre || cfg.nombreCompleto || "mi mascota").trim();
    var wa = onlyDigits(raw.mascotaWhatsapp || cfg.whatsappNumero || "");
    var gustos = readPetGustos(raw);
    var momentos = mergeStudyUrlsForDisplay(raw).slice(0, 9);
    var heroFoto = String(raw.mascotaFotoUrl || cfg.fotoUrl || cfg.photoURL || "").trim();
    var aventura = String(raw.mascotaUltimaAventura || "").trim();
    var queCome = String(raw.mascotaQueCome || "").trim();
    var caracter = String(raw.mascotaCaracter || "").trim();
    var familia = String(raw.mascotaFamilia || "").trim();

    var cards = [];
    if (heroFoto) {
      cards.push(
        '<section class="ec-pet-social-card ec-pet-hero-card"><p class="ec-pet-social-kicker">Mi perfil social</p><div class="ec-pet-hero-photo-wrap"><img class="ec-pet-hero-photo" src="' +
          escapeAttrPet(heroFoto) +
          '" alt="Foto destacada de ' +
          escapeAttrPet(petName || "mascota") +
          '" loading="eager" referrerpolicy="no-referrer"/></div></section>'
      );
    }
    if (aventura) {
      cards.push(
        '<section class="ec-pet-social-card ec-ficha-stack-card"><p class="ec-pet-social-kicker">Última aventura</p><p class="ec-pet-social-text">' +
          escapeHtmlPet(aventura) +
          "</p></section>"
      );
    }
    if (gustos.length) {
      cards.push(
        '<section class="ec-pet-social-card ec-ficha-stack-card"><p class="ec-pet-social-kicker">Personalidad</p><div class="ec-pet-like-grid">' +
          gustos
            .map(function (g) {
              return (
                '<div class="ec-pet-like-chip"><i class="' +
                mapPetLikeIcon(g) +
                '" aria-hidden="true"></i><span>' +
                escapeHtmlPet(g) +
                "</span></div>"
              );
            })
            .join("") +
          "</div></section>"
      );
    }
    if (momentos.length) {
      cards.push(
        '<section class="ec-pet-social-card ec-ficha-stack-card"><p class="ec-pet-social-kicker">Galería de momentos</p><div class="ec-pet-moment-grid">' +
          momentos
            .map(function (u) {
              var su = escapeAttrPet(u);
              return (
                '<button type="button" class="ec-pet-moment-btn" data-ec-study-url="' +
                su +
                '"><img class="ec-pet-moment-img" src="' +
                su +
                '" alt="Momento de mascota" loading="lazy" referrerpolicy="no-referrer"/></button>'
              );
            })
            .join("") +
          "</div></section>"
      );
    }
    if (queCome || caracter || familia) {
      cards.push(
        '<section class="ec-pet-social-card ec-ficha-stack-card"><p class="ec-pet-social-kicker">Información de cuidado</p><div class="ec-pet-care-list">' +
          (queCome
            ? '<p><strong>Qué como:</strong> ' + escapeHtmlPet(queCome) + "</p>"
            : "") +
          (caracter
            ? '<p><strong>Mi carácter:</strong> ' + escapeHtmlPet(caracter) + "</p>"
            : "") +
          (familia
            ? '<p><strong>Mi dueño es:</strong> ' + escapeHtmlPet(familia) + "</p>"
            : "") +
          "</div></section>"
      );
    }
    var cta = "";
    if (wa) {
      cta =
        '<button type="button" id="ec-pet-family-wa" class="ec-pet-family-btn"><i class="fa-solid fa-house-chimney"></i> Contactar a mi familia</button>';
    }
    container.innerHTML =
      '<div class="ec-pet-social-feed">' +
      cards.join("") +
      cta +
      "</div>";

    container.querySelectorAll("[data-ec-study-url]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var u = btn.getAttribute("data-ec-study-url");
        if (u) openPetStudyLightbox(u);
      });
    });
    var waBtn = document.getElementById("ec-pet-family-wa");
    if (waBtn) {
      waBtn.addEventListener("click", function () {
        var msg = "¡Hola! Escaneé el QR de " + (petName || "la mascota");
        window.open(
          "https://wa.me/" + wa + "?text=" + encodeURIComponent(msg),
          "_blank",
          "noopener,noreferrer"
        );
      });
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
    root.classList.toggle("ec-pet-mode", !!window.__ecPublicViewPet);
    if (document.body) {
      document.body.classList.remove("ec-theme-gold", "ec-theme-minimal", "ec-theme-electric");
      document.body.classList.add("ec-theme-" + theme);
      document.body.classList.toggle("ec-pet-mode", !!window.__ecPublicViewPet);
    }

    var app = document.getElementById("app-root");
    if (app) {
      app.classList.remove("ec-theme-gold", "ec-theme-minimal", "ec-theme-electric");
      app.classList.add("ec-theme-" + theme);
      app.setAttribute("data-avatar-shape", avatarShape);
      app.setAttribute("data-link-layout", linkLayout);
      app.classList.toggle("ec-pet-mode", !!window.__ecPublicViewPet);
    }
    var footer = document.querySelector(".footer-bar-light");
    if (footer) footer.classList.toggle("hidden", !!window.__ecPublicViewPet);
  }

  function mergeStudyUrlsForDisplay(o) {
    if (!o || typeof o !== "object") return [];
    function clean(arr) {
      return (Array.isArray(arr) ? arr : [])
        .map(function (u) {
          return String(u || "").trim();
        })
        .filter(function (u) {
          return /^https?:\/\//i.test(u);
        });
    }
    var a = clean(o.mascotaEstudiosSaludUrls);
    var b = clean(o.mascotaGaleriaUrls);
    var seen = {};
    var out = [];
    a.concat(b).forEach(function (u) {
      if (u && !seen[u]) {
        seen[u] = 1;
        out.push(u);
      }
    });
    return out;
  }

  function daysUntilIsoDatePet(isoYmd) {
    if (!isoYmd) return null;
    var t = new Date(String(isoYmd) + "T12:00:00");
    if (isNaN(t.getTime())) return null;
    return Math.ceil((t.getTime() - Date.now()) / 86400000);
  }

  function normalizePetHealthRaw(raw) {
    if (!raw || typeof raw !== "object") return null;
    var o = raw;
    return {
      mascotaNombre: String(o.mascotaNombre || o.nombreCompleto || "").trim(),
      mascotaFotoUrl: String(o.mascotaFotoUrl || o.fotoUrl || "").trim(),
      mascotaSaludPublica: !!o.mascotaSaludPublica,
      paseVeterinarioActivo: !!o.paseVeterinarioActivo,
      mascotaAlertasSalud: String(o.mascotaAlertasSalud || "").trim(),
      mascotaHistorialClinico: String(o.mascotaHistorialClinico || "").trim(),
      mascotaVacunas: Array.isArray(o.mascotaVacunas) ? o.mascotaVacunas : [],
      mascotaEstudiosUrls: mergeStudyUrlsForDisplay(o),
    };
  }

  function openPetStudyLightbox(url) {
    var modal = document.getElementById("ec-pet-study-lightbox");
    var img = document.getElementById("ec-pet-study-lightbox-img");
    if (!modal || !img) return;
    img.setAttribute("src", url || "");
    modal.classList.remove("hidden");
  }

  function closePetStudyLightbox() {
    var modal = document.getElementById("ec-pet-study-lightbox");
    var img = document.getElementById("ec-pet-study-lightbox-img");
    if (modal) modal.classList.add("hidden");
    if (img) img.removeAttribute("src");
  }

  function wirePetStudyLightboxOnce() {
    var modal = document.getElementById("ec-pet-study-lightbox");
    if (!modal || modal.getAttribute("data-ec-bound") === "1") return;
    modal.setAttribute("data-ec-bound", "1");
    var closeBtn = document.getElementById("ec-pet-study-lightbox-close");
    if (closeBtn) closeBtn.addEventListener("click", closePetStudyLightbox);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closePetStudyLightbox();
    });
  }

  function renderPetMedicalPanel(n) {
    var panel = document.getElementById("ec-pet-panel-medical");
    if (!panel || !n) return;
    var alertHtml = "";
    if (n.mascotaAlertasSalud) {
      alertHtml =
        '<div class="ec-ficha-inner ec-ficha-stack-card ec-ficha-alerta-glow mx-1 mb-2 rounded-xl p-4">' +
        '<p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">Alertas médicas y alergias</p>' +
        '<p class="whitespace-pre-wrap text-[13px] font-light leading-relaxed text-[#fde8e8]/95">' +
        escapeHtmlPet(n.mascotaAlertasSalud) +
        "</p></div>";
    }
    var vacs = n.mascotaVacunas || [];
    var vacHtml = "";
    if (!vacs.length) {
      vacHtml =
        '<p class="px-2 py-3 text-center text-[13px] text-[#ebe6dc]/45">No hay vacunas registradas.</p>';
    } else {
      vacHtml = vacs
        .map(function (v) {
          var nombre = v && v.nombre ? String(v.nombre) : "Vacuna";
          var apl = v && v.fechaAplicacion ? String(v.fechaAplicacion) : "—";
          var venRaw = v && (v.fechaVencimiento || v.fechaProxima) ? String(v.fechaVencimiento || v.fechaProxima) : "";
          var venDisp = venRaw || "—";
          var dLeft = daysUntilIsoDatePet(venRaw);
          var warn =
            dLeft != null && dLeft >= 0 && dLeft < 15
              ? '<i class="fa-solid fa-triangle-exclamation ec-vacuna-warn-icon ml-1.5 text-sm" aria-hidden="true" title="Vence en menos de 15 días"></i>'
              : dLeft != null && dLeft < 0
                ? '<i class="fa-solid fa-circle-exclamation ml-1.5 text-amber-400/90" aria-hidden="true" title="Vencida o atrasada"></i>'
                : "";
          return (
            '<div class="ec-vacuna-timeline-item pb-4 pl-1">' +
            '<p class="text-[13px] font-medium text-[#f5efd8]">' +
            escapeHtmlPet(nombre) +
            warn +
            "</p>" +
            '<p class="mt-1 text-[11px] text-[#ebe6dc]/50">Aplicación: <span class="text-[#ebe6dc]/75">' +
            escapeHtmlPet(apl) +
            '</span> · Vencimiento: <span class="text-[#ebe6dc]/75">' +
            escapeHtmlPet(venDisp) +
            "</span></p>" +
            "</div>"
          );
        })
        .join("");
    }
    var studies = n.mascotaEstudiosUrls || [];
    var galHtml = "";
    if (!studies.length) {
      galHtml =
        '<p class="py-2 text-center text-[12px] text-[#ebe6dc]/40">Sin estudios o radiografías cargados.</p>';
    } else {
      galHtml =
        '<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">' +
        studies
          .map(function (u) {
            var uq = escapeAttrPet(u);
            return (
              '<button type="button" class="ec-pet-study-thumb" data-ec-study-url="' +
              uq +
              '"><img src="' +
              uq +
              '" alt="Estudio" loading="lazy" referrerpolicy="no-referrer"/></button>'
            );
          })
          .join("") +
        "</div>";
    }
    var histBlock = "";
    if (n.mascotaHistorialClinico) {
      histBlock =
        '<div class="ec-ficha-inner ec-ficha-stack-card mx-1 mt-4 rounded-xl p-4">' +
        '<p class="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4af37]/85">Historial clínico</p>' +
        '<p class="whitespace-pre-wrap text-[12px] font-light leading-relaxed text-[#ebe6dc]/55">' +
        escapeHtmlPet(n.mascotaHistorialClinico) +
        "</p></div>";
    }
    panel.innerHTML =
      '<div class="ec-ficha-medica-inner px-1 pt-1">' +
      '<p class="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-[#d4af37]/90">Ficha médica</p>' +
      alertHtml +
      '<div class="ec-ficha-inner ec-ficha-stack-card mx-1 mb-3 rounded-xl p-4">' +
      '<p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4af37]/80">Vacunas</p>' +
      vacHtml +
      "</div>" +
      '<div class="ec-ficha-inner ec-ficha-stack-card mx-1 rounded-xl p-4">' +
      '<p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4af37]/80">Estudios y rayos X</p>' +
      galHtml +
      "</div>" +
      histBlock +
      "</div>";
    panel.querySelectorAll("[data-ec-study-url]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var u = btn.getAttribute("data-ec-study-url");
        if (u) openPetStudyLightbox(u);
      });
    });
  }

  function escapeHtmlPet(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttrPet(s) {
    return escapeHtmlPet(s).replace(/'/g, "&#39;");
  }

  function teardownPetHealthUI() {
    var bar = document.getElementById("ec-pet-tabbar");
    var med = document.getElementById("ec-pet-panel-medical");
    var main = document.getElementById("links-container");
    if (bar) bar.classList.add("hidden");
    if (med) {
      med.classList.add("hidden");
      med.innerHTML = "";
    }
    if (main) {
      main.classList.remove("hidden");
    }
    var tc = document.getElementById("ec-pet-tab-contact");
    var tm = document.getElementById("ec-pet-tab-medical");
    if (tc) {
      tc.classList.add("ec-pet-tab--active");
      tc.setAttribute("aria-selected", "true");
    }
    if (tm) {
      tm.classList.remove("ec-pet-tab--active");
      tm.setAttribute("aria-selected", "false");
    }
    closePetStudyLightbox();
  }

  function selectPetTab(which) {
    var main = document.getElementById("links-container");
    var med = document.getElementById("ec-pet-panel-medical");
    var c = document.getElementById("ec-pet-tab-contact");
    var m = document.getElementById("ec-pet-tab-medical");
    var onContact = which === "contact";
    if (main) main.classList.toggle("hidden", !onContact);
    if (med) med.classList.toggle("hidden", onContact);
    if (c) {
      c.classList.toggle("ec-pet-tab--active", onContact);
      c.setAttribute("aria-selected", onContact ? "true" : "false");
    }
    if (m) {
      m.classList.toggle("ec-pet-tab--active", !onContact);
      m.setAttribute("aria-selected", onContact ? "false" : "true");
    }
  }

  function setupPetTabsOnce() {
    var c = document.getElementById("ec-pet-tab-contact");
    var m = document.getElementById("ec-pet-tab-medical");
    if (c && !c.getAttribute("data-ec-bound")) {
      c.setAttribute("data-ec-bound", "1");
      c.addEventListener("click", function () {
        selectPetTab("contact");
      });
    }
    if (m && !m.getAttribute("data-ec-bound")) {
      m.setAttribute("data-ec-bound", "1");
      m.addEventListener("click", function () {
        selectPetTab("medical");
      });
    }
  }

  function initPetHealthUI() {
    wirePetStudyLightboxOnce();
    if (!window.__ecPublicViewPet) {
      teardownPetHealthUI();
      return;
    }
    var raw = window.__ecPetFirestoreRaw;
    var n = normalizePetHealthRaw(raw);
    if (!n) {
      teardownPetHealthUI();
      return;
    }
    var allowed = n.mascotaSaludPublica || n.paseVeterinarioActivo;
    var bar = document.getElementById("ec-pet-tabbar");
    if (!allowed) {
      teardownPetHealthUI();
      if (bar) bar.classList.add("hidden");
      return;
    }
    setupPetTabsOnce();
    if (bar) bar.classList.remove("hidden");
    renderPetMedicalPanel(n);
    selectPetTab("contact");
  }

  function applyCardUI() {
    applyCardAppearance();
    initMeta();
    initHeader();
    initLinks();
    initPetHealthUI();

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

        var isPetMode = !!window.__ecPublicViewPet;
        var titleText = isPetMode
          ? nombre
            ? nombre + " | MascotBook"
            : "MascotBook | Perfil social de mascota"
          : nombre
            ? nombre + (cargo ? " — " + cargo : "") + " | EliteCard"
            : "EliteCard | Perfil Profesional";
        var descText = isPetMode
          ? bio || "Conocé mis momentos, mi personalidad y cómo cuidarme."
          : bio ||
            (nombre && cargo
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
    try {
      window.__ecPublicViewPet = detectPublicViewPet();
    } catch (ePv0) {
      window.__ecPublicViewPet = false;
    }

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

    var EC_PUBLIC_TRIAL_DAYS = 7;

    function getRawDocFechaRegistroMs(d) {
      if (!d || d.fecha_registro == null) return null;
      var f = d.fecha_registro;
      if (typeof f === "number" && isFinite(f)) return f;
      if (f && typeof f.toMillis === "function") return f.toMillis();
      if (f && typeof f.seconds === "number") return f.seconds * 1000;
      return null;
    }

    function isPaidPlanRaw(raw) {
      var s = String((raw && raw.plan_status) || "trial")
        .trim()
        .toLowerCase();
      return s === "active" || s === "pro" || s === "paid";
    }

    function shouldShowPlanRescueBanner(raw) {
      if (!raw || typeof raw !== "object") return false;
      if (isPaidPlanRaw(raw)) return false;
      var st = String(raw.plan_status || "trial")
        .trim()
        .toLowerCase();
      if (st !== "trial") return false;
      var ms = getRawDocFechaRegistroMs(raw);
      if (ms == null) return false;
      return Date.now() - ms > EC_PUBLIC_TRIAL_DAYS * 24 * 60 * 60 * 1000;
    }

    function setBothRescueBannersHidden() {
      ["ec-rescue-banner-a", "ec-rescue-banner-c", "ec-rescue-banner"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.add("hidden");
      });
    }

    function updatePlanRescueBannerFromRaw(raw) {
      var show = shouldShowPlanRescueBanner(raw);
      var pet = !!window.__ecPublicViewPet;
      var a = document.getElementById("ec-rescue-banner-a");
      var c = document.getElementById("ec-rescue-banner-c");
      var legacy = document.getElementById("ec-rescue-banner");
      if (a) a.classList.toggle("hidden", !(show && !pet));
      if (c) c.classList.toggle("hidden", !(show && pet));
      if (legacy && !a && !c) legacy.classList.toggle("hidden", !show);
      else if (legacy) legacy.classList.add("hidden");
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
        setBothRescueBannersHidden();
        applyRemoteAndMaybeDismissSplash();
        return;
      }

      hidePublicProfileMessage();
      var rawForRescue = null;
      if (snap && snap.exists) {
        var data = snap.data();
        rawForRescue = data;
        try {
          if (window.__ecPublicViewPet) {
            window.__ecPetFirestoreRaw = data;
          } else {
            window.__ecPetFirestoreRaw = null;
          }
        } catch (ePetRaw) {}
        logMediaUrlsFromFirestore(data);
        cfg = window.normalizeTarjetaData(
          Object.assign({}, window.DEFAULT_TARJETA_RAW, data)
        );
        if (window.__ecPublicViewPet) {
          cfg = mergePetProfileCfg(cfg, data);
        }
      } else {
        console.log("[EliteCard] Sin documento Firestore; fotoUrl/logoUrl no aplicables.");
        cfg = window.normalizeTarjetaData({});
        try {
          window.__ecPetFirestoreRaw = null;
        } catch (ePetRaw2) {}
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
      var alertOn =
        !!window.__ecPublicViewPet && !!(rawForRescue && rawForRescue.mascotaPerdida);
      applyMascotaAlertClasses(alertOn);
      applyCardUI();
      updatePlanRescueBannerFromRaw(rawForRescue);
      if (rawForRescue) scheduleLostPetGeoPrompt(rawForRescue);
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

    function wireEcAdminLivePreview() {
      splashDismissed = true;
      window.addEventListener("message", function (ev) {
        if (!ev || ev.origin !== window.location.origin) return;
        var msg = ev.data;
        if (!msg || msg.type !== "EC_ELITE_LIVE_PREVIEW" || !msg.patch || typeof msg.patch !== "object") return;
        try {
          cfg = window.normalizeTarjetaData(
            Object.assign({}, window.DEFAULT_TARJETA_RAW, msg.patch)
          );
          try {
            if (window.__ecPublicViewPet) {
              window.__ecPetFirestoreRaw = Object.assign({}, msg.patch, {
                mascotaNombre: msg.patch.nombreCompleto,
                mascotaFotoUrl: msg.patch.fotoUrl,
              });
            } else {
              window.__ecPetFirestoreRaw = null;
            }
          } catch (ePvRaw) {}
          applyMascotaAlertClasses(!!msg.patch.mascotaPerdida);
          applyCardUI();
          setBothRescueBannersHidden();
          hidePublicProfileMessage();
        } catch (errPv) {
          console.warn("[EliteCard] Vista previa admin:", errPv);
        }
      });
      cfg = window.normalizeTarjetaData({});
      applyMascotaAlertClasses(false);
      applyCardUI();
      setBothRescueBannersHidden();
      hidePublicProfileMessage();
      dismissPreloader(0);
    }

    if (urlProf.id) {
      if (isPublicCardAdminPreview()) {
        wireEcAdminLivePreview();
      } else {
        subscribeToProfileDoc(urlProf.id, true);
      }
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
      setBothRescueBannersHidden();
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
        setBothRescueBannersHidden();
      } else {
        cfg = window.normalizeTarjetaData({});
        applyCardUI();
        setBothRescueBannersHidden();
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
        /* sw.js va sin ?v= dinámico: cada carga con Date.now() registraría un SW distinto. Cache-Control: no-cache en hosting. */
        navigator.serviceWorker.register("sw.js").catch(function () {});
      }

      if (wireFirestoreProfile()) {
        /* Splash hasta primera respuesta de Firestore; UI se pinta en el snapshot. */
      } else {
        applyCardUI();
        hideRescueBannersDom();
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

      var lostGeoModal = document.getElementById("ec-lost-pet-geo-modal");
      var lostGeoPanel = lostGeoModal && lostGeoModal.querySelector(".ec-lost-pet-geo-panel");
      var lostGeoAccept = document.getElementById("ec-lost-pet-geo-accept");
      var lostGeoDecline = document.getElementById("ec-lost-pet-geo-decline");
      var lostGeoClose = document.getElementById("ec-lost-pet-geo-close");
      function dismissLostGeoRemember() {
        var modal = document.getElementById("ec-lost-pet-geo-modal");
        var key = modal && modal.getAttribute("data-ec-geo-key");
        try {
          if (key) sessionStorage.setItem(key, "1");
        } catch (eK) {}
      }
      if (lostGeoAccept) {
        lostGeoAccept.addEventListener("click", function () {
          var modal = document.getElementById("ec-lost-pet-geo-modal");
          var wa = modal && modal.getAttribute("data-ec-owner-wa");
          if (!wa) {
            closeLostPetGeoModal();
            return;
          }
          if (!navigator.geolocation) {
            showToast("Tu navegador no permite compartir ubicación");
            dismissLostGeoRemember();
            closeLostPetGeoModal();
            return;
          }
          navigator.geolocation.getCurrentPosition(
            function (pos) {
              var lat = pos.coords.latitude;
              var lng = pos.coords.longitude;
              var maps =
                "https://www.google.com/maps?q=" + encodeURIComponent(String(lat) + "," + String(lng));
              var petName = String(cfg.nombreCompleto || "esta mascota").trim();
              var msg =
                "Hola, quiero ayudar a encontrar a " +
                petName +
                ". Mi ubicación aproximada: " +
                maps;
              window.open(
                "https://wa.me/" + wa + "?text=" + encodeURIComponent(msg),
                "_blank",
                "noopener,noreferrer"
              );
              dismissLostGeoRemember();
              closeLostPetGeoModal();
            },
            function () {
              showToast("No se pudo obtener la ubicación. Podés intentar de nuevo más tarde.");
              closeLostPetGeoModal();
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
          );
        });
      }
      if (lostGeoDecline) {
        lostGeoDecline.addEventListener("click", function () {
          dismissLostGeoRemember();
          closeLostPetGeoModal();
        });
      }
      if (lostGeoClose) {
        lostGeoClose.addEventListener("click", function () {
          closeLostPetGeoModal();
        });
      }
      if (lostGeoModal) {
        lostGeoModal.addEventListener("click", function (e) {
          if (e.target === lostGeoModal) closeLostPetGeoModal();
        });
      }
      if (lostGeoPanel) {
        lostGeoPanel.addEventListener("click", function (e) {
          e.stopPropagation();
        });
      }

      document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        var lb = document.getElementById("ec-pet-study-lightbox");
        if (lb && !lb.classList.contains("hidden")) {
          closePetStudyLightbox();
          return;
        }
        if (waModal && !waModal.classList.contains("hidden")) closeWaModal();
        if (calModal && !calModal.classList.contains("hidden")) closeCalendlyModal();
        if (lostGeoModal && !lostGeoModal.classList.contains("hidden")) closeLostPetGeoModal();
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
