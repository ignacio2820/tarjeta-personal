/**
 * Firma de correo EliteCard — admin y tarjeta pública.
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

  function cardUrlFromOrigin(origin, uid) {
    var o = String(origin || "").replace(/\/$/, "");
    return o + "/card.html?id=" + encodeURIComponent(String(uid || "").trim());
  }

  function buildEliteMailSigText(p, cardUrl) {
    var lines = [];
    var name = p.user_nombre || p.nombreCompleto || "";
    if (name) lines.push(name);
    var role = [p.user_cargo || p.cargo, p.user_empresa || p.empresa].filter(Boolean).join(" · ");
    if (role) lines.push(role);
    if (p.telefono) lines.push("Tel.: " + p.telefono);
    if (p.email) lines.push("Email: " + p.email);
    if (p.sitioWeb || (p.redes && p.redes.sitioWeb)) {
      lines.push("Web: " + String(p.sitioWeb || (p.redes && p.redes.sitioWeb) || ""));
    }
    lines.push("");
    lines.push("Mi tarjeta digital: " + cardUrl);
    return lines.join("\n");
  }

  function buildEliteMailSigHtml(p, cardUrl) {
    var name = escapeHtml(p.user_nombre || p.nombreCompleto || "");
    var role = escapeHtml(
      [p.user_cargo || p.cargo, p.user_empresa || p.empresa].filter(Boolean).join(" · ")
    );
    var bits = [];
    if (name) bits.push("<strong class=\"ec-mail-sig-name\">" + name + "</strong>");
    if (role) bits.push("<span class=\"ec-mail-sig-role\">" + role + "</span>");
    if (p.telefono) bits.push("<span class=\"ec-mail-sig-line\">Tel.: " + escapeHtml(p.telefono) + "</span>");
    if (p.email) {
      bits.push(
        "<span class=\"ec-mail-sig-line\">Email: <a href=\"mailto:" +
          escapeHtml(p.email) +
          "\">" +
          escapeHtml(p.email) +
          "</a></span>"
      );
    }
    bits.push(
      "<span class=\"ec-mail-sig-line\"><a href=\"" +
        escapeHtml(cardUrl) +
        "\">Ver mi tarjeta digital</a></span>"
    );
    return '<div class="ec-mail-sig-inner">' + bits.join("<br/>") + "</div>";
  }

  global.EliteMailSig = {
    escapeHtml: escapeHtml,
    cardUrlFromOrigin: cardUrlFromOrigin,
    buildEliteMailSigText: buildEliteMailSigText,
    buildEliteMailSigHtml: buildEliteMailSigHtml,
  };
})(typeof window !== "undefined" ? window : this);
