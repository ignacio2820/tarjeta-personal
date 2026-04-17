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

/** Sin ?user=, tarjeta pública usa este UID (admin principal). Vacío → documento "perfil". */
window.FIRESTORE_DEFAULT_CARD_UID = "";

window.EC_PREMIUM_UPGRADE_URL = "";
window.EC_PREMIUM_CONTACT_MESSAGE =
  "Contactá a tu agencia para activar Premium: indicá email, WhatsApp o link de pago aquí.";
