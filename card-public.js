/**
 * Tarjeta pública — un solo silo Firestore (personal_card o mascot_card) + fallback legacy usuarios/{uid}.
 */
(function () {
  var __ecCardPublicDomReadyDone = false;
  function runCardPublicWhenDomReady() {
    if (__ecCardPublicDomReadyDone) return;
    __ecCardPublicDomReadyDone = true;
    (function () {
      "use strict";

      function qs(name) {
        try {
          var p = new URLSearchParams(window.location.search);
          return String(p.get(name) || "").trim();
        } catch (e) {
          return "";
        }
      }

      function resolveUid() {
        var uid =
          qs("id") || qs("ID") || qs("user") || qs("uid") || "";
        if (!uid && window.location.hash) {
          var m = window.location.hash.match(/(?:^|[?&#])id=([^&]+)/i);
          if (m && m[1]) {
            try {
              uid = decodeURIComponent(m[1]);
            } catch (e2) {
              uid = m[1];
            }
          }
        }
        return String(uid || "").trim();
      }

      function isMascotView() {
        var v = qs("view").toLowerCase();
        return v === "pet" || v === "mascota" || v === "mascotbook";
      }

      /** Vista MascotBook pública: no exige auth; solo ?view=pet (o __MB_VIEW_IS_PET). */
      function isPetPublicView() {
        return !!window.__MB_VIEW_IS_PET || isMascotView();
      }

      function isEcAdminPreview() {
        return String(qs("ec_admin_preview") || "") === "1";
      }

      function isEcAdminMascotPreview() {
        return isEcAdminPreview() && isMascotView();
      }

      /** UID disponible antes de start() (iframe preview, contadores, mensajes). */
      window.__EC_CARD_UID = resolveUid();

      /** Preview admin: si el padre envió datos por postMessage, no pisan Firestore. */
      var __ecMascotPreviewLocked = false;

  function applyElitePreviewOverrides(p) {
    var oa = qs("ec_pa").toLowerCase();
    if (oa === "round" || oa === "rect") p.user_avatarShape = oa;
    var ol = qs("ec_pl").toLowerCase();
    if (ol === "list" || ol === "grid") p.user_buttonLayout = ol;
    var ob = qs("ec_pb");
    if (ob) {
      try {
        ob = decodeURIComponent(ob);
      } catch (e0) {}
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(ob)) p.user_bgColor = ob;
    }
    var pt = qs("ec_pt").toLowerCase();
    if (pt === "matte" || pt === "white" || pt === "blue" || pt === "custom") {
      p.user_bgPreset = pt;
    }
  }

  function eliteBgIsLight(hex) {
    var h = String(hex || "").replace(/^#/, "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.length !== 6) return false;
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
    var lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 200;
  }

  function applyEliteSurfaceClass(root, p) {
    root.classList.remove("ec-surface-matte", "ec-surface-light", "ec-surface-blue");
    var preset = String(p.user_bgPreset || "matte").toLowerCase();
    if (preset !== "matte" && preset !== "white" && preset !== "blue" && preset !== "custom") {
      preset = "matte";
    }
    if (preset === "white") {
      root.classList.add("ec-surface-light");
      return;
    }
    if (preset === "blue") {
      root.classList.add("ec-surface-blue");
      return;
    }
    if (preset === "custom" && eliteBgIsLight(p.user_bgColor)) {
      root.classList.add("ec-surface-light");
      return;
    }
    root.classList.add("ec-surface-matte");
  }

  function applyMascotPreviewOverrides(m) {
    var ac = qs("ec_ma");
    if (ac) {
      try {
        ac = decodeURIComponent(ac);
      } catch (e1) {}
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(ac)) m.accentColor = ac;
    }
    var mp = qs("ec_mpt").toLowerCase();
    var ids = window.MASCOT_PRO_THEME_IDS;
    if (ids && ids.indexOf(mp) >= 0) m.mascotProTheme = mp;
    var ms = qs("ec_ms")
      .toLowerCase()
      .replace(/-/g, "_");
    var sids = window.MASCOT_SURFACE_THEME_IDS;
    if (sids && sids.indexOf(ms) >= 0) m.mascotSurfaceTheme = ms;
    if (qs("ec_admin_preview") === "1" && qs("ec_preview_lost") === "1") {
      m.mascotaPerdida = true;
      var rawW = qs("ec_preview_wa");
      if (rawW) {
        try {
          rawW = decodeURIComponent(rawW);
        } catch (eLw) {}
        m.whatsappUrgencia = String(rawW || "").replace(/\D/g, "");
      }
    }
  }

  function mapLegacyPersonal(root) {
    var d = root || {};
    var ig = String(d.instagram || "").trim();
    var li = String(d.linkedin || "").trim();
    return {
      user_nombre: String(d.user_nombre || d.nombreCompleto || "").trim(),
      user_cargo: String(d.user_cargo || d.cargo || "").trim(),
      user_empresa: String(d.user_empresa || d.empresa || "").trim(),
      user_bio: String(d.user_bio || d.bio || "").trim(),
      redes: {
        instagram: ig,
        linkedin: li,
        sitioWeb: String(d.sitioWeb || "").trim(),
        whatsappNumero: String(d.whatsappNumero || "").replace(/\D/g, ""),
      },
      email: String(d.email || "").trim(),
      telefono: String(d.telefono || "").trim(),
      whatsappNumero: String(d.whatsappNumero || "").replace(/\D/g, ""),
      fotoUrl: String(d.fotoUrl || d.photoURL || "").trim(),
      logoUrl: String(d.logoUrl || "").trim(),
      vcardNombres: String(d.vcardNombres || "").trim(),
      vcardApellidos: String(d.vcardApellidos || "").trim(),
      vcardOrganizacion: String(d.vcardOrganizacion || d.empresa || "").trim(),
      vcardTitulo: String(d.vcardTitulo || d.cargo || "").trim(),
      bio: String(d.bio || "").trim(),
      sitioWeb: String(d.sitioWeb || "").trim(),
      instagram: ig,
      linkedin: li,
      mapsUrl: String(d.mapsUrl || "").trim(),
      calendlyUrl: String(d.calendlyUrl || "").trim(),
      emailInstitucional: String(d.emailInstitucional || "").trim(),
      user_avatarShape: String(d.user_avatarShape || d.avatarShape || "rect").trim().toLowerCase(),
      user_buttonLayout: String(d.user_buttonLayout || d.buttonLayout || "list").trim().toLowerCase(),
      user_bgColor: String(d.user_bgColor || "#000000").trim(),
      user_bgPreset: String(d.user_bgPreset || "matte").trim().toLowerCase(),
    };
  }

  function mapLegacyMascot(root) {
    var d = root || {};
    var tv = String(d.mascotaTemaVisual || "theme-classic").replace(/^theme-/, "").trim().toLowerCase();
    if (["classic", "candy", "night", "organic", "glass"].indexOf(tv) < 0) tv = "classic";
    var gal = d.mascotaGaleriaUrls;
    if (!Array.isArray(gal)) gal = [];
    var ac = String(d.mascotaColorAcento || "").trim();
    var vac = Array.isArray(d.mascotaVacunas) ? d.mascotaVacunas : [];
    vac = vac
      .map(function (row) {
        if (!row || typeof row !== "object") return null;
        return {
          vacuna: String(row.vacuna || row.nombre || "").trim(),
          fecha: String(row.fecha || "").trim(),
          proximaDosis: String(row.proximaDosis || row.proxima || "").trim(),
        };
      })
      .filter(Boolean);
    return {
      nombre: String(d.mascotaNombre || "").trim(),
      raza: "",
      sexo: String(d.mascotaGenero || "").trim(),
      salud: [d.mascotaHistorialClinico, d.mascotaAlertasSalud]
        .map(function (x) {
          return String(x || "").trim();
        })
        .filter(Boolean)
        .join("\n\n"),
      historia: String(d.mascotaBio || "").trim(),
      personalidad: [d.mascotaCaracter, d.mascotaGustos].filter(Boolean).join(" · "),
      themeId: tv,
      accentColor: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(ac) ? ac : "",
      textColor: "#ffffff",
      fotoPerfilUrl: String(d.mascotaFotoUrl || "").trim(),
      galeria: gal.map(function (u) {
        return String(u || "").trim();
      }).filter(Boolean),
      muro: String(d.mascotaUltimaAventura || d.mascotaBio || "").trim(),
      vacunas: vac,
      mascotaPerdida: !!d.mascotaPerdida,
      whatsappUrgencia: String(d.mascotaWhatsapp || "").trim(),
      fotoCabeceraUrl: String(d.mascotaBannerUrl || "").trim(),
      mascotSurfaceTheme: "cloud_cream",
      visitas: Number(d.visitas || 0) || 0,
      likes: Number(d.likes || 0) || 0,
    };
  }

  function setText(id, value, fallback) {
    try {
      var el = document.getElementById(id);
      if (!el) {
        console.warn("[MascotBook] applyDoc: elemento no encontrado #" + id);
        return;
      }
      var s = value == null ? "" : String(value);
      s = s.trim();
      if (!s && fallback != null && fallback !== "") s = String(fallback);
      el.textContent = s;
    } catch (e) {
      console.error("[MascotBook] applyDoc: setText error #" + id, e);
    }
  }

  function setImage(id, url) {
    try {
      var el = document.getElementById(id);
      if (!el) {
        console.warn("[MascotBook] applyDoc: nodo no encontrado #" + id);
        return;
      }
      if (String(el.tagName || "").toUpperCase() !== "IMG") {
        console.warn("[MascotBook] applyDoc: #" + id + " no es <img>");
        return;
      }
      var u = String(url || "").trim();
      if (u) {
        el.src = u;
        el.classList.remove("hidden");
        el.style.display = "block";
      } else {
        el.removeAttribute("src");
        el.classList.add("hidden");
        el.style.display = "";
      }
    } catch (e) {
      console.error("[MascotBook] applyDoc: setImage error #" + id, e);
    }
  }

  function applyDoc(d) {
    d = d && typeof d === "object" ? d : {};
    try {
      var temaDbg =
        d.tema != null && String(d.tema).trim()
          ? d.tema
          : d.theme != null && String(d.theme).trim()
            ? d.theme
            : d.estilo != null && String(d.estilo).trim()
              ? d.estilo
              : d.mascotProTheme;
      console.log("TEMA:", temaDbg);
      console.log("FOTO PERFIL:", d.fotoPerfilUrl || d.avatar);
      console.log("FOTO PORTADA:", d.fotoCabeceraUrl || d.portada);

      var nombre = String(d.nombre || "").trim();
      setText("mascot-name", nombre, "");
      setText("mascot-sub", String(d.raza || "").trim(), "");

      var bioText = String(d.historia || d.bio || "").trim();
      var bioEl = document.getElementById("mascot-bio");
      if (bioEl) {
        bioEl.textContent = bioText;
        bioEl.classList.toggle("hidden", !bioText);
      } else {
        console.warn("[MascotBook] applyDoc: elemento no encontrado #mascot-bio");
      }

      var hero = document.getElementById("mascot-hero");
      var portadaUrl = String(d.fotoCabeceraUrl || d.portada || "").trim();
      setImage("mascot-hero-img", portadaUrl);
      if (hero) {
        if (portadaUrl) hero.classList.add("mb-hero--has-img");
        else hero.classList.remove("mb-hero--has-img");
      }

      setImage("mascot-avatar", d.fotoPerfilUrl || d.avatar);

      var baseVisits = Number(d.visitas || 0) || 0;
      var visDisplay = baseVisits;
      setText("mascot-stat-visits", String(visDisplay), "0");
      setText("mascot-stat-likes", String(Number(d.likes || 0) || 0), "0");

      console.log("[MascotBook] applyDoc: campos core aplicados", {
        nombre: nombre || "(vacío)",
        tieneAvatar: !!String(d.fotoPerfilUrl || d.avatar || "").trim(),
        tieneBanner: !!String(d.fotoCabeceraUrl || d.portada || "").trim(),
        visitasMostradas: visDisplay,
        likes: Number(d.likes || 0) || 0,
      });
    } catch (e) {
      console.error("[MascotBook] applyDoc error:", e);
    }
  }

  function igHref(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return "https://instagram.com/" + s.replace(/^@/, "");
  }

  function liHref(s) {
    s = String(s || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return "https://linkedin.com/in/" + s.replace(/^\/+/, "");
  }

  function waHref(num, msg) {
    var d = String(num || "").replace(/\D/g, "");
    if (!d) return "";
    var m = msg ? "?text=" + encodeURIComponent(msg) : "";
    return "https://wa.me/" + d + m;
  }

  function applyEliteAccountRules(p, profileUid, accountRaw) {
    var Sub = window.EliteCardAdminSubscription;
    var acc = accountRaw || {};
    if (!Sub) return p;
    var email = String(acc.email || "").trim();
    if (Sub.isPerpetualAccess(profileUid, email, acc)) return p;
    if (Sub.getPlanStatusFromDoc(acc, "elitecard") === "active") return p;
    if (!Sub.isTrialPeriodExpired(acc, "elitecard", profileUid, email)) return p;
    var q = Object.assign({}, p);
    q.user_bgPreset = "matte";
    q.user_bgColor = "#000000";
    q.user_buttonLayout = "list";
    q.__ec_rescue = true;
    return q;
  }

  function buildVcard(p) {
    var lines = ["BEGIN:VCARD", "VERSION:3.0"];
    var n = [p.vcardApellidos, p.vcardNombres].filter(Boolean).join(" ");
    if (n) lines.push("FN:" + n);
    if (p.vcardNombres || p.vcardApellidos) {
      lines.push(
        "N:" +
          (p.vcardApellidos || "") +
          ";" +
          (p.vcardNombres || "") +
          ";;;"
      );
    }
    if (p.vcardOrganizacion) lines.push("ORG:" + p.vcardOrganizacion);
    if (p.vcardTitulo) lines.push("TITLE:" + p.vcardTitulo);
    if (p.email) lines.push("EMAIL;TYPE=INTERNET:" + p.email);
    var inst = String(p.emailInstitucional || "").trim();
    if (inst && inst.toLowerCase() !== String(p.email || "").trim().toLowerCase()) {
      lines.push("EMAIL;TYPE=WORK:" + inst);
    }
    if (p.telefono) lines.push("TEL;TYPE=CELL:" + p.telefono);
    if (p.sitioWeb || (p.redes && p.redes.sitioWeb)) {
      lines.push("URL:" + String(p.sitioWeb || (p.redes && p.redes.sitioWeb) || ""));
    }
    lines.push("END:VCARD");
    return lines.join("\r\n");
  }

  function downloadVcf(p) {
    var blob = new Blob([buildVcard(p)], { type: "text/vcard;charset=utf-8" });
    var a = document.createElement("a");
    var base = [p.vcardNombres, p.vcardApellidos].filter(Boolean).join("_") || "contacto";
    a.href = URL.createObjectURL(blob);
    a.download = base.replace(/\s+/g, "_") + ".vcf";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function getElitePublicUrl() {
    return String(window.location.href || "").split("#")[0];
  }

  var __eliteLastSigText = "";
  var __eliteLastSigHtml = "";
  var __eliteShareUrl = "";

  function openEliteQrOverlay() {
    __eliteShareUrl = getElitePublicUrl();
    var img = document.getElementById("elite-qr-img");
    var ov = document.getElementById("elite-qr-overlay");
    var nativeBtn = document.getElementById("elite-qr-share-native");
    if (!img || !ov) return;
    img.src =
      "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=" +
      encodeURIComponent(__eliteShareUrl);
    ov.classList.remove("hidden");
    if (nativeBtn) {
      nativeBtn.classList.toggle("hidden", typeof navigator.share !== "function");
    }
  }

  function closeEliteQrOverlay() {
    var ov = document.getElementById("elite-qr-overlay");
    if (ov) ov.classList.add("hidden");
  }

  function wireEliteExtrasOnce() {
    if (wireEliteExtrasOnce._done) return;
    wireEliteExtrasOnce._done = true;
    var ov = document.getElementById("elite-qr-overlay");
    var closeBtn = document.getElementById("elite-qr-close");
    var copyBtn = document.getElementById("elite-qr-copy");
    var nativeBtn = document.getElementById("elite-qr-share-native");
    try {
      if (ov) ov.classList.add("hidden");
    } catch (eHidden) {}
    if (ov) {
      ov.addEventListener("click", function (ev) {
        if (ev.target === ov) closeEliteQrOverlay();
      });
    }
    if (closeBtn) closeBtn.addEventListener("click", closeEliteQrOverlay);
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var u = __eliteShareUrl || getElitePublicUrl();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(u).catch(function () {});
        }
      });
    }
    if (nativeBtn) {
      nativeBtn.addEventListener("click", function () {
        if (!navigator.share) return;
        navigator
          .share({
            title: "EliteCard",
            text: "Te comparto mi tarjeta digital",
            url: __eliteShareUrl || getElitePublicUrl(),
          })
          .catch(function () {});
      });
    }
    var ct = document.getElementById("elite-mail-sig-copy-text");
    var ch = document.getElementById("elite-mail-sig-copy-html");
    if (ct) {
      ct.addEventListener("click", function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(__eliteLastSigText).catch(function () {});
        }
      });
    }
    if (ch) {
      ch.addEventListener("click", function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(__eliteLastSigHtml).catch(function () {});
        }
      });
    }
  }

  function renderElite(p) {
    var root = document.getElementById("layout-elite");
    var empty = document.getElementById("card-empty");
    if (empty) empty.classList.add("hidden");
    if (!root) return;
    root.classList.remove("hidden");
    root.classList.toggle("ec-admin-preview", qs("ec_admin_preview") === "1");
    applyElitePreviewOverrides(p);
    var has =
      p.user_nombre ||
      p.nombreCompleto ||
      p.user_cargo ||
      p.cargo ||
      p.email ||
      p.emailInstitucional ||
      p.telefono ||
      p.whatsappNumero ||
      p.logoUrl ||
      p.mapsUrl ||
      p.calendlyUrl ||
      (p.redes && (p.redes.instagram || p.redes.linkedin || p.redes.sitioWeb));
    if (!has) {
      root.classList.add("hidden");
      if (empty) empty.classList.remove("hidden");
      return;
    }

    var photo = document.getElementById("elite-photo");
    if (photo) {
      if (p.fotoUrl) {
        photo.src = p.fotoUrl;
        photo.classList.remove("hidden");
      } else photo.classList.add("hidden");
    }
    var avatarShape = String(p.user_avatarShape || p.avatarShape || "rect").toLowerCase();
    root.classList.toggle("ec-avatar-round", avatarShape === "round" || avatarShape === "circle");
    var buttonLayout = String(p.user_buttonLayout || p.buttonLayout || "list").toLowerCase();
    if (buttonLayout !== "grid" && buttonLayout !== "icons") buttonLayout = "list";
    root.classList.toggle("ec-buttons-grid", buttonLayout === "grid" || buttonLayout === "icons");
    var bg = String(p.user_bgColor || "#000000").trim();
    if (!/^#[0-9a-f]{6}$/i.test(bg) && !/^#[0-9a-f]{3}$/i.test(bg)) bg = "#000000";
    root.style.setProperty("--ec-user-bg", bg);
    applyEliteSurfaceClass(root, p);

    document.getElementById("elite-name").textContent = p.user_nombre || p.nombreCompleto || "Profesional";
    document.getElementById("elite-role").textContent = p.user_cargo || p.cargo || "";
    document.getElementById("elite-co").textContent = p.user_empresa || p.empresa || "";

    wireEliteExtrasOnce();

    var actionsEl = document.getElementById("elite-actions");
    if (actionsEl) actionsEl.innerHTML = "";

    function appendBtn(container, def) {
      if (!def || !def.href || !container) return;
      var a = document.createElement("a");
      a.href = def.href;
      a.className = "ec-btn " + (def.kind || "");
      if (!def.isMailto) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      a.innerHTML =
        '<span class="ec-btn-icon"><i class="fa ' +
        def.icon +
        '" aria-hidden="true"></i></span><span class="ec-btn-text">' +
        def.label +
        "</span>";
      container.appendChild(a);
    }

    var mailSubj = encodeURIComponent("Mensaje desde tarjeta");
    var mailBody = encodeURIComponent("Hola,\n\n");
    var em = String(p.email || "").trim();
    var btnDefs = [];
    if (p.telefono) {
      btnDefs.push({
        href: "tel:" + String(p.telefono).replace(/\s/g, ""),
        label: "Llámame",
        icon: "fa-solid fa-phone",
        kind: "ec-call",
        isMailto: true,
      });
    }
    var wa = (p.redes && p.redes.whatsappNumero) || p.whatsappNumero;
    var wLink = waHref(wa, "");
    if (wLink) {
      btnDefs.push({
        href: wLink,
        label: "Contáctame por WhatsApp",
        icon: "fa-brands fa-whatsapp",
        kind: "ec-wa",
        isMailto: false,
      });
    }
    if (em) {
      btnDefs.push({
        href: "mailto:" + em + "?subject=" + mailSubj + "&body=" + mailBody,
        label: "Escríbeme un mensaje",
        icon: "fa-regular fa-envelope",
        kind: "ec-mail",
        isMailto: true,
      });
    }
    var inst = String(p.emailInstitucional || "").trim();
    if (inst && inst.toLowerCase() !== em.toLowerCase()) {
      btnDefs.push({
        href: "mailto:" + inst + "?subject=" + mailSubj + "&body=" + mailBody,
        label: "Correo Institucional",
        icon: "fa-regular fa-envelope",
        kind: "ec-mail-inst",
        isMailto: true,
      });
    }
    var ig = p.redes ? p.redes.instagram : "";
    var igL = igHref(ig || p.instagram);
    if (igL) {
      btnDefs.push({
        href: igL,
        label: "Instagram",
        icon: "fa-brands fa-instagram",
        kind: "ec-ig",
        isMailto: false,
      });
    }
    var liL = liHref((p.redes && p.redes.linkedin) || p.linkedin);
    if (liL) {
      btnDefs.push({
        href: liL,
        label: "Sígueme en LinkedIn",
        icon: "fa-brands fa-linkedin-in",
        kind: "ec-li",
        isMailto: false,
      });
    }
    var web = (p.redes && p.redes.sitioWeb) || p.sitioWeb;
    if (web) {
      btnDefs.push({
        href: web,
        label: "Página Web",
        icon: "fa-solid fa-globe",
        kind: "ec-web",
        isMailto: false,
      });
    }
    if (p.mapsUrl) {
      btnDefs.push({
        href: p.mapsUrl,
        label: "Dirección",
        icon: "fa-solid fa-location-dot",
        kind: "ec-map",
        isMailto: false,
      });
    }

    if (p.__ec_rescue) {
      btnDefs = btnDefs.filter(function (b) {
        return b.kind === "ec-call" || b.kind === "ec-wa";
      });
    }

    var logoUrl = String(p.logoUrl || "").trim();
    var n = btnDefs.length;
    var k;
    if (actionsEl) {
      for (k = 0; k < n; k++) appendBtn(actionsEl, btnDefs[k]);
    }

    var logoFoot = document.getElementById("elite-logo-footer");
    var logoFootImg = document.getElementById("elite-logo-footer-img");
    if (logoFoot && logoFootImg) {
      if (logoUrl) {
        logoFootImg.src = logoUrl;
        logoFoot.classList.remove("hidden");
      } else {
        logoFoot.classList.add("hidden");
        logoFootImg.removeAttribute("src");
      }
    }

    var cardUrl = getElitePublicUrl();
    var sigWrap = document.getElementById("elite-mail-sig");
    var sigPrev = document.getElementById("elite-mail-sig-preview");
    if (sigWrap && sigPrev) {
      var showSig = !!(p.user_nombre || p.nombreCompleto || p.email || p.telefono);
      var EM = window.EliteMailSig;
      if (showSig && EM) {
        __eliteLastSigText = EM.buildEliteMailSigText(p, cardUrl);
        __eliteLastSigHtml = EM.buildEliteMailSigHtml(p, cardUrl);
        sigPrev.innerHTML = __eliteLastSigHtml;
        sigWrap.classList.remove("hidden");
      } else {
        sigWrap.classList.add("hidden");
        sigPrev.innerHTML = "";
      }
    }

    var canVcf = !!(
      p.vcardNombres ||
      p.vcardApellidos ||
      p.email ||
      p.emailInstitucional ||
      p.telefono ||
      p.vcardOrganizacion
    );
    var footerVcf = document.getElementById("elite-footer-vcf");
    if (footerVcf) {
      footerVcf.onclick = function () {
        if (!canVcf) return;
        downloadVcf(p);
      };
      footerVcf.disabled = !canVcf;
      footerVcf.style.opacity = canVcf ? "1" : "0.45";
    }
    var footThumb = document.getElementById("elite-footer-thumb");
    if (footThumb) {
      if (p.fotoUrl) {
        footThumb.src = p.fotoUrl;
        footThumb.classList.remove("hidden");
      } else footThumb.classList.add("hidden");
    }
    var footerShare = document.getElementById("elite-footer-share");
    if (footerShare) {
      footerShare.onclick = function () {
        openEliteQrOverlay();
      };
    }
  }

  function renderMascot(m) {
    var base = m && typeof m === "object" ? m : {};
    var nm;
    try {
      nm = window.normalizeMascotCard
        ? window.normalizeMascotCard(base)
        : Object.assign({}, base);
    } catch (eNorm) {
      nm = Object.assign({}, window.DEFAULT_MASCOT_CARD || {}, base || {});
    }
    m = nm;

    try {
      var shareBtn = document.getElementById("elite-footer-share");
      if (shareBtn) shareBtn.style.setProperty("display", "none", "important");
    } catch (eShareBtn) {}

    try {
      var eliteRoot = document.getElementById("layout-elite");
      if (eliteRoot) eliteRoot.classList.add("hidden");
    } catch (eHideElite) {}

    try {
      document.body.style.overflow = "auto";
      document.body.classList.remove("hidden", "d-none");
      try {
        document.body.style.opacity = "";
        document.body.style.visibility = "";
      } catch (eb0) {}
      var crRoot = document.getElementById("card-render");
      if (crRoot) {
        crRoot.classList.remove("hidden", "d-none");
        try {
          crRoot.style.opacity = "";
          crRoot.style.visibility = "";
          crRoot.style.display = "block";
        } catch (eb1) {}
      }
    } catch (eNuke) {}

    if (qs("ec_admin_preview") === "1") {
      try {
        document.body.style.backgroundColor = "#ffffff";
        var crW = document.getElementById("card-render");
        if (crW) crW.style.backgroundColor = "#ffffff";
      } catch (eWhite) {}
    }

    var root = document.getElementById("layout-mascot");
    var shell = document.getElementById("mascot-shell");
    if (!root || !shell) {
      console.warn("[renderMascot] Falta #layout-mascot o #mascot-shell");
      return;
    }
    root.classList.remove("hidden");
    showLoading(false);
    try {
      var nfHide = document.getElementById("card-not-found");
      if (nfHide) nfHide.classList.add("hidden");
    } catch (eNf) {}
    try {
      applyMascotPreviewOverrides(m || {});
    } catch (ePrev) {
      console.warn("[renderMascot] applyMascotPreviewOverrides:", ePrev);
    }

    var keepEmptyShell =
      !!(m && m.__mascotFirestoreDocExists) || !!window.__EC_MASCOT_DOC_EXISTS;
    if (keepEmptyShell) nm.__mascotFirestoreDocExists = true;

    function getFieldAnyCase(obj, key) {
      if (!obj || typeof obj !== "object") return undefined;
      if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
      var lk = String(key || "").toLowerCase();
      if (!lk) return undefined;
      var ks = Object.keys(obj);
      for (var i = 0; i < ks.length; i++) {
        var k = ks[i];
        if (String(k || "").toLowerCase() === lk) return obj[k];
      }
      return undefined;
    }

    function pickFirstNonEmpty(obj, keys) {
      for (var i = 0; i < keys.length; i++) {
        var v = getFieldAnyCase(obj, keys[i]);
        if (v == null) continue;
        if (typeof v === "string") {
          var s = v.trim();
          if (s) return s;
          continue;
        }
        return v;
      }
      return undefined;
    }

    // Compat con Firestore/Dashboard: nombres alternativos y mayúsculas.
    // La UI pública usa estos nombres canónicos: nombre, fotoPerfilUrl, fotoCabeceraUrl,
    // mascotProTheme, mascotSurfaceTheme.
    var _nombre = pickFirstNonEmpty(nm, ["nombre", "name"]);
    if (_nombre !== undefined) nm.nombre = String(_nombre || "").trim();
    var _avatar = pickFirstNonEmpty(nm, [
      "fotoPerfilUrl",
      "fotoPerfilURL",
      "fotoUrl",
      "foto",
      "avatar",
      "avatarUrl",
      "avatarURL",
      "photoUrl",
      "photoURL",
    ]);
    if (_avatar !== undefined) nm.fotoPerfilUrl = String(_avatar || "").trim();
    var _banner = pickFirstNonEmpty(nm, [
      "fotoCabeceraUrl",
      "fotoCabeceraURL",
      "portada",
      "bannerUrl",
      "bannerURL",
      "coverUrl",
      "coverURL",
      "headerUrl",
      "headerURL",
    ]);
    if (_banner !== undefined) nm.fotoCabeceraUrl = String(_banner || "").trim();
    var _proTheme = pickFirstNonEmpty(nm, ["mascotProTheme", "tema", "theme", "estilo"]);
    if (_proTheme !== undefined) nm.mascotProTheme = String(_proTheme || "").trim();
    var _surfaceTheme = pickFirstNonEmpty(nm, ["mascotSurfaceTheme", "surfaceTheme"]);
    if (_surfaceTheme !== undefined) nm.mascotSurfaceTheme = String(_surfaceTheme || "").trim();

    var surf = String((nm && nm.mascotSurfaceTheme) || "cloud_cream")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    if (!window.MASCOT_SURFACE_THEME_IDS || window.MASCOT_SURFACE_THEME_IDS.indexOf(surf) < 0) {
      surf = "cloud_cream";
    }
    var pro = String((nm && (nm.tema || nm.mascotProTheme)) || "classic_paws")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    var proIds = window.MASCOT_PRO_THEME_IDS;
    if (!proIds || !proIds.length || proIds.indexOf(pro) < 0) {
      pro = "classic_paws";
    }
    shell.className = "mb-social";
    shell.classList.add("mb-theme--" + pro);
    shell.classList.add("mb-surface--" + surf);
    if (qs("ec_admin_preview") === "1") shell.classList.add("ec-mascot-preview");
    shell.setAttribute("data-mb-pro", pro);
    function stripMbThemeHostClasses(el) {
      if (!el) return;
      el.className = String(el.className || "")
        .replace(/\bmb-theme--[a-z0-9_]+\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    var themeHost = "mb-theme--" + pro;
    var cardRenderHost = document.getElementById("card-render");
    if (qs("ec_admin_preview") === "1") {
      document.body.className = themeHost;
      if (cardRenderHost) {
        stripMbThemeHostClasses(cardRenderHost);
        cardRenderHost.classList.add(themeHost);
      }
    } else {
      stripMbThemeHostClasses(document.body);
      document.body.classList.add(themeHost);
      stripMbThemeHostClasses(cardRenderHost);
      if (cardRenderHost) cardRenderHost.classList.add(themeHost);
    }
    var stHost = document.getElementById("mb-theme-host-inject");
    if (stHost) stHost.remove();
    if (pro === "candy_pop") {
      stHost = document.createElement("style");
      stHost.id = "mb-theme-host-inject";
      stHost.textContent =
        "#card-render.mb-theme--candy_pop{min-height:100dvh;background-color:#fff5fb;background-image:radial-gradient(circle at 14% 22%,rgba(255,255,255,.55) 0 9%,transparent 10%),radial-gradient(circle at 78% 18%,rgba(255,255,255,.4) 0 7%,transparent 8%),radial-gradient(circle at 62% 72%,rgba(255,255,255,.35) 0 11%,transparent 12%),url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='72' height='72' viewBox='0 0 72 72'%3E%3Cg fill='%23ffffff' fill-opacity='0.22'%3E%3Cpath d='M20 38c-1.2-2 1-4 2.8-3.2 1 .4 1.6 1.2 1.8 2 .6-1.8 2.8-2.8 4.4-2 1.3.6 2 2 1.8 3.4-.2 1.2-.8 2-1.8 2.4-2 1-4.6-.2-5.6-2-.7-1.2-.8-2.6-.4-3.6z'/%3E%3Ccircle cx='48' cy='24' r='3'/%3E%3Ccircle cx='56' cy='30' r='2.4'/%3E%3Ccircle cx='52' cy='38' r='2.4'/%3E%3Ccircle cx='44' cy='42' r='3'/%3E%3C/g%3E%3C/svg%3E\"),linear-gradient(128deg,#ffe4f1 0%,#e0f2fe 42%,#fef9c3 100%);background-size:auto,auto,auto,72px 72px,auto}";
      document.head.appendChild(stHost);
    }
    var accent = String(nm.accentColor || "#ec4899").trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) accent = "#ec4899";
    shell.style.setProperty("--mb-accent", accent);

    applyDoc(nm);

    try {
      var nombreMeta = String(nm.nombre || "").trim() || "Mascota";
      var petTitle = "Tarjeta de Identidad de " + nombreMeta;
      var petDesc =
        "Conoce a " + nombreMeta + ", su historia y datos de contacto en MascotBook.";
      document.title = petTitle;
      updatePublicMeta({
        title: petTitle,
        description: petDesc,
        image: String(nm.fotoPerfilUrl || "").trim(),
      });
    } catch (eMetaEarly) {
      console.warn("[renderMascot] meta temprano:", eMetaEarly);
    }

    try {
      var muroText = String(nm.muro || "").trim();
      var muroEl = document.getElementById("muro");
      if (muroEl) {
        muroEl.textContent = muroText;
        muroEl.classList.toggle("hidden", !muroText);
      } else {
        console.warn("[renderMascot] elemento no encontrado #muro");
      }
      var persText = String(nm.personalidad || "").trim();
      var persEl = document.getElementById("personalidad");
      if (persEl) {
        persEl.textContent = persText;
        persEl.classList.toggle("hidden", !persText);
      } else {
        console.warn("[renderMascot] elemento no encontrado #personalidad");
      }
    } catch (eMuroPers) {
      console.warn("[renderMascot] muro/personalidad:", eMuroPers);
    }

    try {
      shell.style.opacity = "1";
      shell.style.visibility = "visible";
    } catch (eOp) {}

    nm = nm || {};
    var fc =
      nm.fichaCritica && typeof nm.fichaCritica === "object" ? nm.fichaCritica : {};
    var vet =
      nm.veterinario && typeof nm.veterinario === "object" ? nm.veterinario : {};
    var vacs = Array.isArray(nm.vacunas) ? nm.vacunas : [];
    var lostOn = !!nm.mascotaPerdida;

    var nPosts = (nm.galeria && nm.galeria.length) || 0;
    var postsEl = document.getElementById("mascot-stat-posts");
    if (postsEl) postsEl.textContent = String(nPosts);

    var gal = document.getElementById("mascot-gallery");
    if (!gal) {
      console.warn("[renderMascot] Falta #mascot-gallery");
    } else {
      gal.innerHTML = "";
    }
    (Array.isArray(nm.galeria) ? nm.galeria : []).forEach(function (url, idx) {
      if (!gal) return;
      var item = document.createElement("div");
      item.className = "mb-gallery-item";

      var im = document.createElement("img");
      im.src = url;
      im.alt = "Foto de la mascota " + String(idx + 1);
      im.loading = "lazy";
      im.className = "gallery-item";

      var likeBtn = document.createElement("button");
      likeBtn.type = "button";
      likeBtn.className = "mb-gallery-like-btn";
      likeBtn.setAttribute("aria-label", "Dar like a esta foto");
      likeBtn.setAttribute("title", "Dar like");
      likeBtn.setAttribute("data-mb-photo-url", url);
      likeBtn.innerHTML = '<i class="fa-solid fa-heart" aria-hidden="true"></i>';

      item.appendChild(im);
      item.appendChild(likeBtn);
      gal.appendChild(item);
    });

    function setBlock(idWrap, idInner, show, html) {
      var wrap = document.getElementById(idWrap);
      var inner = document.getElementById(idInner);
      if (!wrap || !inner) return;
      inner.innerHTML = html || "";
      wrap.classList.toggle("hidden", !show);
    }

    function vacunaProximaVencida(prox) {
      var s = String(prox || "").trim();
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      var t = new Date();
      var y = t.getFullYear();
      var m = String(t.getMonth() + 1);
      if (m.length < 2) m = "0" + m;
      var d = String(t.getDate());
      if (d.length < 2) d = "0" + d;
      return s < y + "-" + m + "-" + d;
    }

    var vacHtml = vacs
      .map(function (r) {
        r = r && typeof r === "object" ? r : {};
        var bits = [r.vacuna, r.fecha, r.proximaDosis].filter(Boolean);
        if (!bits.length) return "";
        var overdue = vacunaProximaVencida(r.proximaDosis);
        return (
          "<div class=\"mb-vac-line" +
          (overdue ? " mb-vac-line--overdue" : "") +
          "\"><strong>" +
          escapeHtml(r.vacuna || "Vacuna") +
          "</strong>" +
          (overdue ? " <span class=\"mb-vac-badge\">Próxima vencida</span>" : "") +
          "<br>" +
          (r.fecha ? "<span class=\"mb-health-label\">Fecha</span> " + escapeHtml(r.fecha) + " · " : "") +
          (r.proximaDosis
            ? "<span class=\"mb-health-label\">Próxima</span> " + escapeHtml(r.proximaDosis)
            : "") +
          "</div>"
        );
      })
      .filter(Boolean)
      .join("");
    setBlock("mascot-block-vacunas", "mascot-vacunas", !!vacHtml, vacHtml);

    var vetHtml = "";
    if (vet.nombre || vet.telefono || vet.direccion) {
      vetHtml += vet.nombre ? "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Nombre</span>" + escapeHtml(vet.nombre) + "</div>" : "";
      vetHtml += vet.direccion
        ? "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Dirección</span>" + escapeHtml(vet.direccion) + "</div>"
        : "";
      if (vet.direccion) {
        var mq = encodeURIComponent(
          [vet.direccion, vet.nombre].filter(Boolean).join(" · ")
        );
        vetHtml +=
          "<a class=\"mb-vet-map\" rel=\"noopener noreferrer\" target=\"_blank\" href=\"https://www.google.com/maps/search/?api=1&query=" +
          mq +
          "\"><i class=\"fa-solid fa-map-location-dot\" aria-hidden=\"true\"></i> Abrir en mapa</a>";
      }
      if (vet.telefono) {
        var tel = String(vet.telefono).replace(/\D/g, "");
        if (tel) {
          vetHtml +=
            "<a class=\"mb-vet-call\" href=\"tel:" +
            tel +
            "\"><i class=\"fa-solid fa-phone\" aria-hidden=\"true\"></i> Llamar al veterinario</a>";
        }
      }
    }
    setBlock("mascot-block-vet", "mascot-vet", !!vetHtml, vetHtml);

    var critHtml = "";
    if (fc.alergias) {
      critHtml +=
        "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Alergias</span>" + escapeHtml(fc.alergias) + "</div>";
    }
    if (fc.medicacionDiaria) {
      critHtml +=
        "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Medicación diaria</span>" +
        escapeHtml(fc.medicacionDiaria) +
        "</div>";
    }
    if (fc.tipoSangre) {
      critHtml +=
        "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Tipo de sangre</span>" +
        escapeHtml(fc.tipoSangre) +
        "</div>";
    }
    if (fc.cuidadosEspeciales) {
      critHtml +=
        "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Cuidados especiales</span>" +
        escapeHtml(fc.cuidadosEspeciales).replace(/\n/g, "<br>") +
        "</div>";
    }
    setBlock("mascot-block-critica", "mascot-critica", !!critHtml, critHtml);

    var leg = String(nm.salud || "").trim();
    setBlock("mascot-block-legacy", "mascot-health-legacy", !!leg, leg ? escapeHtml(leg).replace(/\n/g, "<br>") : "");

    var hs = document.getElementById("mascot-health-section");
    if (hs) {
      var anyHealth =
        !!vacHtml ||
        !!vetHtml ||
        !!critHtml ||
        !!leg;
      hs.classList.toggle("hidden", !anyHealth);
    }

    try {
      setupMascotLostMode(nm);
    } catch (eLost) {
      console.warn("[renderMascot] setupMascotLostMode:", eLost);
    }
    try {
      bindMascotPhotoLikeButtons();
    } catch (eLike) {
      console.warn("[renderMascot] bindMascotPhotoLikeButtons:", eLike);
    }
    try {
      wireMascotBrandFooterOnce();
    } catch (eBf) {}
    try {
      maybeIncrementMascotVisitOncePerSession();
    } catch (eVis) {}
    try {
      delete window.__EC_MASCOT_DOC_EXISTS;
    } catch (eEnd) {
      window.__EC_MASCOT_DOC_EXISTS = false;
    }

    var crDone = document.getElementById("card-render");
    if (crDone) {
      crDone.classList.remove("hidden", "d-none");
      crDone.classList.add("ec-mb-content-layer");
      try {
        crDone.style.opacity = "";
        crDone.style.visibility = "";
        crDone.style.display = "block";
      } catch (eCr) {}
    }

    try {
      root.style.setProperty("display", "block", "important");
      root.style.setProperty("opacity", "1", "important");
      root.style.setProperty("visibility", "visible", "important");
      shell.style.setProperty("display", "block", "important");
      shell.style.setProperty("opacity", "1", "important");
      shell.style.setProperty("visibility", "visible", "important");
    } catch (eForce) {}
    try {
      document.body.style.overflow = "auto";
    } catch (eBo) {}
    window.__EC_MASCOT_HAS_RENDERED = true;
    window.__EC_MASCOT_LAYERS_REMOVED = true;
    try {
      var lmFin = document.getElementById("layout-mascot");
      if (lmFin) lmFin.classList.remove("hidden");
      var clFin = document.getElementById("card-loading");
      if (clFin) clFin.classList.add("hidden");
      var crFin = document.getElementById("card-render");
      if (crFin) crFin.classList.add("ec-mb-content-layer");
    } catch (eFin) {}
    return;
  }

  function hideMascotLostUi() {
    var b = document.getElementById("mascot-lost-banner");
    var wrap = document.getElementById("mascot-lost-actions");
    var panic = document.getElementById("mascot-panic-btn");
    var msg = document.getElementById("mascot-lost-msg");
    if (b) b.classList.add("hidden");
    if (wrap) wrap.classList.add("hidden");
    if (panic) {
      panic.classList.add("hidden");
      panic.onclick = null;
      panic.disabled = true;
    }
    if (msg) {
      msg.classList.add("hidden");
      msg.textContent = "";
    }
    var locBtn = document.getElementById("mascot-lost-share-loc");
    if (locBtn) {
      locBtn.disabled = false;
      locBtn.innerHTML =
        '<i class="fa-solid fa-location-dot" aria-hidden="true"></i> Compartir mi ubicación con el dueño';
    }
  }

  function pushLostScanLocation(ownerUid, pos, silent) {
    if (!ownerUid || !window.EC_SILO || !window.EC_SILO.mascotLostScansRef) return Promise.resolve();
    var db = firebase.firestore();
    var ref = window.EC_SILO.mascotLostScansRef(db, ownerUid);
    var row = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      at: firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (typeof pos.coords.accuracy === "number" && !isNaN(pos.coords.accuracy)) {
      row.accuracy = pos.coords.accuracy;
    }
    return ref.add(row);
  }

  function setupMascotLostMode(nm) {
    var ownerUid = String(window.__EC_CARD_UID || "").trim();
    var banner = document.getElementById("mascot-lost-banner");
    var wrap = document.getElementById("mascot-lost-actions");
    var panic = document.getElementById("mascot-panic-btn");
    var locBtn = document.getElementById("mascot-lost-share-loc");
    var msg = document.getElementById("mascot-lost-msg");
    if (!banner || !wrap || !panic || !locBtn) return;
    if (!nm || !nm.mascotaPerdida) {
      hideMascotLostUi();
      return;
    }
    banner.classList.remove("hidden");
    wrap.classList.remove("hidden");
    var digits = String((nm && nm.whatsappUrgencia) || "").replace(/\D/g, "");
    var petName = String((nm && nm.nombre) || "").trim() || "esta mascota";
    var stdMsg =
      "Hola, encontré a tu mascota " +
      petName +
      " escaneando su MascotBook. ¿Dónde nos encontramos?";
    function openMascotRescueWa(text) {
      window.open("https://wa.me/" + digits + "?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
    }
    if (digits.length >= 8) {
      panic.classList.remove("hidden");
      panic.disabled = false;
      panic.onclick = function () {
        if (panic.disabled) return;
        if (!navigator.geolocation) {
          openMascotRescueWa(stdMsg);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            var msg =
              "¡Hola! Encontré a tu mascota " +
              petName +
              ". Mi ubicación actual es: https://www.google.com/maps?q=" +
              lat +
              "," +
              lng;
            openMascotRescueWa(msg);
          },
          function () {
            openMascotRescueWa(stdMsg);
          },
          { enableHighAccuracy: true, timeout: 14000, maximumAge: 0 }
        );
      };
    } else {
      panic.classList.add("hidden");
      panic.onclick = null;
      panic.disabled = true;
    }
    if (msg) msg.classList.add("hidden");
    locBtn.disabled = false;
    locBtn.onclick = function () {
      if (!ownerUid || !window.EC_SILO || !window.EC_SILO.mascotLostScansRef) return;
      if (!navigator.geolocation) {
        if (msg) {
          msg.textContent = "Tu navegador no permite geolocalización.";
          msg.classList.remove("hidden");
        }
        return;
      }
      locBtn.disabled = true;
      if (msg) msg.classList.add("hidden");
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          try {
            pushLostScanLocation(ownerUid, pos, false)
              .then(function () {
                locBtn.disabled = false;
                if (msg) {
                  msg.textContent = "Ubicación enviada. El dueño recibirá un aviso por correo si está configurado.";
                  msg.classList.remove("hidden");
                }
              })
              .catch(function () {
                locBtn.disabled = false;
                if (msg) {
                  msg.textContent = "No pudimos guardar la ubicación. Intentá de nuevo.";
                  msg.classList.remove("hidden");
                }
              });
          } catch (e) {
            locBtn.disabled = false;
            if (msg) {
              msg.textContent = "Error al enviar. Intentá de nuevo.";
              msg.classList.remove("hidden");
            }
          }
        },
        function () {
          locBtn.disabled = false;
          if (msg) {
            msg.textContent = "No se obtuvo permiso o ubicación. Podés intentar de nuevo.";
            msg.classList.remove("hidden");
          }
        },
        { enableHighAccuracy: true, timeout: 14000, maximumAge: 0 }
      );
    };

    var isPreview = qs("ec_admin_preview") === "1";
    if (!isPreview && ownerUid && !window.__EC_LOST_PASSIVE_TRIED) {
      window.__EC_LOST_PASSIVE_TRIED = true;
      setTimeout(function () {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            pushLostScanLocation(ownerUid, pos, true).catch(function () {});
          },
          function () {},
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 }
        );
      }, 2400);
    }
  }

  function shouldTrackMascotCounters() {
    return qs("ec_admin_preview") !== "1";
  }

  var __mascotCounterRef = null;
  function mascotProfileRef() {
    var uid = String(window.__EC_CARD_UID || "").trim();
    if (!uid || typeof firebase === "undefined" || !firebase.firestore) return null;
    if (!__mascotCounterRef) {
      __mascotCounterRef = firebase.firestore().collection("mascotas").doc(uid);
    }
    return __mascotCounterRef;
  }

  function incrementMascotCounter(counterKey) {
    var ref = mascotProfileRef();
    if (!ref || !counterKey) return Promise.resolve();
    var patch = {};
    patch[counterKey] = firebase.firestore.FieldValue.increment(1);
    return ref
      .update(patch)
      .catch(function () {
        return ref.set(patch, { merge: true });
      });
  }

  var __mbBrandFooterWired = false;
  function wireMascotBrandFooterOnce() {
    if (__mbBrandFooterWired) return;
    var footer = document.querySelector("#layout-mascot footer.mb-brand-footer");
    if (!footer) return;
    __mbBrandFooterWired = true;
    footer.style.cursor = "pointer";
    footer.addEventListener("click", function () {
      window.open("https://tarjeta-profesional-pedro.web.app", "_blank", "noopener,noreferrer");
    });
  }

  function maybeIncrementMascotVisitOncePerSession() {
    if (qs("ec_admin_preview") === "1") return;
    if (!isPetPublicView()) return;
    var uid = String(window.__EC_CARD_UID || "").trim();
    if (!uid || typeof firebase === "undefined" || !firebase.firestore) return;
    var key = "visited_" + uid;
    try {
      if (sessionStorage.getItem(key) === "1") return;
    } catch (eS) {
      return;
    }
    var ref = firebase.firestore().collection("mascotas").doc(uid);
    var patch = { visitas: firebase.firestore.FieldValue.increment(1) };
    ref
      .update(patch)
      .catch(function () {
        return ref.set(patch, { merge: true });
      })
      .then(function () {
        try {
          sessionStorage.setItem(key, "1");
        } catch (e2) {}
        var el = document.getElementById("mascot-stat-visits");
        if (!el) return;
        var n = parseInt(String(el.textContent || "0"), 10) || 0;
        el.textContent = String(n + 1);
      })
      .catch(function () {});
  }

  function photoLikeStorageKey(url) {
    var uid = String(window.__EC_CARD_UID || "").trim();
    var raw = String(url || "").trim();
    if (!raw) return "";
    var safe = "";
    try {
      safe = window.btoa(unescape(encodeURIComponent(raw))).replace(/[=+/]/g, "_");
    } catch (e) {
      safe = raw.slice(0, 120).replace(/\W/g, "_");
    }
    return "mb_photo_like_" + uid + "_" + safe;
  }

  function isPhotoLikedLocal(url) {
    var key = photoLikeStorageKey(url);
    if (!key) return false;
    try {
      return localStorage.getItem(key) === "1";
    } catch (e) {
      return false;
    }
  }

  function rememberPhotoLikedLocal(url) {
    var key = photoLikeStorageKey(url);
    if (!key) return;
    try {
      localStorage.setItem(key, "1");
    } catch (e) {}
  }

  function bindMascotPhotoLikeButtons() {
    var host = document.getElementById("mascot-gallery");
    if (!host) return;
    host.querySelectorAll(".mb-gallery-like-btn[data-mb-photo-url]").forEach(function (btn) {
      if (btn.getAttribute("data-like-bound") === "1") return;
      btn.setAttribute("data-like-bound", "1");
      var photoUrl = String(btn.getAttribute("data-mb-photo-url") || "").trim();
      if (isPhotoLikedLocal(photoUrl)) btn.classList.add("is-liked");
      btn.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (!shouldTrackMascotCounters() || btn.disabled || btn.classList.contains("is-liked")) return;
        btn.disabled = true;
        incrementMascotCounter("likes")
          .then(function () {
            var likesEl = document.getElementById("mascot-stat-likes");
            if (likesEl) {
              var next = (parseInt(String(likesEl.textContent || "0"), 10) || 0) + 1;
              likesEl.textContent = String(next);
            }
            btn.classList.add("is-liked");
            rememberPhotoLikedLocal(photoUrl);
          })
          .catch(function () {})
          .then(function () {
            btn.disabled = false;
          });
      });
    });
  }

  var __mbPhotoLbInit = false;
  function initMascotPhotoLightbox() {
    if (__mbPhotoLbInit) return;
    var lb = document.getElementById("mb-photo-lightbox");
    var lbImg = document.getElementById("mb-photo-lightbox-img");
    var bd = lb ? lb.querySelector(".mb-photo-lightbox__backdrop") : null;
    var closeBtn = lb ? lb.querySelector(".mb-photo-lightbox__close") : null;
    if (!lb || !lbImg || !bd || !closeBtn) return;
    __mbPhotoLbInit = true;
    function closeLb() {
      lb.classList.add("hidden");
      lb.setAttribute("aria-hidden", "true");
      lbImg.removeAttribute("src");
      document.body.style.overflow = "";
    }
    function openLb(src) {
      if (!src) return;
      lbImg.src = src;
      lb.classList.remove("hidden");
      lb.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    document.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t || t.nodeType !== 1) return;
        if (t.tagName !== "IMG") return;
        if (!t.classList.contains("mascot-photo") && !t.classList.contains("gallery-item")) return;
        if (t.classList.contains("hidden")) return;
        if (!t.getAttribute("src")) return;
        ev.preventDefault();
        openLb(t.src);
      },
      true
    );
    bd.addEventListener("click", closeLb);
    closeBtn.addEventListener("click", closeLb);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && lb && !lb.classList.contains("hidden")) closeLb();
    });
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureHeadMetaByProperty(prop, content) {
    var el = document.head && document.head.querySelector('meta[property="' + prop + '"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("property", prop);
      if (document.head) document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function ensureHeadMetaByName(name, content) {
    var el = document.head && document.head.querySelector('meta[name="' + name + '"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      if (document.head) document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function absoluteUrlForOgImage(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (u.indexOf("//") === 0) return String(location.protocol || "https:") + u;
    try {
      return new URL(u, location.origin).href;
    } catch (e) {
      return u;
    }
  }

  function updatePublicMeta(opts) {
    var o = opts || {};
    var title = String(o.title || "").trim();
    var desc = String(o.description || "").trim();
    var imageRaw = String(o.image || "").trim();
    var image = absoluteUrlForOgImage(imageRaw);
    if (!title) title = "MascotBook";
    if (!desc) desc = "Conocé el perfil público de esta mascota.";
    document.title = title;
    ensureHeadMetaByName("description", desc);
    ensureHeadMetaByProperty("og:title", title);
    ensureHeadMetaByProperty("og:description", desc);
    ensureHeadMetaByName("twitter:title", title);
    ensureHeadMetaByName("twitter:description", desc);
    if (image) {
      ensureHeadMetaByProperty("og:image", image);
      ensureHeadMetaByName("twitter:image", image);
    }
  }

  function showLoading(on) {
    var el = document.getElementById("card-loading");
    if (!el) return;
    if (on) {
      if (String(qs("ec_admin_preview") || "") === "1") {
        var lm = document.getElementById("layout-mascot");
        if (
          window.__EC_MASCOT_HAS_RENDERED &&
          lm &&
          !lm.classList.contains("hidden")
        ) {
          return;
        }
      }
      el.classList.remove("hidden");
      try {
        el.style.display = "";
      } catch (eD0) {}
      el.setAttribute("aria-busy", "true");
    } else {
      el.classList.add("hidden");
      try {
        el.style.display = "none";
      } catch (eD1) {}
      el.setAttribute("aria-busy", "false");
    }
  }

  function showNotFound() {
    showLoading(false);
    try {
      var lm = document.getElementById("layout-mascot");
      if (lm) lm.classList.add("hidden");
      var le = document.getElementById("layout-elite");
      if (le) le.classList.add("hidden");
      var ce = document.getElementById("card-empty");
      if (ce) ce.classList.add("hidden");
    } catch (eLay) {
      console.error("[MascotBook] showNotFound: error ocultando layouts", eLay);
    }
    var nf = document.getElementById("card-not-found");
    if (nf) nf.classList.remove("hidden");
  }

  function setCardEmptyMessage(msg) {
    var el = document.querySelector("#card-empty p");
    if (el) el.textContent = msg || "Aún no hay datos públicos en este perfil.";
  }

  function start() {
    var uid = resolveUid();
    console.log("[MascotBook] ID recibido:", uid || "(vacío)");
    var petPublic = isPetPublicView();

    if (!uid) {
      if (isEcAdminPreview()) {
        showLoading(true);
        var emptyWait = document.getElementById("card-empty");
        if (emptyWait) emptyWait.classList.add("hidden");
        var nfWait = document.getElementById("card-not-found");
        if (nfWait) nfWait.classList.add("hidden");
        return;
      }
      if (petPublic) {
        showLoading(false);
        var le0 = document.getElementById("layout-elite");
        if (le0) le0.classList.add("hidden");
        var lm0 = document.getElementById("layout-mascot");
        if (lm0) lm0.classList.add("hidden");
        setCardEmptyMessage("Falta el id de la mascota en el enlace (?id=…).");
        var emptyPet = document.getElementById("card-empty");
        if (emptyPet) emptyPet.classList.remove("hidden");
        return;
      }
      window.location.replace("index.html");
      return;
    }
    window.__EC_CARD_UID = uid;
    initMascotPhotoLightbox();

    /** Vista previa admin sin doc en Firestore: tarjeta de bienvenida hasta el postMessage. */
    var EC_DEMO_MASCOT_UID = "__ec_demo_mascot__";
    if (uid === EC_DEMO_MASCOT_UID && isEcAdminMascotPreview()) {
      showLoading(false);
      var leDemo = document.getElementById("layout-elite");
      if (leDemo) leDemo.classList.add("hidden");
      var ceDemo = document.getElementById("card-empty");
      if (ceDemo) ceDemo.classList.add("hidden");
      var nfDemo = document.getElementById("card-not-found");
      if (nfDemo) nfDemo.classList.add("hidden");
      var lmDemo = document.getElementById("layout-mascot");
      if (lmDemo) lmDemo.classList.remove("hidden");
      var welcomePayload = {
        nombre: "Luna (demo)",
        raza: "Mestiza adorable",
        sexo: "Hembra",
        salud: "",
        historia:
          "Soy un ejemplo vivo del panel: editá estos textos y la vista previa se actualiza al instante.",
        personalidad: "Juguetona, curiosa y muy sociable.",
        muro: "¡Hola! Estás probando MascotBook en modo demo.",
        mascotProTheme: "classic_paws",
        tema: "classic_paws",
        mascotSurfaceTheme: "cloud_cream",
        accentColor: "#ec4899",
        fotoPerfilUrl:
          "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&h=400&fit=crop&q=80",
        fotoCabeceraUrl:
          "https://images.unsplash.com/photo-1552053834-87076afc88a7?w=1200&h=600&fit=crop&q=80",
        galeria: [],
        galeriaSlots: [],
        vacunas: [],
        veterinario: {},
        fichaCritica: {},
        visitas: 12,
        likes: 3,
        mascotaPerdida: false,
        whatsappUrgencia: "",
        mascotId: uid,
        ownerUid: uid,
      };
      try {
        var nm0 = window.normalizeMascotCard
          ? window.normalizeMascotCard(welcomePayload)
          : welcomePayload;
        renderMascot(nm0);
      } catch (eDemoWelcome) {
        console.error("[MascotBook] Demo bienvenida:", eDemoWelcome);
      }
      return;
    }

    var cfg = window.FIREBASE_WEB_CONFIG;
    if (!cfg || !cfg.apiKey || String(cfg.apiKey).indexOf("REEMPLAZAR") !== -1) {
      if (isEcAdminMascotPreview()) {
        showLoading(true);
        return;
      }
      if (petPublic) {
        showLoading(false);
        var leC = document.getElementById("layout-elite");
        if (leC) leC.classList.add("hidden");
        var lmC = document.getElementById("layout-mascot");
        if (lmC) lmC.classList.add("hidden");
        setCardEmptyMessage("Configuración de Firebase no disponible en esta página.");
        var emptyCfg = document.getElementById("card-empty");
        if (emptyCfg) emptyCfg.classList.remove("hidden");
        return;
      }
      showNotFound();
      return;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
    } catch (e) {}

    var db = firebase.firestore();
    var mascot = !!window.__MB_VIEW_IS_PET || isMascotView();
    var siloRef = mascot
      ? window.EC_SILO.mascotCardRef(db, uid)
      : window.EC_SILO.personalCardRef(db, uid);
    var rootRef = window.EC_SILO.accountRef(db, uid);

    showLoading(true);

    function renderMascotUnlessPreviewSuperseded(nm) {
      if (qs("ec_admin_preview") === "1" && __ecMascotPreviewLocked) return;
      try {
        renderMascot(nm);
      } catch (eRender) {
        console.error("[MascotBook] renderMascot error:", eRender);
        try {
          showLoading(false);
          var crF = document.getElementById("card-render");
          if (crF) {
            crF.style.display = "block";
            crF.classList.remove("hidden");
          }
          var nfF = document.getElementById("card-not-found");
          if (nfF) {
            nfF.style.display = "none";
            nfF.classList.add("hidden");
          }
          var ceF = document.getElementById("card-empty");
          if (ceF) {
            ceF.style.display = "none";
            ceF.classList.add("hidden");
          }
          var lm = document.getElementById("layout-mascot");
          if (lm) lm.classList.remove("hidden");
        } catch (e2) {}
      }
    }

    function mergeMascotasCountersThenRender(np) {
      if (!np || typeof np !== "object") np = {};
      var uidLocal = String(window.__EC_CARD_UID || "").trim();
      if (!uidLocal || typeof firebase === "undefined" || !firebase.firestore) {
        renderMascotUnlessPreviewSuperseded(np);
        return;
      }
      db.collection("mascotas")
        .doc(uidLocal)
        .get()
        .then(function (snap) {
          if (snap.exists) {
            var c = snap.data() || {};
            if (c.visitas != null) np.visitas = Number(c.visitas) || 0;
            if (c.likes != null) np.likes = Number(c.likes) || 0;
          }
          renderMascotUnlessPreviewSuperseded(np);
        })
        .catch(function () {
          renderMascotUnlessPreviewSuperseded(np);
        });
    }

    if (isEcAdminMascotPreview()) {
      setTimeout(function () {
        if (__ecMascotPreviewLocked) return;
        if (window.__EC_MASCOT_HAS_RENDERED) return;
        var testPayload = {
          nombre: "Prueba · Preview MascotBook",
          raza: "Timeout3s",
          muro:
            "Datos de prueba: no llegó postMessage desde el panel. Si ves esto, el render del iframe funciona.",
          historia: "",
          personalidad: "",
          mascotProTheme: "candy_pop",
          tema: "candy_pop",
          mascotSurfaceTheme: "cloud_cream",
          visitas: 0,
          likes: 0,
          galeria: [],
          ownerUid: uid,
          mascotId: uid,
        };
        try {
          showLoading(false);
        } catch (eT0) {}
        var normTest = window.normalizeMascotCard
          ? window.normalizeMascotCard(testPayload)
          : testPayload;
        try {
          renderMascot(normTest);
        } catch (eT1) {
          console.error("[MascotBook] Preview datos de prueba:", eT1);
        }
        __ecMascotPreviewLocked = true;
        console.warn(
          "[MascotBook] Preview: datos de prueba inyectados (sin postMessage en 3s)."
        );
      }, 3000);
    }

    function finishMascotOrElite(siloSnap, accountRaw) {
      showLoading(false);
      var leF = document.getElementById("layout-elite");
      if (leF) leF.classList.add("hidden");
      var lmF = document.getElementById("layout-mascot");
      if (lmF) lmF.classList.add("hidden");
      hideMascotLostUi();
      if (siloSnap.exists) {
        var data2 = siloSnap.data() || {};
        var np = window.normalizePersonalCard ? window.normalizePersonalCard(data2) : data2;
        np = applyEliteAccountRules(np, uid, accountRaw);
        renderElite(np);
        return;
      }
      var raw = accountRaw && typeof accountRaw === "object" ? accountRaw : {};
      if (!raw || Object.keys(raw).length === 0) {
        showNotFound();
        return;
      }
      var np2 = window.normalizePersonalCard(mapLegacyPersonal(raw));
      np2 = applyEliteAccountRules(np2, uid, raw);
      renderElite(np2);
    }

    function finishMascotBook(siloSnap, accountRaw) {
      showLoading(false);
      var leF = document.getElementById("layout-elite");
      if (leF) leF.classList.add("hidden");
      var lmF = document.getElementById("layout-mascot");
      if (lmF) lmF.classList.add("hidden");
      hideMascotLostUi();
      console.log("SNAP:", siloSnap.exists);
      if (siloSnap.exists) {
        var data = siloSnap.data() || {};
        console.log("DATA:", data);
        try {
          window.__EC_LAST_MASCOTA_RAW_DOC =
            data && typeof data === "object" ? Object.assign({}, data) : {};
        } catch (eRaw) {
          window.__EC_LAST_MASCOTA_RAW_DOC = data;
        }
        window.__EC_MASCOT_DOC_EXISTS = true;
        var lmOk = document.getElementById("layout-mascot");
        if (lmOk) lmOk.classList.remove("hidden");
        try {
          __mascotCounterRef = db.collection("mascotas").doc(uid);
        } catch (eMc) {}
        var np = window.normalizeMascotCard ? window.normalizeMascotCard(data) : data;
        np.__mascotFirestoreDocExists = true;
        mergeMascotasCountersThenRender(np);
        return;
      }
      var raw = accountRaw && typeof accountRaw === "object" ? accountRaw : {};
      if (!raw || Object.keys(raw).length === 0) {
        if (isEcAdminMascotPreview()) {
          showLoading(true);
          return;
        }
        showNotFound();
        return;
      }
      try {
        window.__EC_LAST_MASCOTA_RAW_DOC =
          raw && typeof raw === "object" ? Object.assign({}, raw) : {};
      } catch (eR2) {
        window.__EC_LAST_MASCOTA_RAW_DOC = raw;
      }
      window.__EC_MASCOT_DOC_EXISTS = true;
      var lmOk2 = document.getElementById("layout-mascot");
      if (lmOk2) lmOk2.classList.remove("hidden");
      try {
        __mascotCounterRef = db.collection("mascotas").doc(uid);
      } catch (eMc2) {}
      var legacy = mapLegacyMascot(raw);
      var np2 = window.normalizeMascotCard ? window.normalizeMascotCard(legacy) : legacy;
      np2.__mascotFirestoreDocExists = true;
      mergeMascotasCountersThenRender(np2);
    }

    Promise.all([siloRef.get(), rootRef.get()])
      .then(function (pair) {
        var siloSnap = pair[0];
        var acctSnap = pair[1];
        var accountRaw = acctSnap.exists ? acctSnap.data() || {} : {};
        if (mascot) {
          if (siloSnap.exists) {
            finishMascotBook(siloSnap, accountRaw);
            return;
          }
          if (!acctSnap.exists) {
            if (isEcAdminMascotPreview()) {
              showLoading(true);
            } else {
              showLoading(false);
              showNotFound();
            }
            return;
          }
          var rawMascot = acctSnap.data() || {};
          finishMascotBook(siloSnap, rawMascot);
          return;
        }
        if (siloSnap.exists) {
          finishMascotOrElite(siloSnap, accountRaw);
          return;
        }
        if (!acctSnap.exists) {
          if (isEcAdminPreview()) {
            showLoading(true);
          } else {
            showLoading(false);
            showNotFound();
          }
          return;
        }
        var rawAll = acctSnap.data() || {};
        finishMascotOrElite(siloSnap, rawAll);
      })
      .catch(function (err) {
        console.error("Error Firestore:", err);
        if (mascot) {
          if (isEcAdminMascotPreview()) {
            showLoading(true);
            return;
          }
          showLoading(false);
          setCardEmptyMessage(
            "No se pudo cargar el perfil. Si sos el dueño, revisá las reglas de Firestore."
          );
          var leEr = document.getElementById("layout-elite");
          if (leEr) leEr.classList.add("hidden");
          var lmEr = document.getElementById("layout-mascot");
          if (lmEr) lmEr.classList.add("hidden");
          var nfEr = document.getElementById("card-not-found");
          if (nfEr) nfEr.classList.add("hidden");
          var emptyErr = document.getElementById("card-empty");
          if (emptyErr) emptyErr.classList.remove("hidden");
          return;
        }
        if (isEcAdminPreview()) {
          showLoading(true);
          return;
        }
        showNotFound();
      });
  }

  window.addEventListener("message", function (ev) {
    if (String(qs("ec_admin_preview") || "") !== "1") return;
    try {
      var origin = window.location.origin || "";
      if (origin && ev.origin !== origin) return;
    } catch (eOrig) {}
    var data = ev.data;
    if (!data || typeof data !== "object" || data.type !== "EC_MASCOTBOOK_PREVIEW") return;
    var payload = data.payload;
    if (!payload || typeof payload !== "object") return;
    __ecMascotPreviewLocked = true;
    var pUid = String(payload.ownerUid || payload.mascotId || resolveUid() || "").trim();
    if (pUid) window.__EC_CARD_UID = pUid;
    showLoading(false);
    var layElite = document.getElementById("layout-elite");
    if (layElite) layElite.classList.add("hidden");
    var emptyMsg = document.getElementById("card-empty");
    if (emptyMsg) emptyMsg.classList.add("hidden");
    var nfMsg = document.getElementById("card-not-found");
    if (nfMsg) nfMsg.classList.add("hidden");
    if (typeof hideMascotLostUi === "function") hideMascotLostUi();
    try {
      initMascotPhotoLightbox();
    } catch (eLb) {}
    var nm = window.normalizeMascotCard ? window.normalizeMascotCard(payload) : payload;
    renderMascot(nm);
  });

  start();
    })();
  }
  document.addEventListener("DOMContentLoaded", function () {
    runCardPublicWhenDomReady();
  });
  if (document.readyState !== "loading") {
    runCardPublicWhenDomReady();
  }
})();
