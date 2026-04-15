/**
 * Tarjeta pública — un solo silo Firestore (personal_card o mascot_card) + fallback legacy usuarios/{uid}.
 */
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
    var tx = qs("ec_mt").toLowerCase();
    if (tx === "park" || tx === "candy" || tx === "elite") m.textureId = tx;
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
  }

  function mascotTextureClass(m) {
    var t = String((m && m.textureId) || "").toLowerCase();
    if (t === "park" || t === "candy" || t === "elite") return "texture-" + t;
    var tid = String((m && m.themeId) || "classic").toLowerCase();
    if (tid === "candy") return "texture-candy";
    if (tid === "organic" || tid === "glass") return "texture-park";
    return "texture-elite";
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
    };
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
    var root = document.getElementById("layout-mascot");
    var shell = document.getElementById("mascot-shell");
    var empty = document.getElementById("card-empty");
    if (empty) empty.classList.add("hidden");
    if (!root || !shell) return;
    root.classList.remove("hidden");
    applyMascotPreviewOverrides(m);
    var nm = window.normalizeMascotCard ? window.normalizeMascotCard(m) : m;
    var texClass = mascotTextureClass(nm);
    var surf = String(nm.mascotSurfaceTheme || "cloud_cream")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    if (!window.MASCOT_SURFACE_THEME_IDS || window.MASCOT_SURFACE_THEME_IDS.indexOf(surf) < 0) {
      surf = "cloud_cream";
    }
    shell.className = "mb-social " + texClass + " mb-surface--" + surf;
    var pro = String(nm.mascotProTheme || "classic_paws").trim();
    if (!window.MASCOT_PRO_THEME_IDS || window.MASCOT_PRO_THEME_IDS.indexOf(pro) < 0) {
      pro = "classic_paws";
    }
    shell.setAttribute("data-mb-pro", pro);
    shell.classList.toggle("ec-mascot-preview", qs("ec_admin_preview") === "1");
    var accent = String(nm.accentColor || "#ec4899").trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) accent = "#ec4899";
    shell.style.setProperty("--mb-accent", accent);

    var hero = document.getElementById("mascot-hero");
    var heroImg = document.getElementById("mascot-hero-img");
    if (hero && heroImg) {
      if (nm.fotoCabeceraUrl) {
        heroImg.src = nm.fotoCabeceraUrl;
        heroImg.classList.remove("hidden");
        hero.classList.add("mb-hero--has-img");
      } else {
        heroImg.removeAttribute("src");
        heroImg.classList.add("hidden");
        hero.classList.remove("mb-hero--has-img");
      }
    }

    var fc = nm.fichaCritica || {};
    var vet = nm.veterinario || {};
    var vacs = Array.isArray(nm.vacunas) ? nm.vacunas : [];
    var lostOn = !!nm.mascotaPerdida;
    var has =
      nm.nombre ||
      nm.fotoPerfilUrl ||
      (nm.galeria && nm.galeria.length) ||
      nm.muro ||
      nm.historia ||
      nm.salud ||
      nm.personalidad ||
      vacs.length ||
      vet.nombre ||
      vet.telefono ||
      vet.direccion ||
      fc.alergias ||
      fc.medicacionDiaria ||
      fc.tipoSangre ||
      fc.cuidadosEspeciales ||
      nm.fotoCabeceraUrl;
    if (!has && !lostOn) {
      root.classList.add("hidden");
      if (empty) empty.classList.remove("hidden");
      hideMascotLostUi();
      return;
    }

    var img = document.getElementById("mascot-avatar");
    if (img) {
      if (nm.fotoPerfilUrl) {
        img.src = nm.fotoPerfilUrl;
        img.classList.remove("hidden");
      } else img.classList.add("hidden");
    }
    document.getElementById("mascot-name").textContent = nm.nombre || "Mascota";
    document.getElementById("mascot-sub").textContent = [nm.raza, nm.sexo].filter(Boolean).join(" · ");

    var bioParts = [nm.muro, nm.historia, nm.personalidad].map(function (x) {
      return String(x || "").trim();
    });
    var bioText = bioParts.filter(Boolean).join("\n\n");
    var bioEl = document.getElementById("mascot-bio");
    if (bioEl) {
      bioEl.textContent = bioText;
      bioEl.classList.toggle("hidden", !bioText);
    }

    var pills = document.getElementById("mascot-pills");
    pills.innerHTML = "";
    if (nm.raza) {
      var s = document.createElement("span");
      s.className = "mb-ig-pill";
      s.textContent = nm.raza;
      pills.appendChild(s);
    }
    if (nm.sexo) {
      var s2 = document.createElement("span");
      s2.className = "mb-ig-pill";
      s2.textContent = nm.sexo;
      pills.appendChild(s2);
    }
    pills.classList.toggle("hidden", !pills.children.length);

    var nPosts = (nm.galeria && nm.galeria.length) || 0;
    var postsEl = document.getElementById("mascot-stat-posts");
    if (postsEl) postsEl.textContent = String(nPosts);

    var gal = document.getElementById("mascot-gallery");
    gal.innerHTML = "";
    (nm.galeria || []).forEach(function (url) {
      var im = document.createElement("img");
      im.src = url;
      im.alt = "";
      im.loading = "lazy";
      gal.appendChild(im);
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

    setupMascotLostMode(nm);
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
      panic.removeAttribute("href");
      panic.setAttribute("aria-disabled", "true");
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
    var petName = String((nm && nm.nombre) || "Mascota").trim() || "Mascota";
    var pre =
      "Hola, encontré a tu mascota " +
      petName +
      " escaneando su MascotBook. ¿Dónde nos encontramos?";
    if (digits.length >= 8) {
      panic.classList.remove("hidden");
      panic.setAttribute(
        "href",
        "https://wa.me/" + digits + "?text=" + encodeURIComponent(pre)
      );
      panic.removeAttribute("aria-disabled");
    } else {
      panic.classList.add("hidden");
      panic.removeAttribute("href");
      panic.setAttribute("aria-disabled", "true");
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

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showLoading(on) {
    var el = document.getElementById("card-loading");
    if (el) el.classList.toggle("hidden", !on);
  }

  function showNotFound() {
    showLoading(false);
    var nf = document.getElementById("card-not-found");
    if (nf) nf.classList.remove("hidden");
  }

  function start() {
    var uid = resolveUid();
    if (!uid) {
      window.location.replace("index.html");
      return;
    }
    window.__EC_CARD_UID = uid;

    var cfg = window.FIREBASE_WEB_CONFIG;
    if (!cfg || !cfg.apiKey || String(cfg.apiKey).indexOf("REEMPLAZAR") !== -1) {
      showNotFound();
      return;
    }

    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
    } catch (e) {}

    var db = firebase.firestore();
    var mascot = isMascotView();
    var siloRef = mascot
      ? window.EC_SILO.mascotCardRef(db, uid)
      : window.EC_SILO.personalCardRef(db, uid);
    var rootRef = window.EC_SILO.accountRef(db, uid);

    showLoading(true);

    function finishMascotOrElite(siloSnap, accountRaw) {
      showLoading(false);
      document.getElementById("layout-elite").classList.add("hidden");
      document.getElementById("layout-mascot").classList.add("hidden");
      hideMascotLostUi();
      if (mascot) {
        if (siloSnap.exists) {
          var data = siloSnap.data() || {};
          var nm = window.normalizeMascotCard ? window.normalizeMascotCard(data) : data;
          renderMascot(nm);
        } else {
          showNotFound();
        }
        return;
      }
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

    Promise.all([siloRef.get(), rootRef.get()])
      .then(function (pair) {
        var siloSnap = pair[0];
        var acctSnap = pair[1];
        var accountRaw = acctSnap.exists ? acctSnap.data() || {} : {};
        if (mascot) {
          if (siloSnap.exists) {
            finishMascotOrElite(siloSnap, accountRaw);
            return;
          }
          if (!acctSnap.exists) {
            showLoading(false);
            showNotFound();
            return;
          }
          showLoading(false);
          document.getElementById("layout-elite").classList.add("hidden");
          document.getElementById("layout-mascot").classList.add("hidden");
          hideMascotLostUi();
          var rawM = acctSnap.data() || {};
          renderMascot(window.normalizeMascotCard(mapLegacyMascot(rawM)));
          return;
        }
        if (siloSnap.exists) {
          finishMascotOrElite(siloSnap, accountRaw);
          return;
        }
        if (!acctSnap.exists) {
          showLoading(false);
          showNotFound();
          return;
        }
        var rawAll = acctSnap.data() || {};
        finishMascotOrElite(siloSnap, rawAll);
      })
      .catch(function () {
        showNotFound();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else start();
})();
