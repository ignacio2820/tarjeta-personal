/**
 * Carga perezosa de firebase-admin: evita timeout del CLI al analizar el backend
 * ("User code failed to load... Timeout after 10000").
 */
const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { MercadoPagoConfig, Preference } = require("mercadopago");

setGlobalOptions({ region: "us-east1" });

const functionsV1 = require("firebase-functions/v1");

/** Token de producción / test de Mercado Pago (nunca en el frontend). */
const mpAccessToken = defineSecret("MP_ACCESS_TOKEN");

/** Copy unificado tras pago aprobado (retorno Checkout / feedback HTTP). */
const EC_MP_SUCCESS_FEEDBACK_COPY =
  "¡Pago procesado con éxito! Tu activo digital ya está totalmente operativo";

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

function sanitizeMpSegment(s) {
  return String(s || "")
    .trim()
    .replace(/\|/g, "_")
    .slice(0, 120);
}

/**
 * external_reference: siempre incluye el UID en el segmento 1.
 * - ec|UID|elite_suscripcion|once|monthly
 * - ec|UID|mascota_adicional|MASCOT_ID|CANT o ec|UID|mascota_adicional|nueva_mascota|CANT
 * - ec|UID|mascotbook|idPerfil (legacy) · ec|UID|elitecard|idPerfil (legacy)
 */
function buildMercadoPagoExternalReference(payload) {
  const uid = sanitizeMpSegment(payload && payload.uid);
  if (!uid) return null;
  const producto = String((payload && payload.producto) || "").trim().toLowerCase();
  if (producto === "elite_suscripcion") {
    const billing = String((payload && payload.eliteBilling) || "once").toLowerCase() === "monthly" ? "monthly" : "once";
    return ["ec", uid, "elite_suscripcion", billing].join("|");
  }
  if (producto === "mascota_adicional") {
    const qty = Math.max(1, Math.min(999, Math.floor(Number((payload && payload.cantidad) || 1) || 1)));
    const nueva = !!(payload && payload.nuevaMascota);
    const token = nueva ? "nueva_mascota" : sanitizeMpSegment(payload && payload.mascotId) || "nueva_mascota";
    return ["ec", uid, "mascota_adicional", token, String(qty)].join("|");
  }
  const plan = String((payload && payload.tipoPlan) || "mascotbook").toLowerCase() === "elitecard" ? "elitecard" : "mascotbook";
  const idPerfil = sanitizeMpSegment(payload && payload.idPerfil);
  return ["ec", uid, plan, idPerfil].join("|");
}

/**
 * @returns {null | { kind: string, uid: string, [k: string]: any }}
 */
function parseMercadoPagoExternalReference(ref) {
  const raw = String(ref || "").trim();
  if (!raw) return null;
  const parts = raw.split("|");
  if (parts[0] !== "ec" || parts.length < 3) return null;
  const uid = String(parts[1] || "").trim();
  if (!uid) return null;
  const tag = String(parts[2] || "").trim().toLowerCase();
  if (tag === "elite_suscripcion") {
    const billing = String(parts[3] || "once").toLowerCase() === "monthly" ? "monthly" : "once";
    return { kind: "elite_suscripcion", uid, eliteBilling: billing };
  }
  if (tag === "mascota_adicional") {
    const tok = String(parts[3] || "").trim();
    const qtyRaw = parseInt(String(parts[4] || "1"), 10);
    const quantity = Number.isFinite(qtyRaw) ? Math.max(1, Math.min(999, qtyRaw)) : 1;
    const nuevaMascota = !tok || tok === "nueva_mascota";
    const mascotId = nuevaMascota ? "" : tok;
    return { kind: "mascota_adicional", uid, nuevaMascota, mascotId, quantity };
  }
  if (tag === "mascotbook" || tag === "elitecard") {
    const idPerfil = parts.slice(3).join("|").trim();
    return { kind: "legacy_suscripcion", uid, plan: tag, idPerfil };
  }
  return null;
}

function unitPriceLegacyPlan(plan) {
  const mb = Number(process.env.MP_UNIT_PRICE_MASCOTBOOK || 24999);
  const el = Number(process.env.MP_UNIT_PRICE_ELITECARD || 19999);
  return plan === "mascotbook" ? mb : el;
}

function unitPriceEliteSuscripcion(billing) {
  const once = Number(process.env.MP_PRICE_ELITECARD_ONCE || process.env.MP_UNIT_PRICE_ELITECARD || 19999);
  const monthly = Number(
    process.env.MP_PRICE_ELITECARD_MONTHLY || process.env.MP_PRICE_ELITECARD_ONCE || process.env.MP_UNIT_PRICE_ELITECARD || 19999
  );
  return billing === "monthly" ? monthly : once;
}

function unitPriceMascotaAdicional() {
  return Number(process.env.MP_PRICE_MASCOTA_ADICIONAL || process.env.MP_UNIT_PRICE_MASCOTBOOK || 24999);
}

/** Descuento sobre unit_price de Mascota Adicional si ya hay ≥1 mascota activa (no memorial) (0.5 = 50%). */
const MP_MASCOTA_ADICIONAL_MULTIMASCOTA_FACTOR = Math.min(
  1,
  Math.max(0.01, Number(process.env.MP_MASCOTA_ADICIONAL_MULTIMASCOTA_FACTOR || 0.5) || 0.5)
);

/**
 * Cuenta mascotas que ocupan cupo (excluye memorial por completo).
 */
function countMascotasActiveSlots(countSnap) {
  let n = 0;
  countSnap.forEach((doc) => {
    const d = doc.data() || {};
    const st = String(d.mbProfileStatus ?? "")
      .trim()
      .toLowerCase();
    if (st === "memorial") return;
    n += 1;
  });
  return n;
}

async function countMascotasActiveSlotsForUid(uid) {
  const u = String(uid || "").trim();
  if (!u) return 0;
  const db = getAdmin().firestore();
  const snap = await db.collection("mascotas").where("ownerUid", "==", u).get();
  return countMascotasActiveSlots(snap);
}

/**
 * Crea una preferencia de Checkout Pro en Mercado Pago (SDK oficial).
 * @param {string} accessToken
 * @param {Record<string, unknown>} body Cuerpo según referencia MP (items, external_reference, back_urls, …).
 * @param {string} idempotencyKey
 * @returns {Promise<Record<string, unknown>>}
 */
async function crearPreferenciaMercadoPago(accessToken, body, idempotencyKey) {
  const client = new MercadoPagoConfig({ accessToken: String(accessToken || "").trim() });
  const preference = new Preference(client);
  return preference.create({
    body,
    requestOptions: { idempotencyKey: String(idempotencyKey || "").trim() || `ec-mp-${Date.now()}` },
  });
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
 * Acredita créditos de perfil MascotBook o marca pago en mascotas/{id} (idempotente por payment id).
 */
async function fulfillMascotaAdicionalApprovedPayment(payment, parsed) {
  if (!parsed || parsed.kind !== "mascota_adicional") {
    return { ok: false, reason: "not_addon" };
  }
  const admin = getAdmin();
  const db = admin.firestore();
  const payId = String(payment.id || "").trim();
  if (!payId) return { ok: false, reason: "no_payment_id" };
  const col = membershipCollectionName();
  const memRef = db.collection(col).doc(parsed.uid);
  const qty = Math.max(1, Math.min(999, Number(parsed.quantity) || 1));

  if (parsed.nuevaMascota) {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(memRef);
      const d = snap.exists ? snap.data() : {};
      const arr = Array.isArray(d.mpMascotAddonPaymentIds) ? d.mpMascotAddonPaymentIds : [];
      if (arr.indexOf(payId) >= 0) return;
      const next = (arr.length > 90 ? arr.slice(-70) : arr.slice()).concat([payId]);
      tx.set(
        memRef,
        {
          mascotbookExtraProfileCredits: admin.firestore.FieldValue.increment(qty),
          mascotas_permitidas: admin.firestore.FieldValue.increment(qty),
          mpMascotAddonPaymentIds: next,
          lastMercadoPagoPaymentId: payId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    console.log("[mp] créditos perfil mascota +", qty, parsed.uid);
    return { ok: true, nuevaMascota: true };
  }

  if (parsed.mascotId) {
    const petRef = db.collection("mascotas").doc(parsed.mascotId);
    const petSnap = await petRef.get();
    if (!petSnap.exists || String((petSnap.data() || {}).ownerUid || "") !== parsed.uid) {
      console.warn("[mp] mascota_adicional mascotId inválido", parsed.mascotId, parsed.uid);
      return { ok: false, reason: "invalid_pet" };
    }
    await db.runTransaction(async (tx) => {
      const memSnap = await tx.get(memRef);
      const md = memSnap.exists ? memSnap.data() : {};
      const arr = Array.isArray(md.mpMascotAddonPaymentIds) ? md.mpMascotAddonPaymentIds : [];
      if (arr.indexOf(payId) >= 0) return;
      const next = (arr.length > 90 ? arr.slice(-70) : arr.slice()).concat([payId]);
      tx.set(
        petRef,
        {
          mbProfilePaid: true,
          mbProfilePaidPaymentId: payId,
          pago: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(
        memRef,
        {
          mpMascotAddonPaymentIds: next,
          lastMercadoPagoPaymentId: payId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    return { ok: true, mascotId: parsed.mascotId };
  }
  return { ok: false, reason: "unknown_addon" };
}

/**
 * Mercado Pago — activa membresía de larga duración tras pago aprobado (suscripciones / EliteCard).
 * Duración: env `MP_MEMBERSHIP_YEARS` (default 30). "mascota_adicional" acredita créditos o marca perfil pagado.
 */
async function applyMembershipAfterApproved(payment) {
  const parsed = parseMercadoPagoExternalReference(payment.external_reference);
  if (!parsed) {
    console.warn("[mp] external_reference inválida", payment.external_reference);
    return false;
  }
  if (parsed.kind === "mascota_adicional") {
    const r = await fulfillMascotaAdicionalApprovedPayment(payment, parsed);
    return !!r.ok;
  }
  const admin = getAdmin();
  const db = admin.firestore();
  const col = membershipCollectionName();
  const ref = db.collection(col).doc(parsed.uid);
  const years = Math.max(1, Math.min(80, Math.floor(Number(process.env.MP_MEMBERSHIP_YEARS || 30) || 30)));
  const msDue = Date.now() + years * 365 * 24 * 60 * 60 * 1000;
  const due = admin.firestore.Timestamp.fromMillis(msDue);
  const patch = {
    isPremium: true,
    plan_status: "active",
    vencimientoMembresia: due,
    lastMercadoPagoPaymentId: String(payment.id || ""),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  let planKey = "";
  if (parsed.kind === "elite_suscripcion") {
    planKey = "elitecard";
    patch.elitecard_billing = parsed.eliteBilling === "monthly" ? "monthly" : "once";
  } else if (parsed.kind === "legacy_suscripcion") {
    planKey = parsed.plan;
  }
  if (planKey === "elitecard") {
    patch.status = "premium";
  } else {
    patch.status = "active";
  }
  if (planKey === "mascotbook") {
    patch.mascotbook_status = "active";
    patch.mascotbook_multi_unlocked = true;
    if (parsed.kind === "legacy_suscripcion") {
      patch.mascotas_permitidas = admin.firestore.FieldValue.increment(1);
    }
  } else if (planKey === "elitecard") {
    patch.elitecard_status = "active";
  } else {
    console.warn("[mp] tipo sin rama de membresía", parsed);
    return false;
  }
  await ref.set(patch, { merge: true });
  console.log("[mp] membresía activada", parsed.uid, planKey, parsed.kind);
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

function feedbackOriginFromReq(req) {
  const proto = String(req.get("x-forwarded-proto") || "https").split(",")[0].trim() || "https";
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  return host ? `${proto}://${host}` : "";
}

function appendQueryToAbsoluteUrl(fullUrl, additions) {
  const u = new URL(fullUrl);
  Object.entries(additions).forEach(([k, v]) => {
    if (v == null || v === undefined) return;
    const s = String(v);
    if (!s) return;
    u.searchParams.set(k, s);
  });
  return u.toString();
}

async function touchMembershipMpFeedback(uid, patch) {
  const u = String(uid || "").trim();
  if (!u) return;
  const admin = getAdmin();
  await admin
    .firestore()
    .collection(membershipCollectionName())
    .doc(u)
    .set(patch, { merge: true });
}

/**
 * Retorno navegador Checkout Pro (success / pending / failure): sincroniza Firestore y redirige al panel con mensaje.
 * Configurá en Hosting: rewrite `/mp/feedback` → esta función (misma región que el resto).
 */
exports.mercadoPagoFeedback = onRequest({ secrets: [mpAccessToken] }, async (req, res) => {
  if (req.method !== "GET") {
    res.status(405).send("Method Not Allowed");
    return;
  }
  const adm = getAdmin();
  const tsNow = () => adm.firestore.FieldValue.serverTimestamp();
  const origin = feedbackOriginFromReq(req);
  if (!origin) {
    res.status(500).send("Missing host");
    return;
  }

  const nextEnc = String(req.query.next || "").trim();
  let baseUrl = `${origin}/admin.html`;
  if (nextEnc) {
    try {
      const dec = decodeURIComponent(nextEnc);
      const nu = new URL(dec);
      if (nu.origin === origin) baseUrl = nu.toString();
    } catch (e1) {
      // mantener default
    }
  }

  const redirectWith = (extra) => {
    res.redirect(302, appendQueryToAbsoluteUrl(baseUrl, extra));
  };

  const paymentId = String(req.query.payment_id || req.query.collection_id || "").trim();
  const extRef = String(req.query.external_reference || "").trim();
  const parsed = extRef ? parseMercadoPagoExternalReference(extRef) : null;
  const uid = parsed && parsed.uid ? String(parsed.uid) : "";
  const selfPhase = String(req.query.mp_phase || "").toLowerCase();

  if (selfPhase === "failure" || selfPhase === "fail") {
    redirectWith({ pago: "fallido", ec_mp_feedback: "failure" });
    return;
  }
  if (selfPhase === "pending") {
    redirectWith({ pago: "pendiente", ec_mp_feedback: "pending" });
    return;
  }

  if (!paymentId) {
    const qs = String(req.query.status || req.query.collection_status || "").toLowerCase();
    if ((qs === "pending" || qs === "in_process") && uid) {
      try {
        await touchMembershipMpFeedback(uid, {
          lastMercadoPagoStatus: qs,
          updatedAt: tsNow(),
        });
      } catch (e2) {
        console.warn("[mp feedback] pending sin id", e2.message);
      }
    }
    redirectWith({
      pago: qs === "pending" || qs === "in_process" ? "pendiente" : "fallido",
      ec_mp_feedback: qs || "no_payment_id",
      external_reference: extRef || undefined,
    });
    return;
  }

  const token = mpAccessToken.value();
  const payment = await mpGetPayment(paymentId, token);
  if (!payment) {
    redirectWith({ pago: "fallido", ec_mp_feedback: "payment_not_found", payment_id: paymentId });
    return;
  }

  const ps = String(payment.status || "").toLowerCase();

  if (ps === "approved") {
    try {
      await applyMembershipAfterApproved(payment);
    } catch (err) {
      console.error("[mp feedback] apply", err);
    }
    redirectWith({
      pago: "exitoso",
      ec_mp_msg: EC_MP_SUCCESS_FEEDBACK_COPY,
      payment_id: paymentId,
      external_reference: String(payment.external_reference || extRef || "") || undefined,
    });
    return;
  }

  if (ps === "pending" || ps === "in_process" || ps === "authorized") {
    if (uid) {
      try {
        await touchMembershipMpFeedback(uid, {
          lastMercadoPagoStatus: ps,
          lastMercadoPagoPaymentId: paymentId,
          updatedAt: tsNow(),
        });
      } catch (e3) {
        console.warn("[mp feedback] pending", e3.message);
      }
    }
    redirectWith({
      pago: "pendiente",
      ec_mp_feedback: ps,
      payment_id: paymentId,
    });
    return;
  }

  if (uid) {
    try {
      await touchMembershipMpFeedback(uid, {
        lastMercadoPagoStatus: ps || "failure",
        lastMercadoPagoPaymentId: paymentId,
        updatedAt: tsNow(),
      });
    } catch (e4) {
      console.warn("[mp feedback] failure touch", e4.message);
    }
  }
  redirectWith({
    pago: "fallido",
    ec_mp_feedback: ps || "failure",
    payment_id: paymentId,
  });
});

/** Callable — crea preferencia Checkout Pro con SDK oficial (token solo en servidor). */
exports.createMercadoPagoPreference = onCall({ secrets: [mpAccessToken], cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Sesión requerida");
  }
  const uid = request.auth.uid;
  const data = request.data && typeof request.data === "object" ? request.data : {};
  const idPerfil = String(data.idPerfil || "").trim();
  const tipoPlanRaw = String(data.tipoPlan || "mascotbook").toLowerCase();
  const tipoPlan = tipoPlanRaw === "elitecard" ? "elitecard" : "mascotbook";
  const returnBase = String(data.returnBase || "").trim().replace(/\/$/, "");
  if (!returnBase || !/^https?:\/\//i.test(returnBase)) {
    throw new HttpsError("invalid-argument", "returnBase debe ser una URL http(s) absoluta");
  }
  const productoRaw = String(data.producto || "").trim().toLowerCase();

  let ext = "";
  let items = [];
  let metaProducto = "";
  let multimascotaDiscountApplied = false;
  let activeMascotasCount = 0;
  let mascotAddonEffectiveUnit = null;

  if (productoRaw === "elite_suscripcion") {
    const eliteBilling = String(data.eliteBilling || "once").toLowerCase() === "monthly" ? "monthly" : "once";
    ext = buildMercadoPagoExternalReference({ producto: "elite_suscripcion", uid, eliteBilling });
    const unit = unitPriceEliteSuscripcion(eliteBilling);
    const title =
      eliteBilling === "monthly" ? "Suscripción EliteCard (mensual)" : "Suscripción EliteCard (pago único)";
    items = [
      {
        title,
        description: "EliteCard — WebElite",
        quantity: 1,
        currency_id: "ARS",
        unit_price: Number(unit) || 1,
      },
    ];
    metaProducto = "elite_suscripcion";
  } else if (productoRaw === "mascota_adicional") {
    const cantidad = Math.max(1, Math.min(999, Math.floor(Number(data.cantidad) || 1)));
    const mascotId = String(data.mascotId || "").trim();
    const nuevaMascota = !!data.nuevaMascota || !mascotId;
    ext = buildMercadoPagoExternalReference({ producto: "mascota_adicional", uid, cantidad, nuevaMascota, mascotId });
    activeMascotasCount = await countMascotasActiveSlotsForUid(uid);
    multimascotaDiscountApplied = activeMascotasCount >= 1;
    const baseUnit = Number(unitPriceMascotaAdicional()) || 1;
    let unit = baseUnit;
    if (multimascotaDiscountApplied) {
      unit = Math.max(1, Math.round(baseUnit * MP_MASCOTA_ADICIONAL_MULTIMASCOTA_FACTOR));
    }
    mascotAddonEffectiveUnit = unit;
    items = [
      {
        title: multimascotaDiscountApplied
          ? "Mascota Adicional · MascotBook (50% OFF multi-mascota)"
          : "Mascota Adicional · MascotBook",
        description: multimascotaDiscountApplied
          ? "Beneficio: ya tenés al menos un perfil activo (multi-mascota)"
          : "Unidad adicional MascotBook",
        quantity: cantidad,
        currency_id: "ARS",
        unit_price: unit,
      },
    ];
    metaProducto = "mascota_adicional";
  } else {
    ext = buildMercadoPagoExternalReference({ producto: "legacy", uid, tipoPlan, idPerfil });
    const unit = unitPriceLegacyPlan(tipoPlan);
    const title =
      tipoPlan === "mascotbook" ? "MascotBook · Suscripción anual" : "WebElite / EliteCard · Suscripción anual";
    items = [
      {
        title,
        description: "Activación premium (acceso extendido)",
        quantity: 1,
        currency_id: "ARS",
        unit_price: Number(unit) || 1,
      },
    ];
    metaProducto = "legacy_" + tipoPlan;
  }

  if (!ext) {
    throw new HttpsError("internal", "No se pudo armar external_reference");
  }

  const token = mpAccessToken.value();
  const q = returnBase.indexOf("?") >= 0 ? "&" : "?";
  const planQuery =
    productoRaw === "elite_suscripcion" ? "elitecard" : productoRaw === "mascota_adicional" ? "mascotbook" : tipoPlan;
  const eliteBillingQ =
    productoRaw === "elite_suscripcion"
      ? String(data.eliteBilling || "once").toLowerCase() === "monthly"
        ? "monthly"
        : "once"
      : "";
  let successUrl;
  let pendUrl;
  let failUrl;
  try {
    const ru = new URL(returnBase);
    const o = ru.origin;
    const aug = new URL(returnBase);
    aug.searchParams.set("id", uid);
    aug.searchParams.set("plan", planQuery);
    if (idPerfil) aug.searchParams.set("perfil", idPerfil);
    aug.searchParams.set("mp_producto", metaProducto);
    if (eliteBillingQ) aug.searchParams.set("elite_billing", eliteBillingQ);
    const nextEnc = encodeURIComponent(aug.toString());
    const fb = `${o}/mp/feedback?next=${nextEnc}`;
    successUrl = fb;
    pendUrl = `${fb}&mp_phase=pending`;
    failUrl = `${fb}&mp_phase=failure`;
  } catch (eFb) {
    successUrl =
      returnBase +
      q +
      "pago=exitoso&id=" +
      encodeURIComponent(uid) +
      "&plan=" +
      encodeURIComponent(planQuery) +
      (idPerfil ? "&perfil=" + encodeURIComponent(idPerfil) : "") +
      "&mp_producto=" +
      encodeURIComponent(metaProducto) +
      (eliteBillingQ ? "&elite_billing=" + encodeURIComponent(eliteBillingQ) : "");
    pendUrl = returnBase + q + "pago=pendiente";
    failUrl = returnBase + q + "pago=fallido";
  }
  /**
   * Checkout Pro: redirección automática solo cuando el pago queda approved.
   * Mercado Pago agrega a la URL de éxito (p. ej. /mp/feedback o returnBase) query params como payment_id y status.
   * La activación en Firestore no depende del webhook: el cliente llama verifyMercadoPagoPayment con ese payment_id.
   */
  const prefBody = {
    items,
    external_reference: ext,
    metadata: {
      ec_uid: uid,
      ec_producto: metaProducto,
    },
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
    String(data.idempotencyKey || "").trim() ||
    `ec-pref-${uid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  let j;
  try {
    j = await crearPreferenciaMercadoPago(token, prefBody, idem);
  } catch (err) {
    const msg = (err && (err.message || err.cause || err.error)) || String(err);
    console.error("[mp] preference SDK error", err);
    throw new HttpsError("internal", typeof msg === "string" ? msg.slice(0, 300) : "Error creando preferencia MP");
  }
  const initPoint = j.init_point || j.sandbox_init_point;
  if (!initPoint) {
    throw new HttpsError("internal", "Respuesta MP sin init_point");
  }
  const out = {
    init_point: initPoint,
    preference_id: j.id || null,
    external_reference: ext,
  };
  if (productoRaw === "mascota_adicional") {
    out.mascot_addon_multimascota_discount = multimascotaDiscountApplied;
    out.mascot_addon_active_mascotas_count = activeMascotasCount;
    if (mascotAddonEffectiveUnit != null) {
      out.mascot_addon_unit_price = mascotAddonEffectiveUnit;
    }
  }
  return out;
});

/**
 * Crea tarjetas/{id} + mascotas/{id} en servidor: primer perfil gratis, plan activo/premium sin consumir crédito,
 * perfil extra requiere mascotbookExtraProfileCredits >= 1 (se descuenta 1). Membresía con role admin: siempre gratis.
 */
exports.allocateNewMascotProfile = onCall({ cors: true }, async (request) => {
  try {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "Sesión requerida");
    }
    const uid = request.auth.uid;
    const initialName = String((request.data && request.data.initialName) || "")
      .trim()
      .slice(0, 200) || "Mi mascota";
    const admin = getAdmin();
    const db = admin.firestore();
    const countSnap = await db.collection("mascotas").where("ownerUid", "==", uid).get();
    const nActive = countMascotasActiveSlots(countSnap);
    if (nActive >= 5) {
      throw new HttpsError("resource-exhausted", "Alcanzaste el límite de 5 perfiles MascotBook.");
    }
    const col = membershipCollectionName();
    const memRef = db.collection(col).doc(uid);
    const memSnap = await memRef.get();
    const m = memSnap.exists ? memSnap.data() || {} : {};
    const isMembershipAdmin = String(m.role || "").trim().toLowerCase() === "admin";
    const hasSubscription =
      m.isPremium === true ||
      m.mascotbook_multi_unlocked === true ||
      String(m.mascotbook_status || "").toLowerCase() === "active";
    const credits = Number(m.mascotbookExtraProfileCredits || 0);
    let useCredit = false;
    if (isMembershipAdmin) {
      useCredit = false;
    } else if (nActive < 1) {
      useCredit = false;
    } else if (hasSubscription) {
      useCredit = false;
    } else if (credits >= 1) {
      useCredit = true;
    } else {
      throw new HttpsError("failed-precondition", "Se requiere activar un perfil adicional (pago pendiente).");
    }

    const tarRef = db.collection("tarjetas").doc();
    const mascRef = db.collection("mascotas").doc();
    const email = request.auth.token && request.auth.token.email ? String(request.auth.token.email).slice(0, 256) : "";
    const ts = admin.firestore.FieldValue.serverTimestamp();

    await db.runTransaction(async (tx) => {
      if (useCredit) {
        const s = await tx.get(memRef);
        const md = s.exists ? s.data() || {} : {};
        const cr = Number(md.mascotbookExtraProfileCredits || 0);
        if (cr < 1) {
          throw new HttpsError("failed-precondition", "Sin créditos de perfil disponibles.");
        }
        tx.set(
          memRef,
          {
            mascotbookExtraProfileCredits: cr - 1,
            updatedAt: ts,
          },
          { merge: true }
        );
      }
      tx.set(tarRef, {
        ownerUid: uid,
        ownerEmail: email,
        mascotaNombre: initialName,
        publicCardId: mascRef.id,
        tipo: "mascotbook",
        createdAt: ts,
      });
      tx.set(
        mascRef,
        {
          nombre: initialName,
          ownerUid: uid,
          ownerEmail: email,
          mascotId: mascRef.id,
          mbProfileStatus: "active",
          createdAt: ts,
          updatedAt: ts,
        },
        { merge: false }
      );
    });

    return { tarjetaDocId: tarRef.id, mascotDocId: mascRef.id };
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error("[allocateNewMascotProfile]", err);
    throw new HttpsError(
      "failed-precondition",
      "No se pudo crear el perfil. Si el problema continúa, cerrá sesión y volvé a intentar."
    );
  }
});

/**
 * Verificación explícita desde el cliente tras volver del Checkout (no depende del webhook).
 * Consulta GET /v1/payments/:id con el token de servidor y aplica Firestore si está approved.
 */
exports.verifyMercadoPagoPayment = onCall({ secrets: [mpAccessToken], cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Sesión requerida");
  }
  const uid = request.auth.uid;
  const paymentId = String((request.data && request.data.paymentId) || "").trim();
  if (!paymentId) {
    throw new HttpsError("invalid-argument", "paymentId requerido");
  }
  const token = mpAccessToken.value();
  const payment = await mpGetPayment(paymentId, token);
  if (!payment) {
    throw new HttpsError("not-found", "No se encontró el pago en Mercado Pago");
  }
  const parsed = parseMercadoPagoExternalReference(payment.external_reference);
  if (!parsed || String(parsed.uid) !== String(uid)) {
    throw new HttpsError("permission-denied", "Este pago no corresponde a tu cuenta");
  }
  const ps = String(payment.status || "").toLowerCase();
  if (ps !== "approved") {
    return {
      ok: true,
      status: ps || "unknown",
      applied: false,
      paymentId,
      kind: parsed.kind,
      external_reference: String(payment.external_reference || ""),
    };
  }
  try {
    const applied = await applyMembershipAfterApproved(payment);
    return {
      ok: true,
      status: "approved",
      applied: !!applied,
      paymentId,
      kind: parsed.kind,
      external_reference: String(payment.external_reference || ""),
    };
  } catch (err) {
    console.error("[mp verify] apply", err);
    throw new HttpsError("internal", err.message || "No se pudo aplicar el pago");
  }
});

/** Confirma pago MP desde el retorno (callback) y acredita igual que el webhook (idempotente). */
exports.confirmMascotAddonPayment = onCall({ secrets: [mpAccessToken], cors: true }, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Sesión requerida");
  }
  const paymentId = String((request.data && request.data.paymentId) || "").trim();
  if (!paymentId) {
    throw new HttpsError("invalid-argument", "paymentId requerido");
  }
  const token = mpAccessToken.value();
  const payment = await mpGetPayment(paymentId, token);
  if (!payment) {
    throw new HttpsError("not-found", "Pago no encontrado");
  }
  if (String(payment.status || "").toLowerCase() !== "approved") {
    throw new HttpsError("failed-precondition", "El pago no está aprobado");
  }
  const parsed = parseMercadoPagoExternalReference(payment.external_reference);
  if (!parsed || parsed.kind !== "mascota_adicional" || parsed.uid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Este pago no corresponde a un perfil adicional de tu cuenta");
  }
  const r = await fulfillMascotaAdicionalApprovedPayment(payment, parsed);
  if (!r.ok) {
    throw new HttpsError("internal", String(r.reason || "No se pudo acreditar el pago"));
  }
  return { success: true, ...r };
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
