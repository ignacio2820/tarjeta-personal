/**
 * Valores por defecto — silos Firestore: personal_card/profile y mascot_card/profile.
 * DEFAULT_TARJETA_RAW se mantiene por compatibilidad con código legacy no usado en card/admin nuevos.
 */
(function () {
  "use strict";

  /**
   * Acceso perpetuo (suscripción/trial en admin.js). Siempre incluye el correo del dueño;
   * se fusiona con lo definido antes en firebase-config.js (sin pisarlo).
   */
  window.EC_AGENCY_OWNER_EMAILS = (function () {
    var preset = ["ignacio2820@gmail.com"];
    var prev = window.EC_AGENCY_OWNER_EMAILS;
    var list = Array.isArray(prev) ? prev.slice() : [];
    function norm(s) {
      return String(s || "")
        .trim()
        .toLowerCase();
    }
    for (var i = 0; i < preset.length; i++) {
      var p = norm(preset[i]);
      if (!p) continue;
      var dupe = false;
      for (var j = 0; j < list.length; j++) {
        if (norm(list[j]) === p) {
          dupe = true;
          break;
        }
      }
      if (!dupe) list.push(preset[i]);
    }
    return list;
  })();

  /** UIDs con acceso perpetuo (opcional). */
  window.EC_PERPETUAL_UIDS = [];

  /** Logo del dashboard; vacío = marca SVG inline en admin. */
  window.EC_BRAND_LOGO_URL = "";

  /**
   * Links de cobro (Mercado Pago u otra pasarela). Pegá URLs https:// completas.
   * Podés definir valores iniciales en firebase-config.js antes de cargar este script;
   * aquí se fusionan con los vacíos por defecto.
   */
  window.PRECIOS_LINKS = Object.assign(
    {
      elitecard: "",
      mascotbook: "",
      mascotbook_medalla_envio: "",
      mascotbook_medalla_retiro: "",
    },
    window.PRECIOS_LINKS && typeof window.PRECIOS_LINKS === "object" ? window.PRECIOS_LINKS : {}
  );

  /**
   * Precios de referencia (solo UI). Fusiona con firebase-config.js si definís PRECIOS_VENTA allí.
   * elitecard = WebElite / EliteCard; mascotbook = MascotBook.
   */
  window.PRECIOS_VENTA = Object.assign(
    { elitecard: "$ 19.999", mascotbook: "$ 24.999" },
    window.PRECIOS_VENTA && typeof window.PRECIOS_VENTA === "object" ? window.PRECIOS_VENTA : {}
  );

  /** Región de Cloud Functions (misma que en `firebase.json` / despliegue). */
  window.FIREBASE_FUNCTIONS_REGION = window.FIREBASE_FUNCTIONS_REGION || "us-east1";

  /**
   * URL base para back_urls de Mercado Pago (sin ?). Por defecto: origen + ruta actual (p. ej. …/admin.html).
   * Definila si usás dominio distinto al de Firebase Hosting.
   */
  window.EC_MERCADOPAGO_RETURN_BASE = window.EC_MERCADOPAGO_RETURN_BASE || "";

  /** false por defecto: checkout Mercado Pago vía Cloud Function; true = solo modal EC_PREMIUM_CONTACT_MESSAGE. */
  if (typeof window.EC_PREMIUM_MANUAL_CONTACT_ONLY !== "boolean") {
    window.EC_PREMIUM_MANUAL_CONTACT_ONLY = false;
  }

  function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function igUrl(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    var u = s.replace(/^@/, "");
    return "https://instagram.com/" + u;
  }

  function liUrl(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return "https://linkedin.com/in/" + s.replace(/^\/+/, "");
  }

  /** EliteCard — documento usuarios/{uid}/personal_card/profile */
  window.DEFAULT_PERSONAL_CARD = {
    user_nombre: "",
    user_cargo: "",
    user_empresa: "",
    user_bio: "",
    redes: {
      instagram: "",
      linkedin: "",
      sitioWeb: "",
      whatsappNumero: "",
    },
    email: "",
    telefono: "",
    whatsappNumero: "",
    fotoUrl: "",
    logoUrl: "",
    vcardNombres: "",
    vcardApellidos: "",
    vcardOrganizacion: "",
    vcardTitulo: "",
    bio: "",
    sitioWeb: "",
    instagram: "",
    linkedin: "",
    mapsUrl: "",
    calendlyUrl: "",
    emailInstitucional: "",
    user_avatarShape: "rect",
    user_buttonLayout: "list",
    user_bgColor: "#000000",
    user_bgPreset: "matte",
    bannerUrl: "",
  };

  /** MascotBook — documento usuarios/{uid}/mascot_card/profile */
  window.DEFAULT_MASCOT_CARD = {
    mascotId: "",
    nombre: "",
    raza: "",
    sexo: "",
    salud: "",
    historia: "",
    personalidad: "",
    themeId: "classic",
    textureId: "elite",
    accentColor: "#ec4899",
    /** Derivado del tema en normalizeMascotCard (Classic Paws por defecto). */
    textColor: "#1c1917",
    fotoPerfilUrl: "",
    fotoCabeceraUrl: "",
    galeria: [],
    muro: "",
    mascotProTheme: "classic_paws",
    /** Fondos con patrones (huellas, naturaleza, nubes). */
    mascotSurfaceTheme: "cloud_cream",
    vacunas: [],
    dueno: { nombre: "", direccion: "", telefono: "", email: "" },
    veterinario: { nombre: "", telefono: "", direccion: "" },
    fichaCritica: { alergias: "", medicacionDiaria: "", tipoSangre: "", cuidadosEspeciales: "" },
    visitas: 0,
    likes: 0,
    mascotaPerdida: false,
    /** Si está activa, la tarjeta pública puede solicitar GPS al abrir (QR). */
    alertaExtravioActiva: false,
    whatsappUrgencia: "",
  };

  /** Temas visuales MascotBook Pro (panel + tarjeta pública). */
  window.MASCOT_PRO_THEME_IDS = ["classic_paws", "candy_pop", "night_neon", "organic_leaf"];

  /** Superficies decorativas MascotBook (pastel + patrón). */
  window.MASCOT_SURFACE_THEME_IDS = ["paw_blue", "paw_pink", "nature_mint", "cloud_cream"];

  /** Color de texto legible por tema Pro (no editable en panel; evita conflicto con acento). */
  window.MB_THEME_TEXT_BY_PRO = {
    classic_paws: "#1c1917",
    candy_pop: "#312e81",
    night_neon: "#ecfeff",
    organic_leaf: "#14532d",
  };

  var THEME_IDS = ["classic", "candy", "night", "organic", "glass"];
  var TEXTURE_IDS = ["park", "candy", "elite"];

  function themeIdFromTexture(tex) {
    var t = String(tex || "elite").toLowerCase();
    if (t === "candy") return "candy";
    if (t === "park") return "organic";
    return "classic";
  }

  function mascotProThemeFromLegacy(d) {
    var p = String(d.mascotProTheme || "").trim().toLowerCase();
    if (window.MASCOT_PRO_THEME_IDS.indexOf(p) >= 0) return p;
    var t = String(d.tema || "").trim().toLowerCase();
    if (window.MASCOT_PRO_THEME_IDS.indexOf(t) >= 0) return t;
    var tex = String((d && d.textureId) || "").toLowerCase();
    if (tex === "candy") return "candy_pop";
    if (tex === "park") return "organic_leaf";
    var tid = String((d && d.themeId) || "").toLowerCase();
    if (tid === "night") return "night_neon";
    if (tid === "candy") return "candy_pop";
    if (tid === "organic" || tid === "glass") return "organic_leaf";
    return "classic_paws";
  }

  function textureFromMascotProTheme(pro) {
    if (pro === "candy_pop") return "candy";
    if (pro === "organic_leaf") return "park";
    return "elite";
  }

  function themeIdFromMascotPro(pro) {
    if (pro === "night_neon") return "night";
    if (pro === "candy_pop") return "candy";
    if (pro === "organic_leaf") return "organic";
    return "classic";
  }

  function normalizeVacunaRow(o) {
    var x = o && typeof o === "object" ? o : {};
    return {
      vacuna: String(x.vacuna || "").trim(),
      fecha: String(x.fecha || "").trim(),
      proximaDosis: String(x.proximaDosis || x.proxima || "").trim(),
    };
  }

  window.mascotThemeIdToClass = function (id) {
    var k = String(id || "classic").trim().toLowerCase();
    if (THEME_IDS.indexOf(k) < 0) k = "classic";
    return "theme-" + k;
  };

  /**
   * Plantilla legacy (documento plano usuarios/{uid}); no usar en silos nuevos.
   */
  window.DEFAULT_TARJETA_RAW = {
    nombreCompleto: "",
    cargo: "",
    cargoDetalle: "",
    empresa: "",
    telefono: "",
    whatsappNumero: "",
    email: "",
    emailInstitucional: "",
    instagram: "",
    linkedin: "",
    sitioWeb: "",
    mapsUrl: "",
    fotoUrl: "",
    logoUrl: "",
    photoURL: "",
    vcardNombres: "",
    vcardApellidos: "",
    vcardOrganizacion: "",
    vcardTitulo: "",
    calendlyUrl: "",
    mensajeCitaWhatsapp: "Hola, me gustaría agendar una reunión con usted.",
    cardTheme: "gold",
    avatarShape: "rect",
    buttonLayout: "pills",
    leadCaptureEnabled: false,
    bio: "",
    mascotaNombre: "",
    mascotaCargo: "",
    mascotaBio: "",
    mascotaTelefono: "",
    mascotaWhatsapp: "",
    mascotaInstagram: "",
    mascotaFotoUrl: "",
    mascotaPerdida: false,
    mascotaGenero: "macho",
    mascotaTemaVisual: "theme-classic",
    mascotaColorAcento: "#5f6fff",
    mascotaEfectoRelieve: false,
    mascotaGustos: "",
    mascotaQueCome: "",
    mascotaCaracter: "",
    mascotaFamilia: "",
    mascotaUltimaAventura: "",
    mascotaVacunas: [],
    mascotaHistorialClinico: "",
    mascotaAlertasSalud: "",
    mascotaSaludPublica: false,
    paseVeterinarioActivo: false,
    mascotaEstudiosSaludUrls: [],
    mascotaGaleriaUrls: [],
  };

  window.normalizeTarjetaData = function (patch) {
    var o = Object.assign({}, window.DEFAULT_TARJETA_RAW, patch || {});
    var w = onlyDigits(o.whatsappNumero);
    var foto =
      String(o.photoURL || "").trim() ||
      String(o.fotoUrl || "").trim() ||
      String(o.fotoPerfil || "").trim();
    var logo = String(o.logoUrl || "").trim() || String(o.logo || "").trim();
    var theme = String(o.cardTheme || o.selectedTheme || "gold").trim().toLowerCase();
    if (["gold", "minimal", "electric"].indexOf(theme) < 0) theme = "gold";
    var avatarShape = String(o.avatarShape || "rect").trim().toLowerCase();
    if (avatarShape !== "circle") avatarShape = "rect";
    var buttonLayout = String(o.buttonLayout || o.buttonStyle || "pills").trim().toLowerCase();
    if (buttonLayout !== "icons") buttonLayout = "pills";
    var leadCaptureEnabled = !!o.leadCaptureEnabled;
    return {
      nombreCompleto: String(o.nombreCompleto || "").trim(),
      cargo: String(o.cargo || "").trim(),
      bio: String(o.bio || "").trim(),
      cargoDetalle: String(o.cargoDetalle || o.director_up7 || "").trim(),
      empresa: String(o.empresa || "").trim(),
      telefono: String(o.telefono || "").trim(),
      whatsappNumero: w,
      email: String(o.email || "").trim(),
      emailInstitucional: String(o.emailInstitucional || "").trim(),
      instagram: igUrl(o.instagram),
      linkedin: liUrl(o.linkedin),
      sitioWeb: String(o.sitioWeb || "").trim(),
      mapsUrl: String(o.mapsUrl || "").trim(),
      fotoUrl: foto,
      photoURL: String(o.photoURL || "").trim(),
      logoUrl: logo,
      vcardNombres: String(o.vcardNombres || "").trim(),
      vcardApellidos: String(o.vcardApellidos || "").trim(),
      vcardOrganizacion: String(o.vcardOrganizacion || o.empresa || "").trim(),
      vcardTitulo: String(o.vcardTitulo || o.cargo || "").trim(),
      calendlyUrl: String(o.calendlyUrl || "").trim(),
      mensajeCitaWhatsapp: String(
        o.mensajeCitaWhatsapp || window.DEFAULT_TARJETA_RAW.mensajeCitaWhatsapp || ""
      ).trim(),
      cardTheme: theme,
      avatarShape: avatarShape,
      buttonLayout: buttonLayout,
      leadCaptureEnabled: leadCaptureEnabled,
    };
  };

  window.normalizePersonalCard = function (patch) {
    var d = Object.assign({}, window.DEFAULT_PERSONAL_CARD, patch || {});
    var redes = d.redes && typeof d.redes === "object" ? d.redes : {};
    var avatarShape = String(d.user_avatarShape || d.avatarShape || "rect").trim().toLowerCase();
    if (avatarShape !== "round" && avatarShape !== "rect" && avatarShape !== "circle") avatarShape = "rect";
    if (avatarShape === "circle") avatarShape = "round";
    var buttonLayout = String(d.user_buttonLayout || d.buttonLayout || "list").trim().toLowerCase();
    if (buttonLayout !== "grid" && buttonLayout !== "list" && buttonLayout !== "icons") buttonLayout = "list";
    if (buttonLayout === "icons") buttonLayout = "grid";
    var bg = String(d.user_bgColor || "#000000").trim();
    if (!/^#[0-9a-f]{6}$/i.test(bg) && !/^#[0-9a-f]{3}$/i.test(bg)) bg = "#000000";
    var preset = String(d.user_bgPreset || "").trim().toLowerCase();
    if (["matte", "white", "blue", "custom"].indexOf(preset) < 0) {
      preset = "matte";
      if (bg.toLowerCase() === "#ffffff" || bg.toLowerCase() === "#fff") preset = "white";
      else if (bg.toLowerCase() === "#0f1728" || bg.toLowerCase() === "#0f172a" || bg.toLowerCase() === "#1e3a5f") {
        preset = "blue";
      }
    }
    return {
      user_nombre: String(d.user_nombre || d.nombreCompleto || "").trim(),
      user_cargo: String(d.user_cargo || d.cargo || "").trim(),
      user_empresa: String(d.user_empresa || d.empresa || "").trim(),
      user_bio: String(d.user_bio || d.bio || "").trim(),
      nombreCompleto: String(d.user_nombre || d.nombreCompleto || "").trim(),
      cargo: String(d.user_cargo || d.cargo || "").trim(),
      empresa: String(d.user_empresa || d.empresa || "").trim(),
      redes: {
        instagram: igUrl(redes.instagram != null ? redes.instagram : d.instagram),
        linkedin: liUrl(redes.linkedin != null ? redes.linkedin : d.linkedin),
        sitioWeb: String(redes.sitioWeb != null ? redes.sitioWeb : d.sitioWeb || "").trim(),
        whatsappNumero: onlyDigits(redes.whatsappNumero != null ? redes.whatsappNumero : d.whatsappNumero),
      },
      email: String(d.email || "").trim(),
      telefono: String(d.telefono || "").trim(),
      whatsappNumero: onlyDigits(d.whatsappNumero),
      fotoUrl: String(d.fotoUrl || "").trim(),
      logoUrl: String(d.logoUrl || "").trim(),
      vcardNombres: String(d.vcardNombres || "").trim(),
      vcardApellidos: String(d.vcardApellidos || "").trim(),
      vcardOrganizacion: String(d.vcardOrganizacion || d.user_empresa || d.empresa || "").trim(),
      vcardTitulo: String(d.vcardTitulo || d.user_cargo || d.cargo || "").trim(),
      bio: String(d.user_bio || d.bio || "").trim(),
      sitioWeb: String(d.sitioWeb || "").trim(),
      instagram: igUrl(d.instagram),
      linkedin: liUrl(d.linkedin),
      mapsUrl: String(d.mapsUrl || "").trim(),
      calendlyUrl: String(d.calendlyUrl || "").trim(),
      emailInstitucional: String(d.emailInstitucional || "").trim(),
      user_avatarShape: avatarShape,
      user_buttonLayout: buttonLayout,
      user_bgColor: bg,
      user_bgPreset: preset,
      bannerUrl: String(d.bannerUrl || d.banner_url || "").trim(),
    };
  };

  window.normalizeMascotCard = function (patch) {
    var d = Object.assign({}, window.DEFAULT_MASCOT_CARD, patch || {});
    var pro = String(d.mascotProTheme || d.tema || "").trim().toLowerCase().replace(/-/g, "_");
    var proIds = window.MASCOT_PRO_THEME_IDS;
    if (!proIds || proIds.indexOf(pro) < 0) pro = mascotProThemeFromLegacy(d);
    var tex = textureFromMascotProTheme(pro);
    var tid = themeIdFromMascotPro(pro);
    var accent = String(d.accentColor || "").trim();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) accent = "#ec4899";
    var themeTextMap = window.MB_THEME_TEXT_BY_PRO || {};
    var textColor = themeTextMap[pro] || "#1c1917";
    var gal = d.galeria;
    if (!Array.isArray(gal)) gal = [];
    gal = gal.map(function (u) {
      return String(u || "").trim();
    }).filter(Boolean);
    var vacunas = Array.isArray(d.vacunas) ? d.vacunas : [];
    vacunas = vacunas
      .map(normalizeVacunaRow)
      .filter(function (r) {
        return r.vacuna || r.fecha || r.proximaDosis;
      })
      .slice(0, 24);
    var own = d.dueno && typeof d.dueno === "object" ? d.dueno : {};
    var vet = d.veterinario && typeof d.veterinario === "object" ? d.veterinario : {};
    var fic = d.fichaCritica && typeof d.fichaCritica === "object" ? d.fichaCritica : {};
    var waU = String(d.whatsappUrgencia || "").replace(/\D/g, "");
    if (waU.length > 18) waU = waU.slice(0, 18);
    var perdida = !!d.mascotaPerdida;
    var exAlert = d.alertaExtravioActiva;
    var alertaExtravioActiva = exAlert === true || (exAlert == null && perdida);
    var lostMode = perdida || exAlert === true;
    var visitas = Number(d.visitas);
    if (!isFinite(visitas) || visitas < 0) visitas = 0;
    visitas = Math.floor(visitas);
    var likes = Number(d.likes);
    if (!isFinite(likes) || likes < 0) likes = 0;
    likes = Math.floor(likes);
    var surf = String(d.mascotSurfaceTheme || "")
      .trim()
      .toLowerCase()
      .replace(/-/g, "_");
    var surfIds = window.MASCOT_SURFACE_THEME_IDS;
    if (!surfIds || surfIds.indexOf(surf) < 0) surf = "cloud_cream";
    var nombreVal = String(d.nombre || d.nombreMascota || d.name || "").trim();
    return {
      mascotId: String(d.mascotId || d.mascotaId || "").trim(),
      ownerUid: String(d.ownerUid || "").trim(),
      nombre: nombreVal,
      raza: String(d.raza || "").trim(),
      sexo: String(d.sexo || "").trim(),
      salud: String(d.salud || "").trim(),
      historia: String(d.historia || "").trim(),
      personalidad: String(d.personalidad || "").trim(),
      themeId: tid,
      textureId: tex,
      mascotProTheme: pro,
      tema: pro,
      accentColor: accent,
      textColor: textColor,
      fotoPerfilUrl: String(d.fotoPerfilUrl || "").trim(),
      fotoCabeceraUrl: String(d.fotoCabeceraUrl || "").trim(),
      mascotSurfaceTheme: surf,
      galeria: gal,
      muro: String(d.muro || "").trim(),
      vacunas: vacunas,
      dueno: {
        nombre: String(own.nombre || own.nombreCompleto || "").trim(),
        direccion: String(own.direccion || own.direccionCompleta || "").trim(),
        telefono: String(own.telefono || "").trim(),
        email: String(own.email || own.correo || "").trim(),
      },
      veterinario: {
        nombre: String(vet.nombre || "").trim(),
        telefono: String(vet.telefono || "").trim(),
        direccion: String(vet.direccion || "").trim(),
      },
      fichaCritica: {
        alergias: String(fic.alergias || "").trim(),
        medicacionDiaria: String(fic.medicacionDiaria || "").trim(),
        tipoSangre: String(fic.tipoSangre || "").trim(),
        cuidadosEspeciales: String(fic.cuidadosEspeciales || "").trim(),
      },
      visitas: visitas,
      likes: likes,
      mascotaPerdida: lostMode,
      alertaExtravioActiva: alertaExtravioActiva,
      whatsappUrgencia: waU,
      ownerEmail: String(d.ownerEmail || d.email || "").trim(),
    };
  };

  /** Normalización única de MascotBook (alias semántico compartido). */
  window.normalizeMascotData = function (docData) {
    return window.normalizeMascotCard(docData);
  };

  window.CARD_DEFAULTS = window.normalizeTarjetaData(window.DEFAULT_TARJETA_RAW);
})();
