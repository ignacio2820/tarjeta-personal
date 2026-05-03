/**
 * Firma de correo EliteCard — HTML con tablas (Outlook/Gmail).
 * Referencia: assets/signature-template.png
 */
(function (global) {
  "use strict";

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function trimStr(s) {
    return String(s || "").trim();
  }

  function cardUrlFromOrigin(origin, uid) {
    var o = String(origin || "").replace(/\/$/, "");
    return o + "/card.html?id=" + encodeURIComponent(String(uid || "").trim());
  }

  function baseOriginFromCardUrl(cardUrl) {
    try {
      return new URL(String(cardUrl || "").trim()).origin;
    } catch (e) {
      return "";
    }
  }

  function absoluteAssetUrl(url, origin) {
    var u = trimStr(url);
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    var o = String(origin || "").replace(/\/$/, "");
    if (!o) return u;
    return u.charAt(0) === "/" ? o + u : o + "/" + u.replace(/^\.\//, "");
  }

  function defaultInstitutionalLogo(origin) {
    return absoluteAssetUrl("assets/logo10.png?v=4", origin);
  }

  function qrImageUrl(cardUrl) {
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=128x128&margin=3&color=000000&bgcolor=FFFFFF&data=" +
      encodeURIComponent(String(cardUrl || "").trim())
    );
  }

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function telUri(raw) {
    var d = digitsOnly(raw);
    if (!d) return "";
    return "tel:+" + d;
  }

  function waMeUrl(raw) {
    var d = digitsOnly(raw);
    if (!d) return "";
    return "https://wa.me/" + d;
  }

  function displayName(p) {
    return trimStr(p.user_nombre || p.nombreCompleto || "");
  }

  /** Cargo / título (línea principal bajo el nombre, como en la plantilla). */
  function displayCargo(p) {
    return trimStr(p.user_cargo || p.cargo);
  }

  /** Empresa en segunda línea opcional. */
  function displayEmpresa(p) {
    return trimStr(p.user_empresa || p.empresa);
  }

  function displayEmail(p) {
    return trimStr(p.emailInstitucional || p.email || "");
  }

  function displayWhatsapp(p) {
    return trimStr(p.whatsappNumero || (p.redes && p.redes.whatsappNumero) || "");
  }

  function sigIconCell(symbolHtml) {
    return (
      '<td width="24" style="width:24px;padding:0 10px 5px 0;vertical-align:top;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#111111;">' +
      symbolHtml +
      "</td>"
    );
  }

  function sigTextRow(iconSymbol, innerHtml) {
    return (
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">' +
      "<tr>" +
      sigIconCell(iconSymbol) +
      '<td style="padding:0 0 5px 0;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#111111;">' +
      innerHtml +
      "</td>" +
      "</tr>" +
      "</table>"
    );
  }

  function linkStyle() {
    return "color:#111111;text-decoration:underline;text-underline-offset:2px;";
  }

  function buildEliteMailSigText(p, cardUrl) {
    var lines = [];
    var name = displayName(p);
    if (name) lines.push(name);
    var cg = displayCargo(p);
    if (cg) lines.push(cg);
    var em = displayEmpresa(p);
    if (em) lines.push(em);
    var mail = displayEmail(p);
    if (mail) lines.push("Email: " + mail);
    if (trimStr(p.telefono)) lines.push("Tel.: " + trimStr(p.telefono));
    var wa = displayWhatsapp(p);
    if (wa) lines.push("WhatsApp: " + wa);
    lines.push("");
    lines.push("Tarjeta digital: " + String(cardUrl || "").trim());
    return lines.join("\n");
  }

  /**
   * Firma HTML: logo circular | borde izquierdo (divisor) + datos | QR arriba alineado con el nombre.
   */
  function buildEliteMailSigHtml(p, cardUrl) {
    var origin = baseOriginFromCardUrl(cardUrl);
    var logoSrc = absoluteAssetUrl(p.logoUrl, origin) || defaultInstitutionalLogo(origin);
    var name = escapeHtml(displayName(p));
    var cargo = escapeHtml(displayCargo(p));
    var empresa = escapeHtml(displayEmpresa(p));
    var email = displayEmail(p);
    var phone = trimStr(p.telefono);
    var whatsapp = displayWhatsapp(p);
    var cardUrlTrim = String(cardUrl || "").trim();
    var qrSrc = escapeHtml(qrImageUrl(cardUrlTrim));

    var contactBlocks = "";
    if (email) {
      var emEsc = escapeHtml(email);
      contactBlocks += sigTextRow(
        "&#9993;",
        '<a href="mailto:' + escapeAttr(email) + '" style="' + linkStyle() + '">' + emEsc + "</a>"
      );
    }
    if (phone) {
      var phEsc = escapeHtml(phone);
      var tUri = escapeAttr(telUri(phone));
      contactBlocks += sigTextRow(
        "&#9742;",
        '<a href="' + tUri + '" style="' + linkStyle() + '">' + phEsc + "</a>"
      );
    }
    if (whatsapp && waMeUrl(whatsapp)) {
      var waEsc = escapeHtml(whatsapp);
      var waUri = escapeAttr(waMeUrl(whatsapp));
      contactBlocks += sigTextRow(
        '<span style="display:inline-block;width:15px;height:15px;line-height:15px;text-align:center;border-radius:3px;background:#25D366;color:#ffffff;font-size:9px;font-weight:bold;font-family:Arial,sans-serif;">W</span>',
        '<a href="' + waUri + '" style="' + linkStyle() + '">' + waEsc + "</a>"
      );
    }

    if (!name && !cargo && !empresa && !contactBlocks) {
      return (
        '<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="ec-elite-mail-sig" width="100%" style="border-collapse:collapse;max-width:560px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;"><tr><td style="padding:12px;">Completá nombre, email o teléfono para generar la firma.</td></tr></table>'
      );
    }

    var nameBlock = "";
    if (name) {
      nameBlock +=
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#111111;line-height:1.25;padding:0 0 2px 0;">' +
        name +
        "</div>";
    }
    if (cargo) {
      nameBlock +=
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:normal;color:#111111;line-height:1.35;padding:0 0 2px 0;">' +
        cargo +
        "</div>";
    }
    if (empresa) {
      nameBlock +=
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:normal;color:#333333;line-height:1.35;padding:0 0 10px 0;">' +
        empresa +
        "</div>";
    } else if (cargo || name) {
      nameBlock += '<div style="font-size:0;line-height:10px;">&nbsp;</div>';
    }

    var logoEsc = escapeHtml(logoSrc);
    var logoAlt = escapeHtml(name || "Logo institucional");

    var inner =
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">' +
      "<tr>" +
      '<td valign="top" style="vertical-align:top;padding:0 14px 0 0;">' +
      '<img src="' +
      logoEsc +
      '" width="72" height="72" alt="' +
      logoAlt +
      '" style="display:block;width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid #dddddd;" />' +
      "</td>" +
      '<td valign="top" style="vertical-align:top;padding:0 0 0 14px;border-left:1px solid #111111;">' +
      nameBlock +
      contactBlocks +
      "</td>" +
      '<td valign="top" align="right" style="vertical-align:top;text-align:right;padding:0 0 0 16px;">' +
      '<a href="' +
      escapeAttr(cardUrlTrim) +
      '" style="text-decoration:none;border:0;display:inline-block;" title="Tarjeta digital">' +
      '<img src="' +
      qrSrc +
      '" width="128" height="128" alt="QR EliteCard" style="display:block;width:128px;height:128px;border:0;" />' +
      "</a>" +
      "</td>" +
      "</tr>" +
      "</table>";

    return (
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="ec-elite-mail-sig" width="100%" style="border-collapse:collapse;max-width:560px;background:#ffffff;">' +
      "<tr>" +
      '<td style="padding:12px 16px;border:1px solid #e8e8e8;border-radius:8px;">' +
      inner +
      "</td>" +
      "</tr>" +
      "</table>"
    );
  }

  global.EliteMailSig = {
    escapeHtml: escapeHtml,
    cardUrlFromOrigin: cardUrlFromOrigin,
    buildEliteMailSigText: buildEliteMailSigText,
    buildEliteMailSigHtml: buildEliteMailSigHtml,
  };
})(typeof window !== "undefined" ? window : this);
