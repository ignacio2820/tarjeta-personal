/**
 * EliteCard — validación de suscripción y trial en el panel (admin.html).
 * role: "admin" en Firestore → bypass total (Pro en el dashboard).
 */
(function (global) {
  "use strict";

  var EC_TRIAL_DAYS = 7;

  function isDocAdmin(docData) {
    return String((docData && docData.role) || "")
      .trim()
      .toLowerCase() === "admin";
  }

  function getPlanStatusFromDoc(docData) {
    var s = String((docData && docData.plan_status) || "trial")
      .trim()
      .toLowerCase();
    if (s === "active" || s === "pro" || s === "paid") return "active";
    return "trial";
  }

  function getFechaRegistroMs(docData) {
    if (!docData || docData.fecha_registro == null) return null;
    var f = docData.fecha_registro;
    if (typeof f === "number" && isFinite(f)) return f;
    if (f && typeof f.toMillis === "function") return f.toMillis();
    if (f && typeof f.seconds === "number") return f.seconds * 1000;
    return null;
  }

  function isTrialPeriodExpired(docData) {
    if (isDocAdmin(docData)) return false;
    if (getPlanStatusFromDoc(docData) !== "trial") return false;
    var ms = getFechaRegistroMs(docData);
    if (ms == null) return false;
    return Date.now() - ms > EC_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  }

  function isEmailSignatureLocked(docData) {
    if (isDocAdmin(docData)) return false;
    return getPlanStatusFromDoc(docData) === "trial";
  }

  global.EliteCardAdminSubscription = {
    EC_TRIAL_DAYS: EC_TRIAL_DAYS,
    isDocAdmin: isDocAdmin,
    getPlanStatusFromDoc: getPlanStatusFromDoc,
    getFechaRegistroMs: getFechaRegistroMs,
    isTrialPeriodExpired: isTrialPeriodExpired,
    isEmailSignatureLocked: isEmailSignatureLocked,
  };
})(window);
