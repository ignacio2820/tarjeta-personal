/**
 * Configuración de la app web (Console → ⚙️ → Tu app web).
 * Nombre en consola: EliteCard · ID técnico del proyecto: tarjeta-profesional-pedro
 * (el ID no cambia al renombrar el proyecto; solo cambia si migrás a otro proyecto).
 * La API key es pública; la seguridad la dan Firestore Rules + Auth.
 */
window.FIREBASE_WEB_CONFIG = {
  apiKey: "AIzaSyBPV_D06N0V08nsS-nPVbKNWS0lhzl3fWY",
  authDomain: "tarjeta-profesional-pedro.firebaseapp.com",
  projectId: "tarjeta-profesional-pedro",
  storageBucket: "tarjeta-profesional-pedro.firebasestorage.app",
  messagingSenderId: "318467309965",
  appId: "1:318467309965:web:2e36f6a0ebeb94645afdc4",
};

/** Colección donde cada documento es un perfil (ID = uid de Auth). */
window.FIRESTORE_USERS_COLLECTION = "usuarios";

/** Membresía, rol y premium (ID = uid). Reglas: listado solo admin. */
window.FIRESTORE_MEMBERSHIP_COLLECTION = "users";
window.FIRESTORE_ELITE_MEMBERSHIP_COLLECTION = "users_elite";

/**
 * Sin ?user= en la URL, la tarjeta carga este documento (UID del admin principal).
 * Dejalo vacío ("") para usar el documento legacy "perfil" hasta migrar datos al uid real.
 */
window.FIRESTORE_DEFAULT_CARD_UID = "";

/** Links Mercado Pago (u otra pasarela) por producto; se fusionan en config.js. */
window.PRECIOS_LINKS = {
  elitecard: "",
  mascotbook: "",
};

window.PRECIOS_VENTA = {
  elitecard: "$ 19.999",
  mascotbook: "$ 24.999",
};

/** Si tiene URL (https://…), "Pasar a Premium" abre esa página; si está vacío, se muestra el modal de contacto. */
window.EC_PREMIUM_UPGRADE_URL = "";

/** Texto mostrado en el modal de contacto cuando no hay URL de pago (HTML permitido mínimo: <br>). */
window.EC_PREMIUM_CONTACT_MESSAGE =
  "Para activar <strong>MascotBook Pro</strong> sin límite de tiempo, contactá a <strong>Agencia WebElite</strong> y te pasamos medios de pago y valores actualizados.";
