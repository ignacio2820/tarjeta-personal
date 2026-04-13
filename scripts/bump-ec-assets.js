#!/usr/bin/env node
/**
 * Actualiza solo <meta name="ec-asset-version"> (referencia de build / diagnóstico).
 * Los JS/CSS locales usan ?v=Date.now() en cada carga (index.html / admin.html).
 * Ejecutar antes de deploy: npm run bump-assets
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

  fs.writeFileSync(p, s);
}

files.forEach(bumpHtml);
console.log("[bump-ec-assets] ec-asset-version =", v);
