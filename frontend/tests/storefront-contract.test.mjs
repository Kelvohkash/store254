import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("storefront uses one layout and lets owners choose an accent colour", async () => {
  const [admin, design, runtime, stylesheet] = await Promise.all([
    read("../admin.html"),
    read("../scripts/admin/design.js"),
    read("../scripts/storefront/core.js"),
    read("../styles/storefront-default.css"),
  ]);
  assert.match(admin, /id="settings-primary-color"/);
  assert.match(admin, /value="#2563eb">Ocean blue/);
  assert.doesNotMatch(admin, /template|theme picker/i);
  assert.match(design, /primaryColor:/);
  assert.match(runtime, /styles\/storefront-default\.css/);
  assert.match(stylesheet, /var\(--store-primary\)/);
  assert.match(stylesheet, /backdrop-filter:\s*blur/);
  assert.doesNotMatch(stylesheet, /data-storefront-template/);
});

test("storefront keeps responsive, contrast, keyboard-focus and reduced-motion guardrails", async () => {
  const quality = await read("../styles/storefront-quality.css");
  assert.match(quality, /@media\s*\(max-width:\s*767px\)/);
  assert.match(quality, /text-shadow:\s*none/);
  assert.match(quality, /:focus-within/);
  assert.match(quality, /\.store-banner\.has-banner-image \.storefront-primary-cta[\s\S]*?color:\s*var\(--store-ink/);
  assert.match(quality, /prefers-reduced-motion:\s*reduce/);
});

test("marketplace landing remains mobile-safe without a theme gallery", async () => {
  const [home, html, drawers] = await Promise.all([
    read("../styles/platform-home.css"),
    read("../index.html"),
    read("../styles/base/drawers-modals.css"),
  ]);
  assert.match(html, /styles\/platform-home\.css/);
  assert.match(html, /mobile-bottom-nav[^>]*md:hidden/);
  assert.match(drawers, /\.mobile-bottom-nav,\s*#mobile-bottom-nav\s*\{\s*display:\s*none\s*!important;/);
  assert.match(drawers, /@media\s*\(max-width:\s*767px\)[\s\S]*?\.mobile-bottom-nav/);
  assert.match(home, /html:not\(\[data-storefront="true"\]\)\s*\.mobile-bottom-nav[\s\S]*?display:\s*none\s*!important;/);
  assert.match(home, /html:not\(\[data-storefront="true"\]\)\s*#desktop-search[\s\S]*?display:\s*none\s*!important;/);
  assert.match(home, /\.platform-stores-grid[\s\S]*?grid-template-columns:\s*repeat\(4/);
  assert.doesNotMatch(html, /template-gallery|Seller themes/);
  assert.match(home, /@media\s*\(max-width:\s*640px\)/);
});
