/**
 * Copiá este archivo como firebase-config.js y pegá los datos de:
 * Firebase Console → Configuración del proyecto → Tus apps → Web
 */
window.FIREBASE_WEB_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxx",
};

window.FIRESTORE_USERS_COLLECTION = "usuarios";
window.FIRESTORE_MEMBERSHIP_COLLECTION = "users";
window.FIRESTORE_ELITE_MEMBERSHIP_COLLECTION = "users_elite";

/** Misma región que en `firebase.json` / despliegue de Cloud Functions (p. ej. us-east1). */
window.FIREBASE_FUNCTIONS_REGION = "us-east1";

/**
 * URL absoluta sin query para las back_urls de Mercado Pago (éxito / pendiente / fallo).
 * Ej.: https://tu-dominio.app/admin o …/admin.html. Vacío → usa origen + pathname actual.
 */
window.EC_MERCADOPAGO_RETURN_BASE = "";

/**
 * Backend (solo en Firebase, nunca en el cliente):
 * - Secret: firebase functions:secrets:set MP_ACCESS_TOKEN
 * - Webhook en Mercado Pago → URL HTTPS de `webhookMercadoPago` (misma región que arriba).
 * - Opcional: MP_UNIT_PRICE_MASCOTBOOK, MP_UNIT_PRICE_ELITECARD, FIRESTORE_MEMBERSHIP_COLLECTION
 */

/** Sin ?user=, tarjeta pública usa este UID (admin principal). Vacío → documento "perfil". */
window.FIRESTORE_DEFAULT_CARD_UID = "";

window.EC_PREMIUM_UPGRADE_URL = "";
window.EC_PREMIUM_CONTACT_MESSAGE =
  "Contactá a tu agencia para activar Premium: indicá email, WhatsApp o link de pago aquí.";

/**
 * Links de pago por producto (p. ej. checkout Mercado Pago).
 * Se cargan antes de config.js: allí se fusionan con los valores por defecto.
 */
window.PRECIOS_LINKS = {
  elitecard: "",
  mascotbook: "",
};

/** Precios mostrados en el panel (solo texto UI). */
window.PRECIOS_VENTA = {
  elitecard: "$ 19.999",
  mascotbook: "$ 24.999",
};
