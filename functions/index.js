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

    try {
      const snap = await getAdmin()
        .firestore()
        .collection("usuarios")
        .doc(uid)
        .get();

      let name = "EliteCard";
      let shortName = "EliteCard";
      let iconSrc = origin + "/icons/icon-192.png";
      let icon512 = origin + "/icons/icon-512.png";
      let icon512m = origin + "/icons/icon-512-maskable.png";

      if (snap.exists) {
        const d = snap.data();
        const nombreCompleto = String(d.nombreCompleto || "").trim();
        const cargo = String(d.cargo || "").trim();
        const logoUrl = String(d.logoUrl || "").trim();
        const fotoUrl = String(d.fotoUrl || d.photoURL || "").trim();

        if (nombreCompleto) {
          name = cargo
            ? nombreCompleto + " — " + cargo
            : nombreCompleto;
          shortName = nombreCompleto.length > 12
            ? nombreCompleto.split(" ")[0]
            : nombreCompleto;
        }
        if (logoUrl) iconSrc = logoUrl;
        else if (fotoUrl) iconSrc = fotoUrl;
        icon512 = iconSrc;
        icon512m = iconSrc;
      }

      const startUrl = origin + "/?id=" + encodeURIComponent(uid);

      const manifest = {
        id: startUrl,
        name: name,
        short_name: shortName,
        description: "Tarjeta digital profesional — EliteCard",
        lang: "es",
        dir: "ltr",
        start_url: startUrl,
        scope: origin + "/?id=" + encodeURIComponent(uid),
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
    const origin = "https://tarjeta-profesional-pedro.web.app";

    if (!uid || uid.length > 256 || uid.indexOf("/") >= 0) {
      res.redirect(301, origin + "/");
      return;
    }

    try {
      const snap = await getAdmin()
        .firestore()
        .collection("usuarios")
        .doc(uid)
        .get();

      let ogTitle = "EliteCard | Tarjeta Profesional Digital";
      let ogDesc = "Hacé clic para ver mis datos de contacto.";
      let ogImage = origin + "/icons/icon-512.png";
      const cardUrl = origin + "/?id=" + encodeURIComponent(uid);

      if (snap.exists) {
        const d = snap.data();
        const nombre = String(d.nombreCompleto || "").trim();
        const cargo = String(d.cargo || "").trim();
        const bio = String(d.bio || "").trim();
        const foto = String(d.fotoUrl || d.photoURL || "").trim();
        const logo = String(d.logoUrl || "").trim();

        if (nombre) {
          ogTitle = cargo
            ? nombre + " — " + cargo + " | EliteCard"
            : nombre + " | EliteCard";
        }
        ogDesc = bio || (nombre && cargo
          ? nombre + ", " + cargo + ". Tarjeta digital profesional."
          : ogDesc);
        if (foto) ogImage = foto;
        else if (logo) ogImage = logo;
      }

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
      res.redirect(301, origin + "/?id=" + encodeURIComponent(uid));
    }
  });
