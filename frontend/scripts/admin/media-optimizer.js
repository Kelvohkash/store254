// Client-side image optimization pipeline: downscales oversized photos to UI-appropriate
// resolutions, strips EXIF/metadata via canvas re-encode, and converts to compact .webp.
(function (root) {
  "use strict";

  const UPLOAD_PRESETS = Object.freeze({
    logo: Object.freeze({
      maxWidth: 320,
      maxHeight: 320,
      targetBytes: 80 * 1024,
      initialQuality: 0.86,
      minQuality: 0.66,
      label: "logo",
    }),
    banner: Object.freeze({
      maxWidth: 1440,
      maxHeight: 800,
      targetBytes: 280 * 1024,
      initialQuality: 0.82,
      minQuality: 0.62,
      label: "banner",
    }),
    product: Object.freeze({
      maxWidth: 720,
      maxHeight: 720,
      targetBytes: 150 * 1024,
      initialQuality: 0.82,
      minQuality: 0.62,
      label: "product",
    }),
  });

  const BACKEND_ALLOWED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  function getUploadPreset(kind) {
    return UPLOAD_PRESETS[kind] || UPLOAD_PRESETS.product;
  }

  function computeTargetDimensions(width, height, maxWidth, maxHeight) {
    const safeW = Math.max(1, Math.round(Number(width) || 1));
    const safeH = Math.max(1, Math.round(Number(height) || 1));
    const safeMaxW = Math.max(1, Math.round(Number(maxWidth) || safeW));
    const safeMaxH = Math.max(1, Math.round(Number(maxHeight) || safeH));

    const scale = Math.min(1, safeMaxW / safeW, safeMaxH / safeH);
    if (scale >= 1) {
      return { width: safeW, height: safeH, scaled: false };
    }
    return {
      width: Math.max(1, Math.round(safeW * scale)),
      height: Math.max(1, Math.round(safeH * scale)),
      scaled: true,
    };
  }

  function buildOptimizedFilename(originalName, outputMime) {
    const ext = outputMime === "image/webp" ? "webp"
      : outputMime === "image/jpeg" ? "jpg"
      : outputMime === "image/png" ? "png"
      : "webp";
    const base = String(originalName || "image")
      .replace(/\.[^.\/\\]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image";
    return `${base}.${ext}`;
  }

  function formatImageBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  function shouldKeepOriginalFile({ originalType, originalSize, candidateSize, scaled }) {
    if (!BACKEND_ALLOWED_TYPES.has(originalType)) return false;
    if (scaled) return false;
    return Number(candidateSize) >= Number(originalSize);
  }

  async function decodeImageSource(file) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close?.(),
        };
      } catch (_err) {
        // Fallback to HTMLImageElement if imageOrientation option or decoder fails
      }
    }

    if (typeof Image === "undefined" || typeof URL === "undefined") {
      throw new Error("Browser image decoder unavailable");
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Failed to decode image"));
        el.src = objectUrl;
      });
      return {
        source: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      };
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      throw err;
    }
  }

  async function encodeCanvasBlob(canvas, mimeType, quality) {
    if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
      return canvas.convertToBlob({ type: mimeType, quality });
    }
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    });
  }

  async function renderAndEncodeWebp(decoded, targetWidth, targetHeight, preset) {
    let canvas;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(targetWidth, targetHeight);
    } else if (typeof document !== "undefined") {
      canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    } else {
      throw new Error("Canvas unavailable");
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D context unavailable");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);

    // Prefer WebP; fall back to JPEG only on engines without WebP encoder support
    let outputMime = "image/webp";
    let quality = preset.initialQuality;
    let blob = await encodeCanvasBlob(canvas, outputMime, quality);

    if (!blob || blob.type !== "image/webp") {
      outputMime = "image/jpeg";
      blob = await encodeCanvasBlob(canvas, outputMime, quality);
    }

    while (blob && blob.size > preset.targetBytes && quality - 0.08 >= preset.minQuality) {
      quality = Number((quality - 0.08).toFixed(2));
      const nextBlob = await encodeCanvasBlob(canvas, outputMime, quality);
      if (!nextBlob || nextBlob.size >= blob.size) break;
      blob = nextBlob;
    }

    return blob;
  }

  async function optimizeImageFileForUpload(file, presetKind = "product") {
    const preset = getUploadPreset(presetKind);
    const originalBytes = file?.size || 0;

    if (!file) {
      return { file, originalBytes: 0, optimizedBytes: 0, wasOptimized: false, format: "" };
    }

    let decoded;
    try {
      decoded = await decodeImageSource(file);
    } catch (_err) {
      // Fall back to uploading raw file cleanly if decode isn't supported
      return {
        file,
        originalBytes,
        optimizedBytes: originalBytes,
        wasOptimized: false,
        format: file.type,
        reason: "decode-fallback",
      };
    }

    try {
      const { width, height, scaled } = computeTargetDimensions(
        decoded.width,
        decoded.height,
        preset.maxWidth,
        preset.maxHeight
      );

      if (file.type === "image/webp" && !scaled && file.size <= preset.targetBytes) {
        return {
          file,
          originalBytes,
          optimizedBytes: originalBytes,
          originalWidth: decoded.width,
          originalHeight: decoded.height,
          width,
          height,
          format: "image/webp",
          wasOptimized: false,
          reason: "already-optimal-webp",
        };
      }

      const blob = await renderAndEncodeWebp(decoded, width, height, preset);
      if (!blob) {
        return {
          file,
          originalBytes,
          optimizedBytes: originalBytes,
          wasOptimized: false,
          format: file.type,
          reason: "encode-fallback",
        };
      }

      if (
        shouldKeepOriginalFile({
          originalType: file.type,
          originalSize: originalBytes,
          candidateSize: blob.size,
          scaled,
        })
      ) {
        return {
          file,
          originalBytes,
          optimizedBytes: originalBytes,
          originalWidth: decoded.width,
          originalHeight: decoded.height,
          width,
          height,
          format: file.type,
          wasOptimized: false,
          reason: "original-smaller",
        };
      }

      const optimizedName = buildOptimizedFilename(file.name, blob.type);
      const optimizedFile = new File([blob], optimizedName, {
        type: blob.type,
        lastModified: Date.now(),
      });

      return {
        file: optimizedFile,
        originalBytes,
        optimizedBytes: optimizedFile.size,
        originalWidth: decoded.width,
        originalHeight: decoded.height,
        width,
        height,
        format: optimizedFile.type,
        wasOptimized: true,
      };
    } finally {
      decoded.cleanup();
    }
  }

  const api = {
    UPLOAD_PRESETS,
    getUploadPreset,
    computeTargetDimensions,
    buildOptimizedFilename,
    formatImageBytes,
    shouldKeepOriginalFile,
    optimizeImageFileForUpload,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.StoreMediaOptimizer = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
