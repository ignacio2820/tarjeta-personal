/**
 * Carga perezosa de firebase-admin: evita timeout del CLI al analizar el backend
 * ("User code failed to load... Timeout after 10000").
 */
const functions = require("firebase-functions");

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
exports.manifest = functions
  .region("us-east1")
  .https.onRequest(async (req, res) => {
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
exports.card = functions
  .region("us-east1")
  .https.onRequest(async (req, res) => {
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
