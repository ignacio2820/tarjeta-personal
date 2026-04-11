/**
 * Tarjeta digital — edita el objeto `config` y guarda.
 * Los campos se normalizan a window.CARD_CONFIG (usa index.html).
 */
(function () {
  function digits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function igUrl(v) {
    if (v == null || !String(v).trim()) return "";
    var s = String(v).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return (
      "https://www.instagram.com/" + s.replace(/^@/, "").replace(/\/+$/, "") + "/"
    );
  }

  function liUrl(v) {
    if (v == null || !String(v).trim()) return "";
    var s = String(v).trim();
    if (/^https?:\/\//i.test(s)) return s;
    return (
      "https://www.linkedin.com/in/" + s.replace(/^\/+|\/+$/g, "") + "/"
    );
  }

  // --- DATOS PERSONALES (EDITA AQUÍ) ---
  const config = {
    nombreCompleto: "Subprefecto Lic. Schwindt Pedro Ignacio",
    /** vCard: apellido y nombres (para agenda; el nombre en pantalla es nombreCompleto) */
    vcardApellidos: "Schwindt",
    vcardNombres: "Pedro Ignacio",
    cargo: "Director U.P. N° 7 Gualeguay",
    empresa: "S.P.E.R.",

    /** Opcional: nombre largo para vCard / metadatos (si vacío, se usa empresa) */
    organizacion: "Servicio Penitenciario Entre Ríos",

    telefono: "+549344653659",
    /** WhatsApp destino del formulario (solo dígitos, con código país, sin +) */
    whatsapp: "5493444438273",

    email: "ignacio2820@gmail.com",
    emailInstitucional: "Secretariaup7@sper.gob.ar",

    /** Botón Instagram → perfil oficial (incluye ?igsh=…) */
    instagram: "https://www.instagram.com/serviciopenitenciario.er?igsh=bHlpOTJzam4xZnBv",
    /** Slug del perfil o URL completa */
    linkedin: "ignacio-schwindt-82138517b",

    /**
     * Solo botón «Dirección / mapa» (coordenadas). No mezclar con sitioWeb.
     */
    direccion:
      "https://www.google.com/maps/search/?api=1&query=-33.1468333,-59.3057778",

    fotoPerfil: "perfil.jpg",
    logo: "logo-sper.jpg",

    /** Solo botón web (portal). Las coordenadas van en `direccion`. */
    sitioWeb: "https://portal.entrerios.gov.ar/seguridadyjusticia/penitenciario/pf/establecimiento/2527",
    direccionTexto: "33°08'48.6\"S 59°18'20.8\"W",

    bio: "",

    tituloPagina: "Subprefecto Lic. Schwindt Pedro Ignacio — Tarjeta digital",
    metaDescription: "Contacto — S.P.E.R.",
  };

  var maps = String(config.mapsUrl || config.direccion || "").trim();

  window.CARD_CONFIG = Object.assign({}, config, {
    whatsappNumero: digits(config.whatsappNumero || config.whatsapp),
    instagram: igUrl(config.instagram),
    sitioWeb: String(config.sitioWeb || "").trim(),
    linkedin: liUrl(config.linkedin),
    mapsUrl: maps,
    organizacion:
      config.organizacion != null && String(config.organizacion).trim() !== ""
        ? String(config.organizacion).trim()
        : String(config.empresa || "").trim(),
  });

  /** Alias por si en otro script leés `config` */
  window.config = window.CARD_CONFIG;
})();
