/**
 * EliteCard / MascotBook — validación de suscripción por producto.
 */
(function (global) {
  "use strict";

  var EC_TRIAL_DAYS = 7;

  function normalizeApp(app) {
    return String(app || "elitecard").trim().toLowerCase() === "mascotbook"
      ? "mascotbook"
      : "elitecard";
  }

  function isDocAdmin(docData) {
    return String((docData && docData.role) || "")
      .trim()
      .toLowerCase() === "admin";
  }

  function resolveStatusField(docData, app) {
    var a = normalizeApp(app);
    if (a === "mascotbook") {
      return docData && docData.mascotbook_status != null
        ? docData.mascotbook_status
        : docData && docData.plan_status != null
          ? docData.plan_status
          : "trial";
    }
    return docData && docData.elitecard_status != null
      ? docData.elitecard_status
      : docData && docData.plan_status != null
        ? docData.plan_status
        : "trial";
  }

  function getPlanStatusFromDoc(docData, app) {
    var s = String(resolveStatusField(docData, app) || "trial")
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

  function isTrialPeriodExpired(docData, app) {
    if (isDocAdmin(docData)) return false;
    if (getPlanStatusFromDoc(docData, app) !== "trial") return false;
    var ms = getFechaRegistroMs(docData);
    if (ms == null) return false;
    return Date.now() - ms > EC_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  }

  function isEmailSignatureLocked(docData, app) {
    if (isDocAdmin(docData)) return false;
    if (normalizeApp(app) === "mascotbook") return true;
    return getPlanStatusFromDoc(docData, "elitecard") === "trial";
  }

  global.EliteCardAdminSubscription = {
    EC_TRIAL_DAYS: EC_TRIAL_DAYS,
    normalizeApp: normalizeApp,
    isDocAdmin: isDocAdmin,
    getPlanStatusFromDoc: getPlanStatusFromDoc,
    getFechaRegistroMs: getFechaRegistroMs,
    isTrialPeriodExpired: isTrialPeriodExpired,
    isEmailSignatureLocked: isEmailSignatureLocked,
  };
})(window);
