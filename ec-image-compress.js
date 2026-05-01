/**
 * Compresión client-side de imágenes antes de Firebase Storage (EliteCard + MascotBook).
 * Solo Canvas API. No modifica Firestore ni rutas de Storage.
 */
(function (global) {
  "use strict";

  var DEFAULT_MAX_EDGE = 1200;
  var DEFAULT_MIN_BYTES = 200 * 1024;
  var DEFAULT_MAX_BYTES = 400 * 1024;

  function supportsWebp() {
    try {
      var c = document.createElement("canvas");
      c.width = 1;
      c.height = 1;
      return String(c.toDataURL("image/webp") || "").indexOf("data:image/webp") === 0;
    } catch (e) {
      return false;
    }
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise(function (resolve) {
      try {
        if (canvas.toBlob) {
          canvas.toBlob(
            function (blob) {
              resolve(blob || null);
            },
            mime,
            quality
          );
        } else {
          var dataUrl = canvas.toDataURL(mime, quality);
          var parts = dataUrl.split(",");
          var bin = atob(parts[1] || "");
          var n = bin.length;
          var u8 = new Uint8Array(n);
          for (var i = 0; i < n; i++) u8[i] = bin.charCodeAt(i);
          resolve(new Blob([u8], { type: mime }));
        }
      } catch (e) {
        resolve(null);
      }
    });
  }

  function loadImageSource(file) {
    if (global.createImageBitmap) {
      try {
        return global
          .createImageBitmap(file, { imageOrientation: "from-image" })
          .then(function (bmp) {
            return { draw: bmp, w: bmp.width, h: bmp.height, bitmap: bmp };
          });
      } catch (e0) {}
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({ draw: img, w: img.naturalWidth, h: img.naturalHeight, bitmap: null });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("load_image"));
      };
      img.src = url;
    });
  }

  function closeBitmap(src) {
    try {
      if (src && src.bitmap && typeof src.bitmap.close === "function") src.bitmap.close();
    } catch (e) {}
  }

  function pickMime(preferred) {
    var p = String(preferred || "").toLowerCase();
    if (p === "image/webp" || p === "image/jpeg") return p;
    return supportsWebp() ? "image/webp" : "image/jpeg";
  }

  function buildCanvas(draw, tw, th, fillWhite) {
    var canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    var ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (fillWhite) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, tw, th);
    }
    try {
      ctx.drawImage(draw, 0, 0, tw, th);
    } catch (e) {
      return null;
    }
    return canvas;
  }

  /**
   * Elige calidad: prioridad tamaño <= maxBytes; si es posible, acercarse a minBytes.
   */
  function pickBlobFromCanvas(canvas, mime, minBytes, maxBytes) {
    var qualities = [0.9, 0.84, 0.78, 0.7, 0.62, 0.54, 0.46, 0.4, 0.36];
    var bestUnder = null;
    var inRange = null;
    var i = 0;

    function next() {
      if (inRange) return Promise.resolve(inRange);
      if (i >= qualities.length) {
        return Promise.resolve(inRange || bestUnder);
      }
      var q = qualities[i];
      i++;
      return canvasToBlob(canvas, mime, q).then(function (blob) {
        if (!blob || blob.size < 24) return next();
        if (blob.size <= maxBytes) {
          if (!bestUnder || blob.size > bestUnder.size) bestUnder = blob;
          if (blob.size >= minBytes && blob.size <= maxBytes) inRange = blob;
        }
        return next();
      });
    }

    return next().then(function (picked) {
      if (picked) return picked;
      return canvasToBlob(canvas, mime, 0.32);
    });
  }

  /**
   * @param {File|Blob} file
   * @param {{ maxEdge?: number, minBytes?: number, maxBytes?: number, outputMime?: string }} [opts]
   * @returns {Promise<Blob|File>}
   */
  function compressImageForUpload(file, opts) {
    opts = opts || {};
    if (!file || typeof file !== "object") return Promise.resolve(file);
    var mimeIn = String(file.type || "").toLowerCase();
    if (mimeIn.indexOf("image/") !== 0) return Promise.resolve(file);

    var maxEdge = typeof opts.maxEdge === "number" && opts.maxEdge > 0 ? opts.maxEdge : DEFAULT_MAX_EDGE;
    var minBytes =
      typeof opts.minBytes === "number" && opts.minBytes > 0 ? opts.minBytes : DEFAULT_MIN_BYTES;
    var maxBytes =
      typeof opts.maxBytes === "number" && opts.maxBytes > 0 ? opts.maxBytes : DEFAULT_MAX_BYTES;
    var outMime = pickMime(opts.outputMime);
    var fillWhite = outMime === "image/jpeg" || outMime === "image/webp";

    return loadImageSource(file)
      .then(function (src) {
        var w0 = src.w;
        var h0 = src.h;
        if (!w0 || !h0) throw new Error("bad_dims");

        function encodeScale(s) {
          var tw = Math.max(1, Math.round(w0 * s));
          var th = Math.max(1, Math.round(h0 * s));
          var canvas = buildCanvas(src.draw, tw, th, fillWhite);
          if (!canvas) return Promise.resolve(null);
          return pickBlobFromCanvas(canvas, outMime, minBytes, maxBytes);
        }

        var s0 = 1;
        if (Math.max(w0, h0) > maxEdge) {
          s0 = maxEdge / Math.max(w0, h0);
        }

        function tryEncode(s) {
          return encodeScale(s).then(function (blob) {
            if (blob && blob.size <= maxBytes * 1.08) {
              return blob;
            }
            var s2 = s * 0.86;
            if (Math.round(w0 * s2) < 400 || Math.round(h0 * s2) < 400) {
              return blob || null;
            }
            return tryEncode(s2);
          });
        }

        return tryEncode(s0).then(function (blob) {
          closeBitmap(src);
          if (!blob || blob.size < 32) return file;
          if (outMime === "image/webp" && blob.size > maxBytes * 1.1) {
            return loadImageSource(file).then(function (src2) {
              var s1 = Math.max(w0, h0) > maxEdge ? maxEdge / Math.max(w0, h0) : 1;
              var tw = Math.max(1, Math.round(w0 * s1));
              var th = Math.max(1, Math.round(h0 * s1));
              var cj = buildCanvas(src2.draw, tw, th, true);
              closeBitmap(src2);
              if (!cj) return blob;
              return pickBlobFromCanvas(cj, "image/jpeg", minBytes, maxBytes).then(function (b2) {
                return b2 && b2.size < blob.size ? b2 : blob;
              });
            });
          }
          return blob;
        });
      })
      .catch(function () {
        return file;
      });
  }

  global.EC_compressImageForUpload = compressImageForUpload;
  global.EC_imageCompressDefaults = {
    maxEdge: DEFAULT_MAX_EDGE,
    minBytes: DEFAULT_MIN_BYTES,
    maxBytes: DEFAULT_MAX_BYTES,
  };
})(typeof window !== "undefined" ? window : this);
