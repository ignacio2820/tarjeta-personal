#!/usr/bin/env node
/**
 * Actualiza <meta name="ec-asset-version"> y los parámetros ?v= de los JS/CSS locales
 * en index.html y admin.html. Ejecutar antes de cada deploy: npm run bump-assets
 */
"use strict";

var fs = require("fs");
var path = require("path");

var root = path.join(__dirname, "..");
var v = String(Date.now());

var files = ["index.html", "admin.html"];

function bumpHtml(rel) {
  var p = path.join(root, rel);
  var s = fs.readFileSync(p, "utf8");

  if (!/<meta\s+name="ec-asset-version"/i.test(s)) {
    if (/<meta\s+charset=/i.test(s)) {
      s = s.replace(
        /(<meta\s+charset="[^"]*"\s*\/?>)/i,
        "$1\n    <meta name=\"ec-asset-version\" content=\"" + v + "\" />"
      );
    } else {
      s = s.replace(/<head(\s[^>]*)?>/i, function (m) {
        return m + "\n    <meta name=\"ec-asset-version\" content=\"" + v + "\" />";
      });
    }
  } else {
    s = s.replace(
      /(<meta\s+name="ec-asset-version"\s+content=")[^"]*(")/gi,
      "$1" + v + "$2"
    );
  }

  s = s.replace(
    /(\s(?:href|src)=")([^"]*(?:firebase-config|config|card-app|styles)\.(?:js|css))(\?v=)(\d+)(")/gi,
    function (m, pre, url, q, old, post) {
      if (/^https?:\/\//i.test(url)) return m;
      return pre + url + q + v + post;
    }
  );

  s = s.replace(
    /(\s(?:href|src)=")([^"]*(?:firebase-config|config|card-app|styles)\.(?:js|css))(")/gi,
    function (m, pre, url, quote) {
      if (/^https?:\/\//i.test(url)) return m;
      if (/\?v=/.test(url)) return m;
      return pre + url + "?v=" + v + quote;
    }
  );

  fs.writeFileSync(p, s);
}

files.forEach(bumpHtml);
console.log("[bump-ec-assets] ec-asset-version =", v);
