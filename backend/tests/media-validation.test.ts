import test from "node:test";
import assert from "node:assert/strict";
import { detectImageMimeFromBytes } from "../src/lib/media-validation.ts";

test("detectImageMimeFromBytes identifies valid JPEG, PNG, and WEBP signatures", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectImageMimeFromBytes(jpeg), "image/jpeg");

  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  assert.equal(detectImageMimeFromBytes(png), "image/png");

  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46,
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
  ]);
  assert.equal(detectImageMimeFromBytes(webp), "image/webp");
});

test("detectImageMimeFromBytes rejects GIF, SVG/HTML, and empty or truncated payloads", () => {
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
  assert.equal(detectImageMimeFromBytes(gif), null);

  const svgText = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
  assert.equal(detectImageMimeFromBytes(svgText), null);

  assert.equal(detectImageMimeFromBytes(new Uint8Array([0xff, 0xd8, 0xff])), null);
  assert.equal(detectImageMimeFromBytes(new Uint8Array(0)), null);
});
