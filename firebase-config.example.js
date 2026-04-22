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

/** Public Key de Mercado Pago (solo Bricks / SDK cliente). El Access Token va únicamente en Secret MP_ACCESS_TOKEN. */
window.MERCADOPAGO_PUBLIC_KEY = "";

/**
 * Backend (solo en Firebase, nunca en el cliente):
 * - Secret: firebase functions:secrets:set MP_ACCESS_TOKEN
 * - Webhook en Mercado Pago → URL HTTPS de `webhookMercadoPago` (misma región que arriba).
 * - Opcional: MP_UNIT_PRICE_MASCOTBOOK, MP_UNIT_PRICE_ELITECARD, FIRESTORE_MEMBERSHIP_COLLECTION
 * - Vigencia en Firestore tras pago (membresía legada / Elite): MP_MEMBERSHIP_YEARS (default 30 en Cloud Functions).
 * - Precios por SKU: MP_PRICE_MASCOTA_ADICIONAL, MP_PRICE_ELITECARD_ONCE, MP_PRICE_ELITECARD_MONTHLY
 * - Descuento multi-mascota (≥1 mascota con pago): MP_MASCOTA_ADICIONAL_MULTIMASCOTA_FACTOR (default 0.5 = 50% sobre unit_price)
 * - Public Key (solo si usás Bricks en el cliente): window.MERCADOPAGO_PUBLIC_KEY en firebase-config.js — nunca el Access Token.
 * - Tras pago «mascota adicional», Cloud Functions escribe `mascotbookExtraProfileCredits` en el doc de membresía (`users` o el que definas).
 * - Retorno Checkout: rewrite Hosting `/mp/feedback` → función `mercadoPagoFeedback` (success/pending/failure).
 * - Sin webhook: la preferencia usa auto_return "approved"; al volver, la URL trae payment_id y el panel llama
 *   `verifyMercadoPagoPayment` (confirma en la API de MP y escribe Firestore).
 */

/** Sin ?user=, tarjeta pública usa este UID (admin principal). Vacío → documento "perfil". */
window.FIRESTORE_DEFAULT_CARD_UID = "";

window.EC_PREMIUM_UPGRADE_URL = "";
window.EC_PREMIUM_CONTACT_MESSAGE =
  "Contactá a tu agencia para activar Premium: indicá email, WhatsApp o link de pago aquí.";

/** false u omitido: «Pasar a Premium» abre Checkout Pro (createMercadoPagoPreference). true = solo modal de contacto. */
window.EC_PREMIUM_MANUAL_CONTACT_ONLY = false;

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
