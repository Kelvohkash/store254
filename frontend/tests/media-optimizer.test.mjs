import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const optimizer = require("../scripts/admin/media-optimizer.js");

test("getUploadPreset returns tailored dimensions and targets for logo, banner, and product", () => {
  const logo = optimizer.getUploadPreset("logo");
  assert.equal(logo.maxWidth, 320);
  assert.equal(logo.maxHeight, 320);

  const banner = optimizer.getUploadPreset("banner");
  assert.equal(banner.maxWidth, 1440);
  assert.equal(banner.maxHeight, 800);

  const product = optimizer.getUploadPreset("product");
  assert.equal(product.maxWidth, 720);
  assert.equal(product.maxHeight, 720);

  const fallback = optimizer.getUploadPreset("unknown");
  assert.deepEqual(fallback, product);
});

test("computeTargetDimensions preserves aspect ratio and never upscales smaller photos", () => {
  assert.deepEqual(
    optimizer.computeTargetDimensions(4000, 3000, 720, 720),
    { width: 720, height: 540, scaled: true }
  );

  assert.deepEqual(
    optimizer.computeTargetDimensions(2400, 3600, 720, 720),
    { width: 480, height: 720, scaled: true }
  );

  assert.deepEqual(
    optimizer.computeTargetDimensions(3840, 2160, 1440, 800),
    { width: 1422, height: 800, scaled: true }
  );

  assert.deepEqual(
    optimizer.computeTargetDimensions(640, 480, 720, 720),
    { width: 640, height: 480, scaled: false }
  );
});

test("buildOptimizedFilename normalizes extension to .webp safely", () => {
  assert.equal(optimizer.buildOptimizedFilename("IMG_20260412.JPG", "image/webp"), "IMG_20260412.webp");
  assert.equal(optimizer.buildOptimizedFilename("my product photo!!.png", "image/webp"), "my-product-photo.webp");
  assert.equal(optimizer.buildOptimizedFilename("logo.webp", "image/jpeg"), "logo.jpg");
});

test("shouldKeepOriginalFile avoids keeping oversized files and rejects disallowed source MIME types", () => {
  assert.equal(
    optimizer.shouldKeepOriginalFile({
      originalType: "image/webp",
      originalSize: 40000,
      candidateSize: 45000,
      scaled: false,
    }),
    true
  );

  // Scaled images should use the resized version
  assert.equal(
    optimizer.shouldKeepOriginalFile({
      originalType: "image/webp",
      originalSize: 40000,
      candidateSize: 45000,
      scaled: true,
    }),
    false
  );

  // Disallowed backend MIME (e.g. GIF/BMP decoded to static webp) must not keep original
  assert.equal(
    optimizer.shouldKeepOriginalFile({
      originalType: "image/gif",
      originalSize: 10000,
      candidateSize: 12000,
      scaled: false,
    }),
    false
  );
});

test("formatImageBytes formats B, KB, and MB cleanly", () => {
  assert.equal(optimizer.formatImageBytes(512), "512 B");
  assert.equal(optimizer.formatImageBytes(65536), "64 KB");
  assert.equal(optimizer.formatImageBytes(2.5 * 1024 * 1024), "2.5 MB");
});
