/**
 * Rutas y constantes silo EliteCard / MascotBook (Firestore subcolecciones).
 */
(function (global) {
  "use strict";

  var USERS = "usuarios";
  var DOC_PROFILE = "profile";

  function usersCollection() {
    return (global.FIRESTORE_USERS_COLLECTION || USERS).trim() || USERS;
  }

  function personalCardRef(db, uid) {
    return db.collection(usersCollection()).doc(uid).collection("personal_card").doc(DOC_PROFILE);
  }

  function mascotCardRef(db, uid) {
    return db.collection(usersCollection()).doc(uid).collection("mascot_card").doc(DOC_PROFILE);
  }

  function accountRef(db, uid) {
    return db.collection(usersCollection()).doc(uid);
  }

  global.EC_SILO = {
    DOC_PROFILE: DOC_PROFILE,
    usersCollection: usersCollection,
    personalCardRef: personalCardRef,
    mascotCardRef: mascotCardRef,
    accountRef: accountRef,
  };
})(typeof window !== "undefined" ? window : this);
