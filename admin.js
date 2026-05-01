/**
 * EliteCard / MascotBook — suscripción, trial y acceso perpetuo.
 * Nota panel: `lastAccountData` y `ecMbMergedAccountDoc()` en admin.html deben fusionar
 * primero la colección de membresía (`users`) y encima la legacy (`usuarios`) para que
 * `role: "admin"` u otros campos en `usuarios` no queden ocultos.
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

  /**
   * Misma fusión que el panel (membresía + legacy): detecta admin en `usuarios` aunque `users` no tenga `role`.
   * Sustituye la lógica de «abrir modal de pago MascotBook»: si devuelve true, ir directo al alta de mascota.
   */
  function shouldSkipMascotbookPaymentModal(uid, email, membershipDoc, legacyUserDoc) {
    var merged = Object.assign({}, membershipDoc || {}, legacyUserDoc || {});
    return isPerpetualAccess(uid, email, merged);
  }

  function resolveStatusField(docData, app) {
    var g = docData && docData.status != null ? String(docData.status).trim().toLowerCase() : "";
    if (g === "suspended" || g === "expired") return g;
    if (g === "premium" || g === "active" || g === "activo") return "active";
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
    if (!docData || typeof docData !== "object") docData = {};
    if (isVencimientoMembresiaPast(docData)) return "inactive";
    var gs = docData && docData.status != null ? String(docData.status).trim().toLowerCase() : "";
    if (gs === "suspended" || gs === "expired") return "inactive";
    if (gs === "premium" || gs === "activo" || gs === "active") return "active";
    var s = String(resolveStatusField(docData, app) || "trial")
      .trim()
      .toLowerCase();
    if (s === "active" || s === "pro" || s === "paid" || s === "premium" || s === "activo") return "active";
    if (s === "suspended" || s === "expired") return "inactive";
    if (s === "inactive" || s === "none" || s === "disabled") return "inactive";
    return "trial";
  }

  function activeProductsList(docData) {
    if (!docData || typeof docData !== "object") return null;
    var ap = docData.activeProducts;
    if (!Array.isArray(ap)) return null;
    var out = [];
    for (var i = 0; i < ap.length; i++) {
      var t = String(ap[i] || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "");
      if (t === "mascotbook" || t === "mascot") out.push("mascotbook");
      if (t === "elitecard" || t === "elite" || t === "personal") out.push("elitecard");
    }
    return out.length ? out : null;
  }

  function globalMembershipBlocksProductAccess(docData) {
    var gst = String((docData && docData.status) || "").trim().toLowerCase();
    return gst === "suspended" || gst === "expired";
  }

  function eliteSidecarGrantsAccess(eliteCollData) {
    if (!eliteCollData || typeof eliteCollData !== "object") return false;
    var st = String(eliteCollData.status || "").trim().toLowerCase();
    if (st === "suspended" || st === "expired") return false;
    if (st === "premium" || st === "active") return true;
    if (st !== "trial") return false;
    var pu = eliteCollData.premiumUntil;
    if (pu != null) {
      var ms = null;
      try {
        if (typeof pu.toMillis === "function") ms = pu.toMillis();
        else if (typeof pu.seconds === "number") ms = pu.seconds * 1000;
      } catch (ePu) {}
      if (ms != null && Date.now() <= ms) return true;
    }
    return !isTrialPeriodExpired(eliteCollData, "elitecard", "", "");
  }

  function hasMascotBookDashboardAccess(docData, uid, email) {
    if (!docData || typeof docData !== "object") docData = {};
    if (isPerpetualAccess(uid, email, docData)) return true;
    if (globalMembershipBlocksProductAccess(docData)) return false;
    var ap = activeProductsList(docData);
    if (ap && ap.indexOf("mascotbook") < 0) {
      if (docData.hasMascotBook === true) return true;
      if (getPlanStatusFromDoc(docData, "mascotbook") === "active") return true;
      return false;
    }
    if (docData.hasMascotBook === true) return true;
    var st = getPlanStatusFromDoc(docData, "mascotbook");
    if (st === "inactive") {
      if (docData.hasMascotBook === true) return true;
      if (ap && ap.indexOf("mascotbook") >= 0) return true;
      return false;
    }
    if (st === "active") return true;
    if (st === "trial" && !isTrialPeriodExpired(docData, "mascotbook", uid, email)) return true;
    return false;
  }

  function hasEliteCardDashboardAccess(docData, eliteCollData, uid, email) {
    if (!docData || typeof docData !== "object") docData = {};
    if (isPerpetualAccess(uid, email, docData)) return true;
    if (globalMembershipBlocksProductAccess(docData)) return false;
    var ap = activeProductsList(docData);
    if (ap && ap.indexOf("elitecard") < 0) {
      if (docData.hasEliteCard === true) return true;
      if (getPlanStatusFromDoc(docData, "elitecard") === "active") return true;
      if (eliteSidecarGrantsAccess(eliteCollData)) return true;
      return false;
    }
    if (docData.hasEliteCard === true) return true;
    var st = getPlanStatusFromDoc(docData, "elitecard");
    if (st === "inactive") {
      if (docData.hasEliteCard === true) return true;
      if (ap && ap.indexOf("elitecard") >= 0) return true;
      if (eliteSidecarGrantsAccess(eliteCollData)) return true;
      return false;
    }
    if (st === "active") return true;
    if (st === "trial" && !isTrialPeriodExpired(docData, "elitecard", uid, email)) return true;
    if (eliteSidecarGrantsAccess(eliteCollData)) return true;
    return false;
  }

  function timestampFieldMs(val) {
    if (val == null) return null;
    if (typeof val === "number" && isFinite(val)) return val;
    if (val && typeof val.toMillis === "function") {
      try {
        return val.toMillis();
      } catch (e0) {}
    }
    if (val && typeof val.seconds === "number") return val.seconds * 1000;
    return null;
  }

  function isVencimientoMembresiaPast(docData) {
    if (!docData || typeof docData !== "object") return false;
    var ms = timestampFieldMs(docData.vencimientoMembresia);
    if (ms == null) return false;
    return Date.now() > ms;
  }

  function getFechaRegistroMs(docData) {
    if (!docData) return null;
    var ts0 = timestampFieldMs(docData.trialStartDate);
    if (ts0 != null) return ts0;
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
    var puMs = timestampFieldMs(docData && docData.premiumUntil);
    if (puMs != null && Date.now() <= puMs) return false;
    var ms = getFechaRegistroMs(docData);
    if (ms == null) return false;
    return Date.now() - ms > EC_TRIAL_DAYS * 24 * 60 * 60 * 1000;
  }

  /** Trial vigente o premium: misma experiencia de UI que pago. */
  function isPremiumOrActiveTrial(docData, app, uid, email) {
    var st = getPlanStatusFromDoc(docData, app);
    if (st === "active") return true;
    if (st === "trial" && !isTrialPeriodExpired(docData, app, uid, email)) return true;
    return false;
  }

  /**
   * EliteCard — UI y guardado “como Premium”: premium global, trial Elite vigente
   * (elitecard_status + trialStartDate / premiumUntil) o trial vigente en users_elite.
   * Paralelo a MascotBook: isSavingBlockedByMembership solo corta por suspended/expired global;
   * acá sumamos el lado Elite sin bloquear trial activo.
   */
  function canEliteCardPremiumUi(docData, eliteCollData, uid, email) {
    if (!docData || typeof docData !== "object") docData = {};
    if (isPerpetualAccess(uid, email, docData)) return true;
    if (globalMembershipBlocksProductAccess(docData)) return false;
    if (getPlanStatusFromDoc(docData, "elitecard") === "active") return true;
    if (isPremiumOrActiveTrial(docData, "elitecard", uid, email)) return true;
    return eliteSidecarGrantsAccess(eliteCollData);
  }

  /**
   * Acceso / edición MascotBook: bloqueo si la membresía pagada venció (vencimientoMembresia &lt; ahora).
   * shouldExpireRemote: conviene invocar Cloud Function expireMembershipIfDue para persistir status expired.
   */
  function checkMascotaAccess(docData, app, uid, email) {
    if (!docData || typeof docData !== "object") docData = {};
    if (isPerpetualAccess(uid, email, docData)) {
      return { ok: true, blocked: false, shouldExpireRemote: false, reason: "" };
    }
    if (isVencimientoMembresiaPast(docData)) {
      return { ok: false, blocked: true, shouldExpireRemote: true, reason: "vencimiento_membresia" };
    }
    var a = normalizeApp(app);
    var st = getPlanStatusFromDoc(docData, a);
    if (st === "active") {
      return { ok: true, blocked: false, shouldExpireRemote: false, reason: "" };
    }
    if (st === "trial" && !isTrialPeriodExpired(docData, a, uid, email)) {
      return { ok: true, blocked: false, shouldExpireRemote: false, reason: "" };
    }
    return { ok: false, blocked: true, shouldExpireRemote: false, reason: "plan" };
  }

  function isEmailSignatureLocked(docData, app, uid, email) {
    if (isPerpetualAccess(uid, email, docData)) return false;
    if (normalizeApp(app) === "mascotbook") return true;
    if (isPremiumOrActiveTrial(docData, "elitecard", uid, email)) return false;
    var st = getPlanStatusFromDoc(docData, "elitecard");
    if (st === "trial" && isTrialPeriodExpired(docData, "elitecard", uid, email)) return true;
    return st === "inactive";
  }

  global.EliteCardAdminSubscription = {
    EC_TRIAL_DAYS: EC_TRIAL_DAYS,
    isVencimientoMembresiaPast: isVencimientoMembresiaPast,
    checkMascotaAccess: checkMascotaAccess,
    normalizeApp: normalizeApp,
    isDocAdmin: isDocAdmin,
    isAgencyOwnerEmail: isAgencyOwnerEmail,
    isPerpetualUid: isPerpetualUid,
    isPerpetualAccess: isPerpetualAccess,
    shouldSkipMascotbookPaymentModal: shouldSkipMascotbookPaymentModal,
    getPlanStatusFromDoc: getPlanStatusFromDoc,
    getFechaRegistroMs: getFechaRegistroMs,
    isTrialPeriodExpired: isTrialPeriodExpired,
    isPremiumOrActiveTrial: isPremiumOrActiveTrial,
    canEliteCardPremiumUi: canEliteCardPremiumUi,
    isEmailSignatureLocked: isEmailSignatureLocked,
    activeProductsList: activeProductsList,
    hasMascotBookDashboardAccess: hasMascotBookDashboardAccess,
    hasEliteCardDashboardAccess: hasEliteCardDashboardAccess,
    /** true = trial vencido / sin plan Pro: no guardar salud, fotos ni modo perdido (misma lógica que checkMascotaAccess bloqueado). */
    mascotbookProContentLocked: function (docData, uid, email) {
      var chk = checkMascotaAccess(docData, "mascotbook", uid, email);
      return !!(chk && chk.blocked);
    },
  };
})(window);
