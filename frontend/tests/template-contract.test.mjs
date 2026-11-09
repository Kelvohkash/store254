import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("storefront catalog drives the picker, palette and runtime", async () => {
  const [catalogText, admin, adminDesign, appCore, preview, fashionBeauty] = await Promise.all([
    read("../templates/catalog.json"),
    read("../admin.html"),
    read("../scripts/admin/design.js"),
    read("../scripts/storefront/core.js"),
    read("../styles/admin.css"),
    read("../templates/fashion-beauty-cosmetics/template.css"),
  ]);
  const catalog = JSON.parse(catalogText);
  assert.ok(catalog.templates.length >= 1);
  assert.ok(catalog.palettes.length >= 6, "at least six palettes must be available");
  assert.equal(new Set(catalog.templates.map(({ id }) => id)).size, catalog.templates.length, "template ids must be unique");
  for (const template of catalog.templates) {
    assert.match(template.id, /^[a-z0-9][a-z0-9-]{0,63}$/i);
    assert.ok(template.name && template.defaults, `${template.id} needs a name and shared-shell defaults`);
    if (template.stylesheet) assert.match(template.stylesheet, /^[a-z0-9][a-z0-9/_-]*\.css$/i);
  }
  for (const palette of catalog.palettes) {
    assert.match(palette.primary, /^#[0-9a-f]{6}$/i);
    assert.match(palette.background, /^#[0-9a-f]{6}$/i);
  }
  assert.match(admin, /id="template-choice-grid"/);
  assert.match(admin, /id="template-palette-choices"/);
  assert.match(admin, /data-preview-size="mobile"/);
  assert.match(adminDesign, /fetch\("\/templates\/catalog\.json"/);
  assert.match(adminDesign, /storefrontTemplateVersion/);
  assert.match(appCore, /loadStorefrontTemplateCatalog/);
  assert.match(appCore, /loadStorefrontTemplateStylesheet/);
  assert.match(fashionBeauty, /var\(--store-primary\)/);
  assert.match(preview, /template-choice-grid/);
  assert.match(preview, /data-preview-size="mobile"/);
});

test("storefront has responsive, contrast, keyboard-focus and reduced-motion guardrails", async () => {
  const quality = await read("../styles/storefront-quality.css");
  assert.match(quality, /@media\s*\(max-width:\s*767px\)/);
  assert.match(quality, /text-shadow:\s*none/);
  assert.match(quality, /:focus-within/);
  assert.match(quality, /\.store-banner\.has-banner-image \.storefront-primary-cta[\s\S]*?color:\s*var\(--store-ink/);
  assert.match(quality, /prefers-reduced-motion:\s*reduce/);
});

test("marketplace landing has distinct premium surfaces and mobile-safe styling", async () => {
  const [home, html] = await Promise.all([
    read("../styles/platform-home.css"),
    read("../index.html"),
  ]);
  assert.match(html, /styles\/platform-home\.css/);
  assert.match(home, /body:has\(#platform-hero\)[\s\S]*?background:\s*#f6f8f6/);
  assert.match(home, /\.platform-intro[\s\S]*?linear-gradient\([^;]*#fff/);
  assert.match(home, /\.platform-benefit-strip[\s\S]*?grid-template-columns:\s*repeat\(3/);
  assert.match(home, /\.platform-stores-grid[\s\S]*?grid-template-columns:\s*repeat\(4/);
  assert.match(home, /\.template-gallery-card[\s\S]*?border:\s*1px solid #e2ebe3/);
  assert.match(home, /@media\s*\(max-width:\s*640px\)/);
  assert.match(home, /prefers-reduced-motion:\s*reduce/);
});
