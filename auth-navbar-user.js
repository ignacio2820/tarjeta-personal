/**
 * Saludo con nombre en navbar (paneles con Firebase Auth).
 * Nombre desde Firestore en tiempo real: onSnapshot en usuarios/{uid} (sin mocks).
 * Requiere: firebase (app + auth + firestore), EC_SILO.usersCollection opcional.
 */
(function (global) {
  "use strict";

  var __ecNavUserSnapUnsub = null;

  function usersCollection() {
    return global.EC_SILO && typeof global.EC_SILO.usersCollection === "function"
      ? global.EC_SILO.usersCollection()
      : "usuarios";
  }

  function membershipCollection() {
    var c = String(global.FIRESTORE_MEMBERSHIP_COLLECTION || "users").trim();
    return c || "users";
  }

  function pickNameFromDoc(d) {
    if (!d || typeof d !== "object") return "";
    return String(
      d.nombre || d.displayName || d.user_nombre || d.name || d.fullName || ""
    ).trim();
  }

  function setNavbarLabel(text) {
    var el = document.getElementById("user-display-name");
    if (!el) return;
    el.textContent = text || "";
  }

  function showWrap(show) {
    var wrap = document.getElementById("user-display-name-wrap");
    if (!wrap) return;
    wrap.classList.toggle("hidden", !show);
  }

  function clearNavbarUserListener() {
    if (__ecNavUserSnapUnsub) {
      try {
        __ecNavUserSnapUnsub();
      } catch (eU) {}
      __ecNavUserSnapUnsub = null;
    }
  }

  /**
   * @param {firebase.User|null} user
   */
  function applyNavbarUserDisplay(user) {
    clearNavbarUserListener();
    if (!user) {
      setNavbarLabel("");
      showWrap(false);
      return;
    }
    showWrap(true);

    var fromAuth = String(user.displayName || "").trim();
    if (fromAuth) {
      setNavbarLabel("Hola, " + fromAuth);
      return;
    }

    if (!global.firebase || typeof global.firebase.firestore !== "function") {
      var fb0 = user.email ? String(user.email).split("@")[0] : "Usuario";
      setNavbarLabel("Hola, " + (fb0 || "Usuario"));
      return;
    }

    var db = global.firebase.firestore();
    var uid = String(user.uid || "").trim();
    if (!uid) {
      setNavbarLabel("Hola, Usuario");
      return;
    }

    setNavbarLabel("Cargando…");
    var membershipNameFetched = false;

    __ecNavUserSnapUnsub = db
      .collection(usersCollection())
      .doc(uid)
      .onSnapshot(
        function (snap) {
          var uNow = global.firebase.auth && global.firebase.auth().currentUser;
          if (!uNow || uNow.uid !== uid) return;
          var nm = snap.exists ? pickNameFromDoc(snap.data() || {}) : "";
          if (nm) {
            setNavbarLabel("Hola, " + nm);
            return;
          }
          if (!membershipNameFetched) {
            membershipNameFetched = true;
            db.collection(membershipCollection())
              .doc(uid)
              .get()
              .then(function (s2) {
                if (!global.firebase.auth().currentUser || global.firebase.auth().currentUser.uid !== uid) {
                  return;
                }
                var nm2 = s2 && s2.exists ? pickNameFromDoc(s2.data() || {}) : "";
                setNavbarLabel(
                  "Hola, " + (nm2 || (user.email ? String(user.email).split("@")[0] : "Usuario"))
                );
              })
              .catch(function () {
                var fb = user.email ? String(user.email).split("@")[0] : "Usuario";
                setNavbarLabel("Hola, " + fb);
              });
            return;
          }
        },
        function () {
          var fb = user.email ? String(user.email).split("@")[0] : "Usuario";
          setNavbarLabel("Hola, " + fb);
        }
      );
  }

  global.EC_applyNavbarUserDisplay = applyNavbarUserDisplay;
  global.EC_clearNavbarUserFirestoreListener = clearNavbarUserListener;
})(typeof window !== "undefined" ? window : this);
