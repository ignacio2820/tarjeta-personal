/**
 * Valores por defecto (Firestore los sobrescribe en vivo).
 * Campos planos para que coincidan con admin.html / Firestore.
 */
(function () {
  "use strict";

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

  /**
   * Plantilla base (vacía): la tarjeta toma los datos reales desde Firestore.
   * Sin `fotoUrl` / `photoURL` en el documento → no se usa imagen local fantasma.
   */
  window.DEFAULT_TARJETA_RAW = {
    nombreCompleto: "",
    cargo: "",
    /** Alias legacy en Firestore: director_up7 */
    cargoDetalle: "",
    empresa: "",
    telefono: "",
    whatsappNumero: "",
    email: "",
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
    /** Si tiene valor, "Agendar cita" abre modal con Calendly en lugar de WhatsApp */
    calendlyUrl: "",
    mensajeCitaWhatsapp:
      "Hola, me gustaría agendar una reunión con usted.",
  };

  /**
   * Fusiona con defaults y devuelve el objeto `cfg` que usa index.html (URLs normalizadas).
   */
  window.normalizeTarjetaData = function (patch) {
    var o = Object.assign({}, window.DEFAULT_TARJETA_RAW, patch || {});
    var w = onlyDigits(o.whatsappNumero);
    var foto =
      String(o.photoURL || "").trim() ||
      String(o.fotoUrl || "").trim() ||
      String(o.fotoPerfil || "").trim();
    var logo = String(o.logoUrl || "").trim() || String(o.logo || "").trim();
    return {
      nombreCompleto: String(o.nombreCompleto || "").trim(),
      cargo: String(o.cargo || "").trim(),
      cargoDetalle: String(o.cargoDetalle || o.director_up7 || "").trim(),
      empresa: String(o.empresa || "").trim(),
      telefono: String(o.telefono || "").trim(),
      whatsappNumero: w,
      email: String(o.email || "").trim(),
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
        o.mensajeCitaWhatsapp ||
          window.DEFAULT_TARJETA_RAW.mensajeCitaWhatsapp ||
          ""
      ).trim(),
    };
  };

  window.CARD_DEFAULTS = window.normalizeTarjetaData(window.DEFAULT_TARJETA_RAW);
})();
