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

      function isEcAdminElitePreview() {
        return isEcAdminPreview() && !isMascotView();
      }

      /** UID disponible antes de start() (iframe preview, contadores, mensajes). */
      window.__EC_CARD_UID = resolveUid();

      /** Preview admin: si el padre envió datos por postMessage, no pisan Firestore. */
      var __ecMascotPreviewLocked = false;
      var __ecElitePreviewLocked = false;

  function applyElitePreviewOverrides(p) {
    var oa = qs("ec_pa").toLowerCase();
    if (oa === "round" || oa === "rect") p.user_avatarShape = oa;
    /* No pisar user_buttonLayout desde ec_pl: el iframe usa postMessage con datos frescos del dash;
       si ec_pl queda desfasado del dropdown, la vista previa ignoraba el valor guardado/en vivo. */
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
      m.alertaExtravioActiva = true;
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
      bannerUrl: String(d.bannerUrl || d.banner_url || "").trim(),
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
      alertaExtravioActiva:
        d.alertaExtravioActiva === true || (d.alertaExtravioActiva == null && !!d.mascotaPerdida),
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

  var MB_DEFAULT_HERO_BANNER_URL = "/assets/image_0.png";

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
      var portadaCustomUrl = String(d.fotoCabeceraUrl || d.portada || "").trim();
      var portadaUrl = portadaCustomUrl || MB_DEFAULT_HERO_BANNER_URL;
      setImage("mascot-hero-img", portadaUrl);
      var heroImg = document.getElementById("mascot-hero-img");
      if (heroImg) {
        heroImg.style.objectFit = "cover";
        heroImg.style.objectPosition = "center";
      }
      if (hero) {
        if (portadaUrl) hero.classList.add("mb-hero--has-img");
        else hero.classList.remove("mb-hero--has-img");
        if (!portadaCustomUrl) {
          hero.style.backgroundImage = "url('" + MB_DEFAULT_HERO_BANNER_URL + "')";
          hero.style.backgroundSize = "cover";
          hero.style.backgroundPosition = "center";
          hero.style.backgroundRepeat = "no-repeat";
        } else {
          hero.style.backgroundImage = "";
          hero.style.backgroundSize = "";
          hero.style.backgroundPosition = "";
          hero.style.backgroundRepeat = "";
        }
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

      var memRibbon = document.getElementById("mascot-public-memorial-ribbon");
      var isMemorialPublic = String(d.mbProfileStatus || "").toLowerCase() === "memorial";
      if (memRibbon) memRibbon.classList.toggle("hidden", !isMemorialPublic);
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
  var __eliteShareName = "";
  var __eliteShareProfile = { telefono: "", email: "", empresa: "WebElite SOLUTIONS" };
  var __ecRescueMode = false;

  function ecTimestampMs(v) {
    if (v == null) return null;
    if (typeof v === "number" && isFinite(v)) return v;
    if (v && typeof v.toMillis === "function") {
      try {
        return v.toMillis();
      } catch (e0) {}
    }
    if (v && typeof v.seconds === "number") return v.seconds * 1000;
    return null;
  }

  function ecTrialExpiredFromDoc(doc) {
    var start = ecTimestampMs(doc && (doc.trialStartDate || doc.fecha_registro || doc.createdAt));
    if (start == null) return false;
    return Date.now() - start > 7 * 24 * 60 * 60 * 1000;
  }

  function ecPublicRescueByDoc(doc, app) {
    if (!doc || typeof doc !== "object") return false;
    var globalSt = String(doc.status || "").trim().toLowerCase();
    if (globalSt === "suspended" || globalSt === "expired") return true;
    var dueMs = ecTimestampMs(doc.vencimientoMembresia || doc.premiumUntil);
    if (dueMs != null && Date.now() > dueMs) return true;
    var appKey = String(app || "elitecard") === "mascotbook" ? "mascotbook" : "elitecard";
    var appStRaw =
      appKey === "mascotbook"
        ? doc.mascotbook_status || doc.plan_status || doc.status
        : doc.elitecard_status || doc.plan_status || doc.status;
    var appSt = String(appStRaw || "").trim().toLowerCase();
    if (appSt === "active" || appSt === "premium" || appSt === "pro" || appSt === "paid") return false;
    if (appSt === "trial" && !ecTrialExpiredFromDoc(doc)) return false;
    if (appSt === "inactive" || appSt === "expired" || appSt === "suspended") return true;
    return ecTrialExpiredFromDoc(doc);
  }

  function ecIsStandaloneDisplayMode() {
    try {
      if (window.navigator && window.navigator.standalone === true) return true;
      if (!window.matchMedia) return false;
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches
      );
    } catch (e) {
      return false;
    }
  }

  function ecApplyPublicRescueUi() {
    var shareBtn = document.getElementById("elite-footer-share");
    if (shareBtn) {
      shareBtn.disabled = !!__ecRescueMode;
      shareBtn.style.opacity = __ecRescueMode ? "0.45" : "1";
      shareBtn.title = __ecRescueMode
        ? "Tu período gratuito finalizó. Activa la membresía para compartir."
        : "";
    }
    var banner = document.getElementById("ec-rescue-public-banner");
    if (!banner && __ecRescueMode) {
      banner = document.createElement("div");
      banner.id = "ec-rescue-public-banner";
      banner.style.position = "fixed";
      banner.style.left = "0";
      banner.style.right = "0";
      banner.style.bottom = "0";
      banner.style.zIndex = "120";
      banner.style.padding = "0.7rem 0.9rem";
      banner.style.background = "rgba(17,24,39,0.96)";
      banner.style.color = "#fff";
      banner.style.fontSize = "0.86rem";
      banner.style.fontWeight = "600";
      banner.style.textAlign = "center";
      banner.textContent =
        "Tu período gratuito terminó. Modo rescate activo: visualización habilitada, edición y compartir bloqueados.";
      document.body.appendChild(banner);
    }
    if (banner) banner.style.display = __ecRescueMode ? "block" : "none";
    var pwa = document.getElementById("ec-rescue-pwa-blocker");
    if (!pwa && __ecRescueMode && ecIsStandaloneDisplayMode()) {
      pwa = document.createElement("div");
      pwa.id = "ec-rescue-pwa-blocker";
      pwa.style.position = "fixed";
      pwa.style.inset = "0";
      pwa.style.zIndex = "130";
      pwa.style.background = "rgba(10,10,10,0.9)";
      pwa.style.color = "#fff";
      pwa.style.display = "flex";
      pwa.style.alignItems = "center";
      pwa.style.justifyContent = "center";
      pwa.style.padding = "1.25rem";
      pwa.innerHTML =
        '<div style="max-width:28rem;text-align:center;background:#111827;border:1px solid rgba(255,255,255,0.14);border-radius:1rem;padding:1.1rem 1rem;">' +
        '<h3 style="margin:0 0 .45rem 0;font-size:1.05rem;">Período gratuito finalizado</h3>' +
        '<p style="margin:0;line-height:1.45;font-size:.92rem;">Esta app quedó en modo rescate. Para volver a compartir y usar funciones completas, activa tu membresía desde el panel WebElite.</p>' +
        "</div>";
      document.body.appendChild(pwa);
    }
    if (pwa) pwa.style.display = __ecRescueMode && ecIsStandaloneDisplayMode() ? "flex" : "none";
  }

  function eliteShareContext() {
    var url = String(window.location.href || "").trim();
    var domNameEl = document.getElementById("elite-name");
    var modalNameEl = document.getElementById("elite-qr-user-name");
    var domName = domNameEl ? String(domNameEl.textContent || "").trim() : "";
    var modalName = modalNameEl ? String(modalNameEl.textContent || "").trim() : "";
    var name = domName || modalName || __eliteShareName || "Mi contacto";
    return { url: url, name: name };
  }

  function eliteGetQrServiceUrl(data) {
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=" +
      encodeURIComponent(String(data || ""))
    );
  }

  function eliteRenderQrFromData(data) {
    var img = document.getElementById("elite-qr-img");
    if (!img) return;
    img.src = eliteGetQrServiceUrl(data);
  }

  function eliteBuildOfflineVcard() {
    var data = eliteShareContext();
    var tel = String((__eliteShareProfile && __eliteShareProfile.telefono) || "").trim();
    var email = String((__eliteShareProfile && __eliteShareProfile.email) || "").trim();
    var empresa = String((__eliteShareProfile && __eliteShareProfile.empresa) || "WebElite SOLUTIONS").trim();
    var lines = ["BEGIN:VCARD", "VERSION:3.0", "FN:" + data.name, "ORG:" + empresa];
    if (tel) lines.push("TEL;TYPE=CELL:" + tel);
    if (email) lines.push("EMAIL;TYPE=INTERNET:" + email);
    lines.push("END:VCARD");
    return lines.join("\r\n");
  }

  function eliteShareToast(message) {
    var el = document.getElementById("elite-share-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "elite-share-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "1.2rem";
      el.style.transform = "translateX(-50%)";
      el.style.zIndex = "120";
      el.style.padding = "0.62rem 0.95rem";
      el.style.borderRadius = "999px";
      el.style.background = "rgba(17,24,39,0.95)";
      el.style.color = "#fff";
      el.style.fontSize = "0.85rem";
      el.style.fontWeight = "600";
      el.style.boxShadow = "0 10px 28px rgba(0,0,0,0.35)";
      el.style.opacity = "0";
      el.style.transition = "opacity 0.18s ease";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.opacity = "1";
    clearTimeout(eliteShareToast._timer);
    eliteShareToast._timer = setTimeout(function () {
      el.style.opacity = "0";
    }, 1800);
  }

  function eliteAnalyticsTrack(metricKey, meta) {
    if (!metricKey || isPetPublicView()) return;
    var extra = meta && typeof meta === "object" ? meta : {};
    try {
      if (typeof window.gtag === "function") {
        window.gtag(
          "event",
          metricKey,
          Object.assign({ event_category: "elite_share_modal", event_label: "card_public" }, extra)
        );
      }
    } catch (eGtag) {}
    try {
      if (Array.isArray(window.dataLayer)) {
        window.dataLayer.push(
          Object.assign({ event: "elite_share_modal_action", metricKey: metricKey }, extra)
        );
      }
    } catch (eDl) {}
    try {
      var uid = String(window.__EC_CARD_UID || "").trim();
      if (!uid || typeof firebase === "undefined" || !firebase.firestore) return;
      var usersCollection = (window.FIRESTORE_USERS_COLLECTION || "usuarios").trim() || "usuarios";
      var payload = {};
      payload[metricKey] = firebase.firestore.FieldValue.increment(1);
      payload.clics_totales = firebase.firestore.FieldValue.increment(1);
      firebase.firestore().collection(usersCollection).doc(uid).set(payload, { merge: true }).catch(function () {});
    } catch (eFs) {}
  }

  async function eliteCopyShareLink() {
    var data = eliteShareContext();
    eliteAnalyticsTrack("clics_share_copy");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(data.url);
        eliteShareToast("¡Enlace copiado!");
        return;
      }
    } catch (eClipboard) {}
    window.prompt("Copia este enlace:", data.url);
  }

  function eliteOpenShareWindow(url) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function eliteShareWhatsApp() {
    var data = eliteShareContext();
    eliteAnalyticsTrack("clics_share_whatsapp");
    var text = "Hola, te comparto la tarjeta digital de " + data.name + ": " + data.url;
    eliteOpenShareWindow("https://wa.me/?text=" + encodeURIComponent(text));
  }

  function eliteShareByEmail() {
    var data = eliteShareContext();
    eliteAnalyticsTrack("clics_share_email");
    var subject = "Tarjeta Digital - " + data.name;
    var body = "Hola,\n\nTe comparto la tarjeta digital de " + data.name + ":\n" + data.url;
    window.location.href =
      "mailto:?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function eliteShareLinkedIn() {
    var data = eliteShareContext();
    eliteAnalyticsTrack("clics_share_linkedin");
    eliteOpenShareWindow(
      "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(data.url)
    );
  }

  function eliteToggleOfflineState(enabled) {
    var overlay = document.getElementById("elite-qr-overlay");
    var qrBox = overlay ? overlay.querySelector(".ec-share-qr-box") : null;
    if (qrBox) qrBox.classList.toggle("ec-share-qr-box--offline", !!enabled);
    if (enabled) {
      eliteRenderQrFromData(eliteBuildOfflineVcard());
    } else {
      eliteRenderQrFromData(__eliteShareUrl || eliteShareContext().url || getElitePublicUrl());
    }
    eliteAnalyticsTrack("clics_share_offline_toggle", { offlineEnabled: !!enabled });
  }

  function eliteShareNative() {
    if (!navigator.share) return;
    var data = eliteShareContext();
    eliteAnalyticsTrack("clics_share_native");
    navigator
      .share({
        title: "Tarjeta Digital - " + data.name,
        text: "Te comparto la tarjeta digital de " + data.name,
        url: data.url,
      })
      .catch(function () {});
  }

  function openEliteQrOverlay() {
    if (__ecRescueMode) {
      eliteShareToast("Modo rescate activo: activa tu membresía para compartir.");
      return;
    }
    var shareData = eliteShareContext();
    __eliteShareUrl = shareData.url || getElitePublicUrl();
    var ov = document.getElementById("elite-qr-overlay");
    var nativeBtn = document.getElementById("elite-qr-share-native");
    var modalNameEl = document.getElementById("elite-qr-user-name");
    var modalPhotoEl = document.getElementById("elite-qr-user-photo");
    var headerPhotoEl = document.getElementById("elite-photo");
    var fallbackEl = ov ? ov.querySelector(".ec-share-profile-fallback") : null;
    var offlineToggle = document.getElementById("elite-qr-offline");
    if (!ov) return;
    eliteRenderQrFromData(__eliteShareUrl);
    if (modalNameEl) modalNameEl.textContent = shareData.name;
    if (modalPhotoEl) {
      var hasPhoto = !!(headerPhotoEl && headerPhotoEl.getAttribute("src"));
      if (hasPhoto) {
        modalPhotoEl.src = String(headerPhotoEl.getAttribute("src") || "");
        modalPhotoEl.classList.remove("hidden");
        if (fallbackEl) fallbackEl.classList.add("hidden");
      } else {
        modalPhotoEl.classList.add("hidden");
        modalPhotoEl.removeAttribute("src");
        if (fallbackEl) fallbackEl.classList.remove("hidden");
      }
    }
    if (offlineToggle) {
      offlineToggle.checked = false;
      eliteToggleOfflineState(false);
    }
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
    var waBtn = document.getElementById("elite-qr-share-whatsapp");
    var emailBtn = document.getElementById("elite-qr-share-email");
    var linkedinBtn = document.getElementById("elite-qr-share-linkedin");
    var offlineToggle = document.getElementById("elite-qr-offline");
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
        void eliteCopyShareLink();
      });
    }
    if (waBtn) waBtn.addEventListener("click", eliteShareWhatsApp);
    if (emailBtn) emailBtn.addEventListener("click", eliteShareByEmail);
    if (linkedinBtn) linkedinBtn.addEventListener("click", eliteShareLinkedIn);
    if (offlineToggle) {
      offlineToggle.addEventListener("change", function () {
        eliteToggleOfflineState(offlineToggle.checked);
      });
    }
    if (nativeBtn) {
      nativeBtn.addEventListener("click", eliteShareNative);
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
    __ecRescueMode = ecPublicRescueByDoc(p || {}, "elitecard");
    ecApplyPublicRescueUi();
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
      (p.redes &&
        (p.redes.instagram ||
          p.redes.linkedin ||
          p.redes.sitioWeb ||
          p.redes.whatsappNumero));
    if (!has) {
      var heroEmpty = document.getElementById("elite-hero-banner");
      if (heroEmpty) {
        heroEmpty.classList.add("hidden");
        heroEmpty.style.backgroundImage = "";
        heroEmpty.setAttribute("aria-label", "");
      }
      root.classList.add("hidden");
      if (empty) empty.classList.remove("hidden");
      return;
    }

    var hero = document.getElementById("elite-hero-banner");
    var bannerUrl = String(p.bannerUrl || p.banner_url || "").trim();
    if (hero) {
      if (bannerUrl) {
        hero.classList.remove("hidden");
        hero.style.backgroundImage = "url(" + JSON.stringify(bannerUrl) + ")";
        hero.setAttribute("aria-label", "Banner · " + (p.user_empresa || p.empresa || p.user_nombre || ""));
      } else {
        hero.classList.add("hidden");
        hero.style.backgroundImage = "";
        hero.setAttribute("aria-label", "");
      }
    }

    var photo = document.getElementById("elite-photo");
    var photoFb = document.getElementById("elite-photo-fallback");
    if (photo && photoFb) {
      photo.onerror = function () {
        try {
          photo.removeAttribute("src");
        } catch (ePh) {}
        photo.classList.add("hidden");
        photoFb.classList.remove("hidden");
      };
      photo.onload = function () {
        photo.classList.remove("hidden");
        photoFb.classList.add("hidden");
      };
    }
    if (photo) {
      if (p.fotoUrl) {
        photo.alt = p.user_nombre || p.nombreCompleto || "Foto de perfil";
        photo.src = p.fotoUrl;
        try {
          if (photo.complete && photo.naturalHeight > 0) {
            photo.classList.remove("hidden");
            if (photoFb) photoFb.classList.add("hidden");
          }
        } catch (eCmp) {}
      } else {
        photo.classList.add("hidden");
        try {
          photo.removeAttribute("src");
        } catch (ePh2) {}
        if (photoFb) photoFb.classList.add("hidden");
      }
    }
    var avatarShape = String(p.user_avatarShape || p.avatarShape || "rect").toLowerCase();
    root.classList.toggle("ec-avatar-round", avatarShape === "round" || avatarShape === "circle");
    var buttonLayout = String(p.user_buttonLayout || p.buttonLayout || "list").toLowerCase();
    if (buttonLayout !== "grid" && buttonLayout !== "icons") buttonLayout = "list";
    var isGridLayout = buttonLayout === "grid" || buttonLayout === "icons";
    root.classList.toggle("ec-buttons-grid", isGridLayout);
    root.classList.toggle("ec-buttons-list", buttonLayout === "list");
    var bg = String(p.user_bgColor || "#000000").trim();
    if (!/^#[0-9a-f]{6}$/i.test(bg) && !/^#[0-9a-f]{3}$/i.test(bg)) bg = "#000000";
    root.style.setProperty("--ec-user-bg", bg);
    applyEliteSurfaceClass(root, p);

    document.getElementById("elite-name").textContent = p.user_nombre || p.nombreCompleto || "Profesional";
    __eliteShareName = String(p.user_nombre || p.nombreCompleto || "Profesional").trim();
    __eliteShareProfile = {
      telefono: String(p.telefono || "").trim(),
      email: String(p.email || p.emailInstitucional || "").trim(),
      empresa: "WebElite SOLUTIONS",
    };
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
      a.setAttribute("aria-label", def.ariaLabel || def.label);
      if (def.title) a.title = def.title;
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
        label: "Teléfono",
        ariaLabel: "Llamar por teléfono",
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
        label: "WhatsApp",
        ariaLabel: "Contactar por WhatsApp",
        icon: "fa-brands fa-whatsapp",
        kind: "ec-wa",
        isMailto: false,
      });
    }
    if (em) {
      btnDefs.push({
        href: "mailto:" + em + "?subject=" + mailSubj + "&body=" + mailBody,
        label: "Email",
        ariaLabel: "Enviar correo electrónico",
        icon: "fa-regular fa-envelope",
        kind: "ec-mail",
        isMailto: true,
      });
    }
    var inst = String(p.emailInstitucional || "").trim();
    if (inst && inst.toLowerCase() !== em.toLowerCase()) {
      btnDefs.push({
        href: "mailto:" + inst + "?subject=" + mailSubj + "&body=" + mailBody,
        label: "Corporativo",
        ariaLabel: "Correo institucional",
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
        label: "LinkedIn",
        icon: "fa-brands fa-linkedin-in",
        kind: "ec-li",
        isMailto: false,
      });
    }
    var web = (p.redes && p.redes.sitioWeb) || p.sitioWeb;
    if (web) {
      btnDefs.push({
        href: web,
        label: "Web",
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
    var footBar = root.querySelector(".ec-footer");
    if (logoFoot && logoFootImg) {
      if (logoUrl) {
        logoFootImg.src = logoUrl;
        logoFoot.classList.remove("hidden");
        logoFoot.setAttribute("aria-hidden", "true");
        if (footBar) footBar.classList.remove("ec-footer--no-logo");
      } else {
        logoFoot.classList.add("hidden");
        logoFootImg.removeAttribute("src");
        if (footBar) footBar.classList.add("ec-footer--no-logo");
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
    try {
      window.__EC_ELITE_HAS_RENDERED = true;
    } catch (eElR) {}
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
    __ecRescueMode = ecPublicRescueByDoc(m || {}, "mascotbook");
    ecApplyPublicRescueUi();

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
    var own =
      nm.dueno && typeof nm.dueno === "object" ? nm.dueno : {};
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

    function phoneHrefFromRaw(rawPhone) {
      var raw = String(rawPhone || "").trim();
      if (!raw) return "";
      var hasPlus = raw.charAt(0) === "+";
      var digits = raw.replace(/\D/g, "");
      if (!digits) return "";
      return "tel:" + (hasPlus ? "+" : "") + digits;
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

    var ownerHtml = "";
    if (own.nombre || own.telefono || own.direccion || own.email) {
      ownerHtml += own.nombre
        ? "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Nombre</span>" +
          escapeHtml(own.nombre) +
          "</div>"
        : "";
      ownerHtml += own.email
        ? "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Email</span>" +
          escapeHtml(own.email) +
          "</div>"
        : "";
      ownerHtml += own.direccion
        ? "<div class=\"mb-health-row\"><span class=\"mb-health-label\">Dirección</span>" +
          escapeHtml(own.direccion) +
          "</div>"
        : "";
      if (own.direccion) {
        var dq = encodeURIComponent(
          [own.direccion, own.nombre].filter(Boolean).join(" · ")
        );
        ownerHtml +=
          "<a class=\"mb-vet-map\" rel=\"noopener noreferrer\" target=\"_blank\" href=\"https://www.google.com/maps/search/?api=1&query=" +
          dq +
          "\"><i class=\"fa-solid fa-map-location-dot\" aria-hidden=\"true\"></i> Ver dirección (Dueño)</a>";
      }
      if (own.telefono) {
        var ownTelHref = phoneHrefFromRaw(own.telefono);
        if (ownTelHref) {
          ownerHtml +=
            "<a class=\"mb-vet-call\" href=\"" +
            ownTelHref +
            "\"><i class=\"fa-solid fa-phone\" aria-hidden=\"true\"></i> Llamar dueño</a>";
        }
      }
    }
    setBlock("mascot-block-owner", "mascot-owner", !!ownerHtml, ownerHtml);

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
        var vetTelHref = phoneHrefFromRaw(vet.telefono);
        if (vetTelHref) {
          vetHtml +=
            "<a class=\"mb-vet-call\" href=\"" +
            vetTelHref +
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
        !!ownerHtml ||
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

  var __EC_GPS_PRE_MODAL_WIRED = false;

  function lostGpsSessionPrefix(ownerUid) {
    var pub = String(window.__EC_PUBLIC_MASCOTA_DOC_ID || ownerUid || "").trim();
    return "ec_mb_gps_" + pub;
  }

  function markGpsModalSkippedForSession() {
    var uid = String(window.__EC_GPS_MODAL_OWNER_UID || window.__EC_CARD_UID || "").trim();
    if (!uid) return;
    try {
      sessionStorage.setItem(lostGpsSessionPrefix(uid) + "_skip", "1");
    } catch (e) {}
  }

  function markGpsModalCompletedForSession() {
    var uid = String(window.__EC_GPS_MODAL_OWNER_UID || window.__EC_CARD_UID || "").trim();
    if (!uid) return;
    try {
      sessionStorage.setItem(lostGpsSessionPrefix(uid) + "_done", "1");
    } catch (e) {}
  }

  function shouldOfferAutoGpsModal(ownerUid) {
    if (!ownerUid || qs("ec_admin_preview") === "1") return false;
    try {
      var p = lostGpsSessionPrefix(ownerUid);
      if (sessionStorage.getItem(p + "_done") === "1") return false;
      if (sessionStorage.getItem(p + "_skip") === "1") return false;
    } catch (e) {
      return false;
    }
    return true;
  }

  function hideGpsPermissionModal() {
    var m = document.getElementById("gps-permission-modal");
    if (m) {
      m.classList.add("hidden");
      m.setAttribute("aria-hidden", "true");
    }
    try {
      document.body.style.overflow = "";
    } catch (e) {}
    try {
      document.removeEventListener("keydown", __onGpsModalEscape);
    } catch (e2) {}
  }

  function __onGpsModalEscape(ev) {
    if (ev.key === "Escape") {
      markGpsModalSkippedForSession();
      hideGpsPermissionModal();
    }
  }

  function showGpsPermissionModal(petName) {
    wireGpsPermissionModalOnce();
    var textEl = document.getElementById("gps-permission-text");
    var name = String(petName || "esta mascota").trim() || "esta mascota";
    if (textEl) {
      textEl.textContent =
        "¡Gracias por encontrar a " +
        name +
        "! La alerta de extravío está activa. Si continuás, el navegador puede pedir permiso para enviar una ubicación aproximada al dueño. Solo se usa para este aviso.";
    }
    var m = document.getElementById("gps-permission-modal");
    if (m) {
      m.classList.remove("hidden");
      m.setAttribute("aria-hidden", "false");
      try {
        document.body.style.overflow = "hidden";
      } catch (e3) {}
      try {
        document.addEventListener("keydown", __onGpsModalEscape);
      } catch (e4) {}
    }
  }

  function performLostLocationShare(ownerUid, opts) {
    opts = opts || {};
    var locBtn = opts.locBtn || document.getElementById("mascot-lost-share-loc");
    var msg = opts.msg || document.getElementById("mascot-lost-msg");
    var markSessionOnSuccess = !!opts.markSessionOnSuccess;
    if (!ownerUid || !window.EC_SILO || !window.EC_SILO.mascotLostScansRef) return;
    if (!navigator.geolocation) {
      if (msg) {
        msg.textContent = "Tu navegador no permite geolocalización.";
        msg.classList.remove("hidden");
      }
      return;
    }
    if (locBtn) locBtn.disabled = true;
    if (msg) msg.classList.add("hidden");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        try {
          pushLostScanLocation(ownerUid, pos, false)
            .then(function () {
              if (markSessionOnSuccess) markGpsModalCompletedForSession();
              if (locBtn) locBtn.disabled = false;
              if (msg) {
                msg.textContent =
                  "Ubicación enviada. El dueño recibirá un aviso por correo si está configurado.";
                msg.classList.remove("hidden");
              }
            })
            .catch(function () {
              if (locBtn) locBtn.disabled = false;
              if (msg) {
                msg.textContent = "No pudimos guardar la ubicación. Intentá de nuevo.";
                msg.classList.remove("hidden");
              }
            });
        } catch (e) {
          if (locBtn) locBtn.disabled = false;
          if (msg) {
            msg.textContent = "Error al enviar. Intentá de nuevo.";
            msg.classList.remove("hidden");
          }
        }
      },
      function (err) {
        if (locBtn) locBtn.disabled = false;
        if (msg) {
          var denied = err && Number(err.code) === 1;
          msg.textContent = denied
            ? "Parece que se denegó el permiso de ubicación. Podés recargar la página o revisar los permisos del sitio en el navegador."
            : "No se obtuvo permiso o ubicación. Podés intentar de nuevo.";
          msg.classList.remove("hidden");
        }
      },
      { enableHighAccuracy: true, timeout: 14000, maximumAge: 0 }
    );
  }

  function wireGpsPermissionModalOnce() {
    if (__EC_GPS_PRE_MODAL_WIRED) return;
    __EC_GPS_PRE_MODAL_WIRED = true;
    var modal = document.getElementById("gps-permission-modal");
    var okBtn = document.getElementById("gps-permission-confirm");
    var noBtn = document.getElementById("gps-permission-decline");
    if (!modal || !okBtn || !noBtn) return;
    modal.addEventListener("click", function (ev) {
      if (ev.target === modal) {
        markGpsModalSkippedForSession();
      hideGpsPermissionModal();
    }
    });
    var panel = modal.querySelector(".mb-gps-modal-panel");
    if (panel) {
      panel.addEventListener("click", function (ev) {
        ev.stopPropagation();
      });
    }
    okBtn.addEventListener("click", function () {
      var uid = String(window.__EC_GPS_MODAL_OWNER_UID || "").trim();
      hideGpsPermissionModal();
      if (!uid) return;
      var locBtn = document.getElementById("mascot-lost-share-loc");
      var msg = document.getElementById("mascot-lost-msg");
      performLostLocationShare(uid, { locBtn: locBtn, msg: msg, markSessionOnSuccess: true });
    });
    noBtn.addEventListener("click", function () {
      markGpsModalSkippedForSession();
      hideGpsPermissionModal();
    });
  }

  function maybeOpenAutoGpsModal(ownerUid, nm) {
    if (!nm || !nm.alertaExtravioActiva) return;
    if (!ownerUid || !window.EC_SILO || !window.EC_SILO.mascotLostScansRef) return;
    if (!shouldOfferAutoGpsModal(ownerUid)) return;
    window.__EC_GPS_MODAL_OWNER_UID = ownerUid;
    var petName = String((nm && nm.nombre) || "").trim() || "esta mascota";
    setTimeout(function () {
      showGpsPermissionModal(petName);
    }, 0);
  }

  function hideMascotLostUi() {
    hideGpsPermissionModal();
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
    document.documentElement.classList.remove("ec-mascota-alerta");
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
    var pub = String(window.__EC_PUBLIC_MASCOTA_DOC_ID || "").trim();
    if (pub && pub !== String(ownerUid || "").trim()) {
      row.mascotaCardId = pub;
    }
    return ref.add(row);
  }

  function setupMascotLostMode(nm) {
    var ownerUid = String(
      window.__EC_LOST_SCAN_OWNER_UID || window.__EC_CARD_UID || ""
    ).trim();
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
    document.documentElement.classList.add("ec-mascota-alerta");
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
      performLostLocationShare(ownerUid, { locBtn: locBtn, msg: msg, markSessionOnSuccess: false });
    };

    var isPreview = qs("ec_admin_preview") === "1";
    if (!isPreview && ownerUid && nm && nm.alertaExtravioActiva) {
      maybeOpenAutoGpsModal(ownerUid, nm);
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
        var leLd = document.getElementById("layout-elite");
        if (
          window.__EC_ELITE_HAS_RENDERED &&
          leLd &&
          !leLd.classList.contains("hidden") &&
          !isMascotView()
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

  function ecLooksLikeEmailId(s) {
    s = String(s || "").trim();
    return s.indexOf("@") > 0 && s.indexOf(".") > 0;
  }

  function applyMascotPublicIds(publicDocId, ownerUidForLost) {
    publicDocId = String(publicDocId || "").trim();
    ownerUidForLost = String(ownerUidForLost || "").trim();
    window.__EC_CARD_UID = publicDocId;
    window.__EC_PUBLIC_MASCOTA_DOC_ID = publicDocId;
    window.__EC_LOST_SCAN_OWNER_UID = ownerUidForLost || publicDocId;
  }

  /**
   * Resolución pública MascotBook: id en URL = doc mascotas, doc tarjetas, o correo (ownerEmail/email).
   */
  function tryLoadMascotaPublicFirst(rawId, db, onDone) {
    rawId = String(rawId || "").trim();
    if (!rawId) {
      onDone(false);
      return;
    }
    var normEmail = ecLooksLikeEmailId(rawId) ? rawId.toLowerCase() : rawId;

    function emitFromSnap(snap) {
      if (!snap || !snap.exists) return false;
      var d = snap.data() || {};
      var pid = String(snap.id || "").trim();
      var ou = String(d.ownerUid || pid).trim();
      onDone(true, d, pid, ou);
      return true;
    }

    db.collection("mascotas")
      .doc(rawId)
      .get()
      .then(function (snap) {
        if (emitFromSnap(snap)) return null;
        return db.collection("tarjetas").doc(rawId).get();
      })
      .then(function (tSnap) {
        if (tSnap === null) return null;
        if (tSnap && tSnap.exists) {
          var t = tSnap.data() || {};
          var pid = String(t.publicCardId || "").trim();
          if (pid) return db.collection("mascotas").doc(pid).get();
        }
        if (ecLooksLikeEmailId(rawId)) {
          return db.collection("mascotas").where("ownerEmail", "==", normEmail).limit(5).get();
        }
        return "none";
      })
      .then(function (res) {
        if (res === null) return;
        if (res && res.exists !== undefined && typeof res.data === "function") {
          if (emitFromSnap(res)) return;
        }
        if (res === "none") {
          onDone(false);
          return;
        }
        if (res && res.docs && !res.empty) {
          emitFromSnap(res.docs[0]);
          return;
        }
        if (ecLooksLikeEmailId(rawId)) {
          return db.collection("mascotas").where("email", "==", normEmail).limit(5).get();
        }
        onDone(false);
      })
      .then(function (q2) {
        if (!q2 || !q2.docs) return;
        if (!q2.empty) {
          emitFromSnap(q2.docs[0]);
          return;
        }
        onDone(false);
      })
      .catch(function () {
        onDone(false);
      });
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
        fotoCabeceraUrl: "/assets/image_0.png",
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

    /** Vista previa admin EliteCard sin Firestore (mismo UID demo que admin.html). */
    var EC_DEMO_ELITE_UID = "__ec_demo_elite__";
    if (uid === EC_DEMO_ELITE_UID && isEcAdminElitePreview()) {
      showLoading(false);
      var lmElDemo = document.getElementById("layout-mascot");
      if (lmElDemo) lmElDemo.classList.add("hidden");
      var ceElDemo = document.getElementById("card-empty");
      if (ceElDemo) ceElDemo.classList.add("hidden");
      var nfElDemo = document.getElementById("card-not-found");
      if (nfElDemo) nfElDemo.classList.add("hidden");
      var leElDemo = document.getElementById("layout-elite");
      if (leElDemo) leElDemo.classList.remove("hidden");
      var eliteWelcomePayload = {
        user_nombre: "Lic. Valentina Schwindt",
        user_cargo: "Abogada · Societaria, contratos y compliance",
        user_empresa: "Estudio Schwindt",
        user_bio:
          "Asesoro a empresas y profesionales en constitución societaria, acuerdos comerciales y buenas prácticas regulatorias. Trabajo con foco en claridad, tiempos realistas y acompañamiento cercano.",
        email: "valentina.schwindt@estudioschwindt.demo",
        emailInstitucional: "contacto@estudioschwindt.demo",
        telefono: "+54 9 11 5555 7788",
        whatsappNumero: "+54 9 11 5555 7788",
        fotoUrl: "assets/image_1.png",
        logoUrl: "assets/logo10.png?v=3",
        instagram: "https://instagram.com/estudio.schwindt",
        linkedin: "https://www.linkedin.com/in/valentina-schwindt-abogada",
        sitioWeb: "https://estudioschwindt.demo",
        mapsUrl: "https://maps.google.com/?q=Av.+Corrientes+1234,+CABA",
        calendlyUrl: "https://calendly.com/demo-elitecard/reunion",
        vcardNombres: "Valentina",
        vcardApellidos: "Schwindt",
        vcardOrganizacion: "Estudio Schwindt",
        vcardTitulo: "Abogada",
        user_avatarShape: "rect",
        user_buttonLayout: "list",
        user_bgColor: "#000000",
        user_bgPreset: "matte",
        redes: {
          instagram: "https://instagram.com/estudio.schwindt",
          linkedin: "https://www.linkedin.com/in/valentina-schwindt-abogada",
          sitioWeb: "https://estudioschwindt.demo",
          whatsappNumero: "5491155557788",
        },
      };
      try {
        var ne0 = window.normalizePersonalCard
          ? window.normalizePersonalCard(eliteWelcomePayload)
          : eliteWelcomePayload;
        applyElitePreviewOverrides(ne0);
        renderElite(ne0);
      } catch (eEliteWelcome) {
        console.error("[EliteCard] Demo bienvenida:", eEliteWelcome);
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

    if (isEcAdminElitePreview()) {
      setTimeout(function () {
        if (__ecElitePreviewLocked) return;
        if (window.__EC_ELITE_HAS_RENDERED) return;
        var testElite = {
          user_nombre: "Lic. Valentina Schwindt (demo)",
          user_cargo: "Abogada · Societaria, contratos y compliance",
          user_empresa: "Estudio Schwindt",
          email: "valentina.schwindt@estudioschwindt.demo",
          telefono: "+54 9 11 5555 7788",
          fotoUrl: "assets/image_1.png",
          logoUrl: "assets/logo10.png?v=3",
          user_bgColor: "#000000",
          user_bgPreset: "matte",
          redes: {
            linkedin: "https://www.linkedin.com/in/valentina-schwindt-abogada",
            whatsappNumero: "5491155557788",
          },
        };
        try {
          showLoading(false);
        } catch (eTe0) {}
        var normElite = window.normalizePersonalCard
          ? window.normalizePersonalCard(testElite)
          : testElite;
        try {
          applyElitePreviewOverrides(normElite);
          renderElite(normElite);
        } catch (eTe1) {
          console.error("[EliteCard] Preview datos de prueba:", eTe1);
        }
        __ecElitePreviewLocked = true;
        console.warn("[EliteCard] Preview: datos de prueba (sin postMessage en 3s).");
      }, 3000);
    }

    function finishMascotOrElite(siloSnap, accountRaw) {
      if (isEcAdminElitePreview() && __ecElitePreviewLocked) {
        showLoading(false);
        return;
      }
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
      if (isEcAdminMascotPreview() && __ecMascotPreviewLocked) {
        showLoading(false);
        return;
      }
      showLoading(false);
      var leF = document.getElementById("layout-elite");
      if (leF) leF.classList.add("hidden");
      var lmF = document.getElementById("layout-mascot");
      if (lmF) lmF.classList.add("hidden");
      hideMascotLostUi();
      console.log("SNAP:", siloSnap.exists);
      if (siloSnap.exists) {
        var data = siloSnap.data() || {};
        applyMascotPublicIds(uid, String(data.ownerUid || uid).trim());
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
      applyMascotPublicIds(uid, String(raw.ownerUid || uid || "").trim());
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

    function finishMascotBookDirect(data, publicId, ownerUid) {
      if (isEcAdminMascotPreview() && __ecMascotPreviewLocked) {
        showLoading(false);
        return;
      }
      showLoading(false);
      var leF = document.getElementById("layout-elite");
      if (leF) leF.classList.add("hidden");
      var lmF = document.getElementById("layout-mascot");
      if (lmF) lmF.classList.add("hidden");
      hideMascotLostUi();
      applyMascotPublicIds(publicId, ownerUid);
      console.log("SNAP:", true);
      console.log("DATA:", data);
      try {
        window.__EC_LAST_MASCOTA_RAW_DOC =
          data && typeof data === "object" ? Object.assign({}, data) : {};
      } catch (eRawD) {
        window.__EC_LAST_MASCOTA_RAW_DOC = data;
      }
      window.__EC_MASCOT_DOC_EXISTS = true;
      var lmOkD = document.getElementById("layout-mascot");
      if (lmOkD) lmOkD.classList.remove("hidden");
      try {
        __mascotCounterRef = db.collection("mascotas").doc(publicId);
      } catch (eMcD) {}
      var npD = window.normalizeMascotCard ? window.normalizeMascotCard(data) : data;
      npD.__mascotFirestoreDocExists = true;
      mergeMascotasCountersThenRender(npD);
    }

    function loadFromSiloAndAccount() {
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
          if (isEcAdminElitePreview()) {
            showLoading(false);
            var leHold = document.getElementById("layout-elite");
            var lmHold = document.getElementById("layout-mascot");
            if (lmHold) lmHold.classList.add("hidden");
            var ceHold = document.getElementById("card-empty");
            if (ceHold) ceHold.classList.add("hidden");
            var nfHold = document.getElementById("card-not-found");
            if (nfHold) nfHold.classList.add("hidden");
            if (leHold) leHold.classList.remove("hidden");
            var syncPl = {
              user_nombre: "Vista previa en vivo",
              user_cargo: "Sincronizando con el panel…",
              user_empresa: "",
              user_bgColor: "#000000",
              user_bgPreset: "matte",
              redes: {
                linkedin: "https://www.linkedin.com/",
                whatsappNumero: "5490000000000",
              },
            };
            try {
              var nSync = window.normalizePersonalCard
                ? window.normalizePersonalCard(syncPl)
                : syncPl;
              applyElitePreviewOverrides(nSync);
              renderElite(nSync);
            } catch (eSync) {}
            return;
          }
          showLoading(false);
          showNotFound();
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

    if (mascot && uid) {
      tryLoadMascotaPublicFirst(uid, db, function (ok, data, publicId, ownerUid) {
        if (ok && data && publicId) {
          finishMascotBookDirect(data, publicId, ownerUid);
          return;
        }
        loadFromSiloAndAccount();
      });
    } else {
      loadFromSiloAndAccount();
    }
  }

  var __ecPreviewTabFadeTimer = null;
  function getAdminPreviewTransitionRoot() {
    if (!isEcAdminPreview()) return null;
    if (isMascotView()) {
      var lm = document.getElementById("layout-mascot");
      if (!lm || lm.classList.contains("hidden")) return null;
      return document.getElementById("mascot-shell") || lm;
    }
    var le = document.getElementById("layout-elite");
    if (!le || le.classList.contains("hidden")) return null;
    return le;
  }

  function runPreviewDashboardTabTransition() {
    var root = getAdminPreviewTransitionRoot();
    if (!root) return;
    if (__ecPreviewTabFadeTimer) {
      clearTimeout(__ecPreviewTabFadeTimer);
      __ecPreviewTabFadeTimer = null;
    }
    root.classList.add("ec-preview-tab-fade-out");
    var fadeMs = 280;
    __ecPreviewTabFadeTimer = setTimeout(function () {
      __ecPreviewTabFadeTimer = null;
      root.classList.remove("ec-preview-tab-fade-out");
    }, fadeMs);
  }

  window.addEventListener("message", function (ev) {
    if (String(qs("ec_admin_preview") || "") !== "1") return;
    try {
      var origin = window.location.origin || "";
      if (origin && ev.origin !== origin) return;
    } catch (eOrig) {}
    var data = ev.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "EC_ADMIN_PREVIEW_UI") {
      if (data.action === "dashboardTabChange") {
        runPreviewDashboardTabTransition();
      }
      return;
    }

    if (data.type === "EC_ELITE_PREVIEW" && !isMascotView()) {
      var ep = data.payload;
      if (!ep || typeof ep !== "object") return;
      __ecElitePreviewLocked = true;
      showLoading(false);
      var lmEl = document.getElementById("layout-mascot");
      if (lmEl) lmEl.classList.add("hidden");
      var emptyEl = document.getElementById("card-empty");
      if (emptyEl) emptyEl.classList.add("hidden");
      var nfEl = document.getElementById("card-not-found");
      if (nfEl) nfEl.classList.add("hidden");
      var layEliteMsg = document.getElementById("layout-elite");
      if (layEliteMsg) layEliteMsg.classList.remove("hidden");
      var npEl = window.normalizePersonalCard ? window.normalizePersonalCard(ep) : ep;
      applyElitePreviewOverrides(npEl);
      try {
        renderElite(npEl);
      } catch (eElPm) {
        console.error("[EliteCard] postMessage preview:", eElPm);
      }
      return;
    }

    if (data.type !== "EC_MASCOTBOOK_PREVIEW") return;
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
