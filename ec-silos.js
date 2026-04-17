/**
 * Rutas y constantes silo EliteCard / MascotBook (Firestore subcolecciones).
 */
(function (global) {
  "use strict";

  var USERS = "usuarios";
  var MEMBERSHIP = "users";
  var DOC_PROFILE = "profile";

  function usersCollection() {
    return (global.FIRESTORE_USERS_COLLECTION || USERS).trim() || USERS;
  }

  /** Perfil de membresía / roles (Firestore). Reglas: solo dueño o admin. */
  function membershipCollection() {
    return (global.FIRESTORE_MEMBERSHIP_COLLECTION || MEMBERSHIP).trim() || MEMBERSHIP;
  }

  function membershipRef(db, uid) {
    return db.collection(membershipCollection()).doc(uid);
  }

  function personalCardRef(db, uid) {
    return db.collection(usersCollection()).doc(uid).collection("personal_card").doc(DOC_PROFILE);
  }

  function mascotCardRef(db, uid) {
    return db.collection(usersCollection()).doc(uid).collection("mascot_card").doc(DOC_PROFILE);
  }

  function mascotLostScansRef(db, uid) {
    return db.collection(usersCollection()).doc(uid).collection("mascot_lost_scans");
  }

  function accountRef(db, uid) {
    return db.collection(usersCollection()).doc(uid);
  }

  global.EC_SILO = {
    DOC_PROFILE: DOC_PROFILE,
    usersCollection: usersCollection,
    membershipCollection: membershipCollection,
    membershipRef: membershipRef,
    personalCardRef: personalCardRef,
    mascotCardRef: mascotCardRef,
    mascotLostScansRef: mascotLostScansRef,
    accountRef: accountRef,
  };
})(typeof window !== "undefined" ? window : this);
