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
      "https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=3&color=000000&bgcolor=FFFFFF&data=" +
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
      '<td width="30" style="width:30px;padding:0 8px 6px 0;vertical-align:top;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.35;color:#0f172a;">' +
      symbolHtml +
      "</td>"
    );
  }

  function sigTextRow(iconSymbol, innerHtml) {
    return (
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">' +
      "<tr>" +
      sigIconCell(iconSymbol) +
      '<td style="padding:0 0 6px 0;vertical-align:top;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#1e293b;">' +
      innerHtml +
      "</td>" +
      "</tr>" +
      "</table>"
    );
  }

  function linkStyle() {
    return "color:#1e40af;font-weight:600;text-decoration:underline;text-underline-offset:2px;";
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
    if (mail) lines.push("📧 " + mail);
    if (trimStr(p.telefono)) lines.push("📞 " + trimStr(p.telefono));
    var wa = displayWhatsapp(p);
    if (wa) lines.push("💬 " + wa);
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
        "&#128231;",
        '<a href="mailto:' + escapeAttr(email) + '" style="' + linkStyle() + '">' + emEsc + "</a>"
      );
    }
    if (phone) {
      var phEsc = escapeHtml(phone);
      var tUri = escapeAttr(telUri(phone));
      contactBlocks += sigTextRow(
        "&#128222;",
        '<a href="' + tUri + '" style="' + linkStyle() + '">' + phEsc + "</a>"
      );
    }
    if (whatsapp && waMeUrl(whatsapp)) {
      var waEsc = escapeHtml(whatsapp);
      var waUri = escapeAttr(waMeUrl(whatsapp));
      contactBlocks += sigTextRow(
        "&#128172;",
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
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:19px;font-weight:800;color:#0f172a;line-height:1.2;padding:0 0 5px 0;letter-spacing:-0.02em;">' +
        name +
        "</div>";
    }
    if (cargo) {
      nameBlock +=
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#334155;line-height:1.35;padding:0 0 3px 0;">' +
        cargo +
        "</div>";
    }
    if (empresa) {
      nameBlock +=
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:normal;color:#475569;line-height:1.35;padding:0 0 12px 0;">' +
        empresa +
        "</div>";
    } else if (cargo || name) {
      nameBlock += '<div style="font-size:0;line-height:8px;">&nbsp;</div>';
    }

    var logoEsc = escapeHtml(logoSrc);
    var logoAlt = escapeHtml(name || "Logo institucional");

    var inner =
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;table-layout:fixed;width:100%;">' +
      "<tr>" +
      '<td valign="top" width="78" style="vertical-align:top;padding:0 10px 0 0;width:78px;">' +
      '<img src="' +
      logoEsc +
      '" width="68" height="68" alt="' +
      logoAlt +
      '" style="display:block;width:68px;height:68px;border-radius:50%;object-fit:cover;border:1px solid #e2e8f0;" />' +
      "</td>" +
      '<td valign="top" style="vertical-align:top;padding:0 0 0 12px;border-left:2px solid #0f172a;max-width:260px;overflow-wrap:break-word;word-wrap:break-word;">' +
      nameBlock +
      contactBlocks +
      "</td>" +
      '<td valign="middle" align="right" width="108" style="vertical-align:middle;text-align:right;width:108px;padding:8px 0 8px 16px;white-space:nowrap;">' +
      '<a href="' +
      escapeAttr(cardUrlTrim) +
      '" style="text-decoration:none;border:0;display:inline-block;line-height:0;" title="Tarjeta digital">' +
      '<img src="' +
      qrSrc +
      '" width="100" height="100" alt="QR EliteCard" style="display:block;width:100px;height:100px;max-width:100px;max-height:100px;border:0;object-fit:contain;" />' +
      "</a>" +
      "</td>" +
      "</tr>" +
      "</table>";

    return (
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="ec-elite-mail-sig" width="100%" style="border-collapse:collapse;max-width:560px;background:#ffffff;">' +
      "<tr>" +
      '<td style="padding:18px 20px 18px 14px;border:1px solid #e5e7eb;border-radius:10px;">' +
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
