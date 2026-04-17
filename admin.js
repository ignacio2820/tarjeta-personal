/**
 * EliteCard / MascotBook — suscripción, trial y acceso perpetuo.
 */
(function (global) {
  "use strict";

  var EC_TRIAL_DAYS = 7;

  function normalizeApp(app) {
    return String(app || "elitecard").trim().toLowerCase() === "mascotbook"
      ? "mascotbook"
      : "elitecard";
  }

  function normalizeEmail(e) {
    return String(e || "")
      .trim()
      .toLowerCase();
  }

  function isAgencyOwnerEmail(email) {
    var em = normalizeEmail(email);
    if (!em) return false;
    var list = global.EC_AGENCY_OWNER_EMAILS;
    if (!Array.isArray(list)) return false;
    for (var i = 0; i < list.length; i++) {
      if (normalizeEmail(list[i]) === em) return true;
    }
    return false;
  }

  function isPerpetualUid(uid) {
    var u = String(uid || "").trim();
    if (!u) return false;
    var list = global.EC_PERPETUAL_UIDS;
    if (!Array.isArray(list)) return false;
    return list.indexOf(u) >= 0;
  }

  function isDocAdmin(docData) {
    return String((docData && docData.role) || "")
      .trim()
      .toLowerCase() === "admin";
  }

  function isPerpetualAccess(uid, email, docData) {
    if (isAgencyOwnerEmail(email)) return true;
    if (isPerpetualUid(uid)) return true;
    if (isDocAdmin(docData)) return true;
    return false;
  }

  function resolveStatusField(docData, app) {
    var g = docData && docData.status != null ? String(docData.status).trim().toLowerCase() : "";
    if (g === "suspended" || g === "expired") return g;
    if (g === "premium" || g === "active") return "active";
    if (g === "trial") return "trial";
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
    var gs = docData && docData.status != null ? String(docData.status).trim().toLowerCase() : "";
    if (gs === "suspended" || gs === "expired") return "inactive";
    if (gs === "premium") return "active";
    var s = String(resolveStatusField(docData, app) || "trial")
      .trim()
      .toLowerCase();
    if (s === "active" || s === "pro" || s === "paid" || s === "premium") return "active";
    if (s === "suspended" || s === "expired") return "inactive";
    return "trial";
  }

  function getFechaRegistroMs(docData) {
    if (!docData) return null;
    if (docData.createdAt != null) {
      var c = docData.createdAt;
      if (typeof c === "number" && isFinite(c)) return c;
      if (c && typeof c.toMillis === "function") return c.toMillis();
      if (c && typeof c.seconds === "number") return c.seconds * 1000;
    }
    if (docData.fecha_registro == null) return null;
    var f = docData.fecha_registro;
    if (typeof f === "number" && isFinite(f)) return f;
    if (f && typeof f.toMillis === "function") return f.toMillis();
    if (f && typeof f.seconds === "number") return f.seconds * 1000;
    return null;
  }

  function isTrialPeriodExpired(docData, app, uid, email) {
    if (isPerpetualAccess(uid, email, docData)) return false;
    if (getPlanStatusFromDoc(docData, app) !== "trial") return false;
    var ms = getFechaRegistroMs(docData);
    if (ms == null) return false;
    return Date.now() - ms > EC_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  }

  function isEmailSignatureLocked(docData, app, uid, email) {
    if (isPerpetualAccess(uid, email, docData)) return false;
    if (normalizeApp(app) === "mascotbook") return true;
    var st = getPlanStatusFromDoc(docData, "elitecard");
    return st === "trial" || st === "inactive";
  }

  global.EliteCardAdminSubscription = {
    EC_TRIAL_DAYS: EC_TRIAL_DAYS,
    normalizeApp: normalizeApp,
    isDocAdmin: isDocAdmin,
    isAgencyOwnerEmail: isAgencyOwnerEmail,
    isPerpetualUid: isPerpetualUid,
    isPerpetualAccess: isPerpetualAccess,
    getPlanStatusFromDoc: getPlanStatusFromDoc,
    getFechaRegistroMs: getFechaRegistroMs,
    isTrialPeriodExpired: isTrialPeriodExpired,
    isEmailSignatureLocked: isEmailSignatureLocked,
  };
})(window);
