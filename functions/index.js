/**
 * Carga perezosa de firebase-admin: evita timeout del CLI al analizar el backend
 * ("User code failed to load... Timeout after 10000").
 */
const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");

setGlobalOptions({ region: "us-east1" });

const functionsV1 = require("firebase-functions/v1");

/** Token de producción / test de Mercado Pago (nunca en el frontend). */
const mpAccessToken = defineSecret("MP_ACCESS_TOKEN");

function membershipCollectionName() {
  return String(process.env.FIRESTORE_MEMBERSHIP_COLLECTION || "users").trim() || "users";
}

function timestampMsFromFirestoreVal(v) {
  if (v == null) return null;
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v.toMillis === "function") {
    try {
      return v.toMillis();
    } catch (e) {
      return null;
    }
  }
  if (typeof v._seconds === "number") return v._seconds * 1000;
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return null;
}

function parseExternalReference(ref) {
  const raw = String(ref || "").trim();
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts[0] !== "ec" || parts.length < 4) return null;
  const uid = String(parts[1] || "").trim();
  const plan = String(parts[2] || "").trim().toLowerCase();
  const idPerfil = String(parts.slice(3).join("|") || "").trim();
  if (!uid || (plan !== "mascotbook" && plan !== "elitecard")) return null;
  return { uid, plan, idPerfil };
}

function buildExternalReference(uid, plan, idPerfil) {
  const pid = String(idPerfil || "")
    .trim()
    .replace(/\|/g, "_")
    .slice(0, 200);
  return ["ec", uid, plan, pid].join("|");
}

function unitPriceForPlan(plan) {
  const mb = Number(process.env.MP_UNIT_PRICE_MASCOTBOOK || 24999);
  const el = Number(process.env.MP_UNIT_PRICE_ELITECARD || 19999);
  return plan === "mascotbook" ? mb : el;
}

function itemTitleForPlan(plan) {
  return plan === "mascotbook" ? "MascotBook · Suscripción anual" : "WebElite / EliteCard · Suscripción anual";
}

async function mpGetPayment(paymentId, accessToken) {
  const id = String(paymentId || "").trim();
  if (!id) return null;
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) {
    const t = await r.text();
    console.warn("[mp] payment GET failed", r.status, t.slice(0, 400));
    return null;
  }
  return r.json();
}

function paymentIdFromResourceUrl(s) {
  const u = String(s || "").trim();
  const m = u.match(/\/payments\/(\d+)/);
  return m ? m[1] : "";
}

function extractPaymentIdFromWebhook(req) {
  const b = req.body;
  if (b && typeof b === "object") {
    if (b.data && (b.data.id != null)) return String(b.data.id);
    const resUrl = b.resource || (b.data && typeof b.data === "object" ? b.data.resource : "");
    const fromRes = paymentIdFromResourceUrl(resUrl);
    if (fromRes) return fromRes;
    if (b.id != null && String(b.type || b.topic || "").toLowerCase().includes("payment")) {
      return String(b.id);
    }
  }
  const q = req.query || {};
  if (q["data.id"] != null) return String(q["data.id"]);
  if (q.topic && String(q.topic).toLowerCase() === "payment" && q.id != null) return String(q.id);
  const qRes = paymentIdFromResourceUrl(q.resource || q["data.resource"]);
  if (qRes) return qRes;
  return "";
}

function getAdmin() {
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const SILO_PROFILE = "profile";

/**
 * Lee silo Firestore (personal_card | mascot_card) y hace fallback al doc raíz legacy usuarios/{uid}.
 */
async function readDisplayForManifest(uid, appMode) {
  const db = getAdmin().firestore();
  const userRef = db.collection("usuarios").doc(uid);
  const isPet = appMode === "mascotbook";

  const siloSnap = await (isPet
    ? userRef.collection("mascot_card").doc(SILO_PROFILE).get()
    : userRef.collection("personal_card").doc(SILO_PROFILE).get());

  if (siloSnap.exists) {
    const s = siloSnap.data() || {};
    if (isPet) {
      return {
        nombre: String(s.nombre || "").trim(),
        subtitulo: String(s.raza || "").trim(),
        foto: String(s.fotoPerfilUrl || "").trim(),
        logo: "",
        bio: String(s.muro || s.historia || "").trim(),
      };
    }
    return {
      nombre: String(s.user_nombre || s.nombreCompleto || "").trim(),
      subtitulo: String(s.user_cargo || s.cargo || "").trim(),
      foto: String(s.fotoUrl || "").trim(),
      logo: String(s.logoUrl || "").trim(),
      bio: String(s.bio || "").trim(),
    };
  }

  if (isPet) {
    const mascotaSnap = await db.collection("mascotas").doc(uid).get();
    if (mascotaSnap.exists) {
      const m = mascotaSnap.data() || {};
      return {
        nombre: String(m.nombre || "").trim(),
        subtitulo: String(m.raza || "").trim(),
        foto: String(m.fotoPerfilUrl || "").trim(),
        logo: "",
        bio: String(m.muro || m.historia || "").trim(),
      };
    }
  }

  const rootSnap = await userRef.get();
  if (!rootSnap.exists) {
    return { nombre: "", subtitulo: "", foto: "", logo: "", bio: "" };
  }
  const d = rootSnap.data() || {};
  if (isPet) {
    return {
      nombre: String(d.mascotaNombre || "").trim(),
      subtitulo: String(d.mascotaCargo || "").trim(),
      foto: String(d.mascotaFotoUrl || "").trim(),
      logo: "",
      bio: String(d.mascotaBio || "").trim(),
    };
  }
  return {
    nombre: String(d.nombreCompleto || "").trim(),
    subtitulo: String(d.cargo || "").trim(),
    foto: String(d.fotoUrl || d.photoURL || "").trim(),
    logo: String(d.logoUrl || "").trim(),
    bio: String(d.bio || "").trim(),
  };
}

async function readDisplayForOg(uid, isMascotView) {
  const db = getAdmin().firestore();
  const userRef = db.collection("usuarios").doc(uid);

  const siloSnap = await (isMascotView
    ? userRef.collection("mascot_card").doc(SILO_PROFILE).get()
    : userRef.collection("personal_card").doc(SILO_PROFILE).get());

  if (siloSnap.exists) {
    const s = siloSnap.data() || {};
    if (isMascotView) {
      return {
        nombre: String(s.nombre || "").trim(),
        cargo: String(s.raza || "").trim(),
        bio: String(s.muro || s.historia || "").trim(),
        foto: String(s.fotoPerfilUrl || "").trim(),
        logo: "",
      };
    }
    return {
      nombre: String(s.user_nombre || s.nombreCompleto || "").trim(),
      cargo: String(s.user_cargo || s.cargo || "").trim(),
      bio: String(s.user_bio || s.bio || "").trim(),
      foto: String(s.fotoUrl || "").trim(),
      logo: String(s.logoUrl || "").trim(),
    };
  }

  if (isMascotView) {
    const mascotaSnap = await db.collection("mascotas").doc(uid).get();
    if (mascotaSnap.exists) {
      const m = mascotaSnap.data() || {};
      return {
        nombre: String(m.nombre || "").trim(),
        cargo: String(m.raza || "").trim(),
        bio: String(m.muro || m.historia || "").trim(),
        foto: String(m.fotoPerfilUrl || "").trim(),
        logo: "",
      };
    }
  }

  const rootSnap = await userRef.get();
  if (!rootSnap.exists) {
    return { nombre: "", cargo: "", bio: "", foto: "", logo: "" };
  }
  const d = rootSnap.data() || {};
  if (isMascotView) {
    return {
      nombre: String(d.mascotaNombre || "").trim(),
      cargo: String(d.mascotaCargo || "").trim(),
      bio: String(d.mascotaBio || "").trim(),
      foto: String(d.mascotaFotoUrl || "").trim(),
      logo: "",
    };
  }
  return {
    nombre: String(d.nombreCompleto || "").trim(),
    cargo: String(d.cargo || "").trim(),
    bio: String(d.bio || "").trim(),
    foto: String(d.fotoUrl || d.photoURL || "").trim(),
    logo: String(d.logoUrl || "").trim(),
  };
}

/**
 * GET /manifest-user?id=UID
 */
exports.manifest = onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "public, max-age=300, s-maxage=300");

    const uid = String(req.query.id || "").trim();
    if (!uid || uid.length > 256 || uid.indexOf("/") >= 0) {
      res.status(400).json({ error: "id inválido" });
      return;
    }

    const origin = "https://tarjeta-profesional-pedro.web.app";
    const appMode =
      String(req.query.app || "").trim().toLowerCase() === "mascotbook"
        ? "mascotbook"
        : "elitecard";

    try {
      const disp = await readDisplayForManifest(uid, appMode);

      let name = appMode === "mascotbook" ? "MascotBook" : "EliteCard";
      let shortName = appMode === "mascotbook" ? "MascotBook" : "EliteCard";
      let iconSrc = origin + "/icons/icon-192.png";
      let icon512 = origin + "/icons/icon-512.png";
      let icon512m = origin + "/icons/icon-512-maskable.png";

      if (disp.nombre) {
        name = disp.subtitulo ? disp.nombre + " — " + disp.subtitulo : disp.nombre;
        shortName =
          disp.nombre.length > 12 ? disp.nombre.split(" ")[0] : disp.nombre;
      }
      if (disp.logo) iconSrc = disp.logo;
      else if (disp.foto) iconSrc = disp.foto;
      icon512 = iconSrc;
      icon512m = iconSrc;

      const startUrl =
        origin +
        "/card.html?id=" +
        encodeURIComponent(uid) +
        (appMode === "mascotbook" ? "&view=pet" : "");

      const manifest = {
        id: startUrl,
        name: name,
        short_name: shortName,
        description:
          appMode === "mascotbook"
            ? "Ficha digital de salud y contacto para mascotas."
            : "Tarjeta digital profesional — EliteCard",
        lang: "es",
        dir: "ltr",
        start_url: startUrl,
        scope: origin + "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "portrait-primary",
        background_color: "#050505",
        theme_color: "#050505",
        prefer_related_applications: false,
        icons: [
          { src: iconSrc, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: icon512m, sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      };

      res.set("Content-Type", "application/manifest+json");
      res.status(200).json(manifest);
    } catch (err) {
      console.error("manifest error:", err);
      res.redirect(301, origin + "/manifest.json");
    }
  });

/**
 * GET /card?id=UID
 */
exports.card = onRequest(async (req, res) => {
    res.set("Cache-Control", "public, max-age=60, s-maxage=60");

    const uid = String(req.query.id || "").trim();
    const host = req.get("x-forwarded-host") || req.get("host") || "";
    const proto = req.get("x-forwarded-proto") || "https";
    const origin =
      host && !/localhost|127\.0\.0\.1/.test(host)
        ? `${proto}://${host}`
        : "https://tarjeta-profesional-pedro.web.app";

    if (!uid || uid.length > 256 || uid.indexOf("/") >= 0) {
      res.redirect(301, origin + "/");
      return;
    }

    try {
      let ogTitle = "EliteCard | Tarjeta Profesional Digital";
      let ogDesc = "Hacé clic para ver mis datos de contacto.";
      let ogImage = origin + "/icons/icon-512.png";
      const viewQ = String(req.query.view || "").trim();
      const isMascot =
        viewQ && /^(pet|mascota|mascotbook)$/i.test(viewQ);
      const viewPart = isMascot
        ? "&view=" + encodeURIComponent(viewQ.toLowerCase())
        : "";
      const cardUrl = origin + "/card.html?id=" + encodeURIComponent(uid) + viewPart;

      const row = await readDisplayForOg(uid, !!isMascot);
      if (row.nombre) {
        if (isMascot) {
          ogTitle = row.cargo
            ? row.nombre + " — " + row.cargo + " | MascotBook"
            : row.nombre + " | MascotBook";
          ogDesc =
            row.bio ||
            (row.nombre && row.cargo
              ? row.nombre + ", " + row.cargo + ". Perfil social mascota."
              : ogDesc);
        } else {
          ogTitle = row.cargo
            ? row.nombre + " — " + row.cargo + " | EliteCard"
            : row.nombre + " | EliteCard";
          ogDesc =
            row.bio ||
            (row.nombre && row.cargo
              ? row.nombre + ", " + row.cargo + ". Tarjeta digital profesional."
              : ogDesc);
        }
      }
      if (row.foto) ogImage = row.foto;
      else if (row.logo) ogImage = row.logo;

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escHtml(ogTitle)}</title>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${escHtml(cardUrl)}"/>
<meta property="og:title" content="${escHtml(ogTitle)}"/>
<meta property="og:description" content="${escHtml(ogDesc)}"/>
<meta property="og:image" content="${escHtml(ogImage)}"/>
<meta property="og:image:width" content="512"/>
<meta property="og:image:height" content="512"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escHtml(ogTitle)}"/>
<meta name="twitter:description" content="${escHtml(ogDesc)}"/>
<meta name="twitter:image" content="${escHtml(ogImage)}"/>
<meta http-equiv="refresh" content="0;url=${escHtml(cardUrl)}"/>
<link rel="canonical" href="${escHtml(cardUrl)}"/>
</head>
<body>
<script>window.location.replace("${escHtml(cardUrl)}");</script>
</body>
</html>`;

      res.set("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch (err) {
      console.error("card error:", err);
      res.redirect(301, origin + "/card.html?id=" + encodeURIComponent(uid));
    }
  });

/**
 * Email al dueño cuando alguien comparte GPS (modo perdido).
 * Configuración (Firebase legacy config): smtp.host, smtp.port, smtp.secure, smtp.user, smtp.pass, smtp.from
 * Ej.: firebase functions:config:set smtp.host="smtp.tuproveedor.com" smtp.port="587" smtp.user="..." smtp.pass="..." smtp.from="MascotBook <no-reply@tudominio.com>"
 */
let nodemailer;
try {
  nodemailer = require("nodemailer");
} catch (e) {
  nodemailer = null;
}

exports.onMascotLostScanNotify = onDocumentCreated("usuarios/{uid}/mascot_lost_scans/{scanId}", async (event) => {
    const uid = event.params.uid;
    const snap = event.data;
    const adminApp = getAdmin();
    let toEmail = "";
    try {
      const u = await adminApp.auth().getUser(uid);
      toEmail = String(u.email || "").trim();
    } catch (e) {
      console.warn("[lost-scan] getUser", uid, e.message);
      return null;
    }
    if (!toEmail) {
      console.log("[lost-scan] sin email en Auth para", uid);
      return null;
    }
    const cfg = functionsV1.config().smtp || {};
    if (!cfg.host) {
      console.log("[lost-scan] smtp.host no configurado; no se envía email.");
      return null;
    }
    if (!nodemailer) {
      console.warn("[lost-scan] nodemailer no disponible");
      return null;
    }
    const data = snap.data() || {};
    const transporter = nodemailer.createTransport({
      host: String(cfg.host),
      port: Number(cfg.port || 587),
      secure: String(cfg.secure || "").toLowerCase() === "true",
      auth: cfg.user ? { user: String(cfg.user), pass: String(cfg.pass || "") } : undefined,
    });
    const body =
      "Se registró una ubicación desde el perfil público en modo mascota perdida.\n\n" +
      `Latitud: ${data.lat}\nLongitud: ${data.lng}\n` +
      (data.accuracy != null ? `Precisión (m): ${data.accuracy}\n` : "") +
      "\nPodés ver más detalle en tu panel MascotBook.\n";
    try {
      await transporter.sendMail({
        from: String(cfg.from || "MascotBook <noreply@localhost>"),
        to: toEmail,
        subject: "MascotBook · Nueva ubicación (mascota perdida)",
        text: body,
      });
      console.log("[lost-scan] email enviado a", toEmail);
    } catch (err) {
      console.error("[lost-scan] sendMail", err.message || err);
    }
    return null;
  });

/**
 * Mercado Pago — activa membresía 365 días tras pago aprobado.
 * external_reference formato: ec|uid|mascotbook|elitecard|idPerfil
 */
async function applyMembershipAfterApproved(payment) {
  const parsed = parseExternalReference(payment.external_reference);
  if (!parsed) {
    console.warn("[mp] external_reference inválida", payment.external_reference);
    return false;
  }
  const admin = getAdmin();
  const db = admin.firestore();
  const col = membershipCollectionName();
  const ref = db.collection(col).doc(parsed.uid);
  const ms365 = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const due = admin.firestore.Timestamp.fromMillis(ms365);
  const patch = {
    isPremium: true,
    status: "active",
    plan_status: "active",
    vencimientoMembresia: due,
    lastMercadoPagoPaymentId: String(payment.id || ""),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (parsed.plan === "mascotbook") {
    patch.mascotbook_status = "active";
    patch.mascotbook_multi_unlocked = true;
  } else {
    patch.elitecard_status = "active";
  }
  await ref.set(patch, { merge: true });
  console.log("[mp] membresía activada", parsed.uid, parsed.plan);
  return true;
}

/** Webhook / notificación IPN (configurar URL en panel Mercado Pago). */
exports.webhookMercadoPago = onRequest({ secrets: [mpAccessToken] }, async (req, res) => {
  if (req.method === "GET") {
    res.status(200).send("ok");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  let paymentId = extractPaymentIdFromWebhook(req);
  if (!paymentId && typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
      paymentId = extractPaymentIdFromWebhook(req);
    } catch (e) {
      // ignore
    }
  }
  if (!paymentId) {
    console.log("[mp] webhook sin payment id", JSON.stringify(req.body || {}).slice(0, 500));
    res.status(200).send("noop");
    return;
  }
  const token = mpAccessToken.value();
  const payment = await mpGetPayment(paymentId, token);
  if (!payment) {
    res.status(200).send("no payment");
    return;
  }
  if (String(payment.status || "").toLowerCase() !== "approved") {
    console.log("[mp] estado distinto de approved", payment.id, payment.status);
    res.status(200).send("ignored");
    return;
  }
  try {
    await applyMembershipAfterApproved(payment);
  } catch (err) {
    console.error("[mp] apply membership", err);
  }
  res.status(200).send("ok");
});

/** Callable — crea preferencia Checkout Pro (nunca expongas el token en el cliente). */
exports.createMercadoPagoPreference = onCall({ secrets: [mpAccessToken], cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Sesión requerida");
  }
  const uid = request.auth.uid;
  const idPerfil = String((request.data && request.data.idPerfil) || "").trim();
  const tipoPlanRaw = String((request.data && request.data.tipoPlan) || "mascotbook").toLowerCase();
  const tipoPlan = tipoPlanRaw === "elitecard" ? "elitecard" : "mascotbook";
  const returnBase = String((request.data && request.data.returnBase) || "").trim().replace(/\/$/, "");
  if (!returnBase || !/^https?:\/\//i.test(returnBase)) {
    throw new HttpsError("invalid-argument", "returnBase debe ser una URL http(s) absoluta");
  }
  const ext = buildExternalReference(uid, tipoPlan, idPerfil);
  const token = mpAccessToken.value();
  const unit = unitPriceForPlan(tipoPlan);
  const q = returnBase.indexOf("?") >= 0 ? "&" : "?";
  const successUrl =
    returnBase +
    q +
    "pago=exitoso&id=" +
    encodeURIComponent(uid) +
    "&plan=" +
    encodeURIComponent(tipoPlan) +
    (idPerfil ? "&perfil=" + encodeURIComponent(idPerfil) : "");
  const pendUrl = returnBase + q + "pago=pendiente";
  const failUrl = returnBase + q + "pago=fallido";
  const prefBody = {
    items: [
      {
        title: itemTitleForPlan(tipoPlan),
        description: "Activación 365 días",
        quantity: 1,
        currency_id: "ARS",
        unit_price: Number(unit) || 1,
      },
    ],
    external_reference: ext,
    back_urls: {
      success: successUrl,
      pending: pendUrl,
      failure: failUrl,
    },
    auto_return: "approved",
  };
  if (request.auth.token && request.auth.token.email) {
    prefBody.payer = { email: String(request.auth.token.email).slice(0, 256) };
  }
  const idem =
    String((request.data && request.data.idempotencyKey) || "").trim() ||
    `ec-pref-${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
    },
    body: JSON.stringify(prefBody),
  });
  let j = {};
  try {
    j = await r.json();
  } catch (e) {
    j = {};
  }
  if (!r.ok) {
    console.error("[mp] preference error", r.status, j);
    throw new HttpsError("internal", (j && j.message) || "Error creando preferencia MP");
  }
  const initPoint = j.init_point || j.sandbox_init_point;
  if (!initPoint) {
    throw new HttpsError("internal", "Respuesta MP sin init_point");
  }
  return { init_point: initPoint, preference_id: j.id || null, external_reference: ext };
});

/** Marca membresía vencida si vencimientoMembresia ya pasó (hora del servidor en la función). */
exports.expireMembershipIfDue = onCall(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Sesión requerida");
  }
  const uid = request.auth.uid;
  const admin = getAdmin();
  const db = admin.firestore();
  const ref = db.collection(membershipCollectionName()).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return { updated: false, reason: "no_membership_doc" };
  }
  const d = snap.data() || {};
  const ms = timestampMsFromFirestoreVal(d.vencimientoMembresia);
  if (ms == null || Date.now() <= ms) {
    return { updated: false, reason: "not_due" };
  }
  const st = String(d.status || "").toLowerCase();
  if (st === "expired" || st === "suspended") {
    return { updated: false, reason: "already_terminal" };
  }
  await ref.set(
    {
      status: "expired",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { updated: true };
});
