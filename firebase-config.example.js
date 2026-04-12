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

/** Sin ?user=, tarjeta pública usa este UID (admin principal). Vacío → documento "perfil". */
window.FIRESTORE_DEFAULT_CARD_UID = "";
