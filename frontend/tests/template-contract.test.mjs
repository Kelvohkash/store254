import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("storefront catalog drives self-contained template picker and runtime without color overrides", async () => {
  const [catalogText, admin, adminDesign, appCore, preview, fashionAndDesign] = await Promise.all([
    read("../templates/catalog.json"),
    read("../admin.html"),
    read("../scripts/admin/design.js"),
    read("../scripts/storefront/core.js"),
    read("../styles/admin.css"),
    read("../templates/fashion-and-design/template.css"),
  ]);
  const catalog = JSON.parse(catalogText);
  assert.equal(catalog.templates.length, 8, "catalog must contain exactly 8 templates");
  assert.equal(catalog.palettes, undefined, "palettes should not be exposed as separate user choices");
  assert.equal(new Set(catalog.templates.map(({ id }) => id)).size, catalog.templates.length, "template ids must be unique");
  for (const template of catalog.templates) {
    assert.match(template.id, /^[a-z0-9][a-z0-9-]{0,63}$/i);
    assert.ok(template.name && template.defaults, `${template.id} needs a name and shared-shell defaults`);
    assert.match(template.colors?.primary || "", /^#[0-9a-f]{6}$/i);
    assert.match(template.colors?.background || "", /^#[0-9a-f]{6}$/i);
    if (template.stylesheet) assert.match(template.stylesheet, /^[a-z0-9][a-z0-9/_-]*\.css$/i);
  }
  assert.match(admin, /id="template-choice-grid"/);
  assert.doesNotMatch(admin, /id="template-palette-choices"/, "admin must not have colour palette choices");
  assert.doesNotMatch(admin, /id="settings-primary-color-picker"/, "admin must not have foreground colour picker");
  assert.doesNotMatch(admin, /id="settings-background-color-picker"/, "admin must not have background colour picker");
  assert.match(admin, /data-preview-size="mobile"/);
  assert.match(adminDesign, /fetch\("\/templates\/catalog\.json"/);
  assert.match(adminDesign, /storefrontTemplateVersion/);
  assert.match(appCore, /loadStorefrontTemplateCatalog/);
  assert.match(appCore, /loadStorefrontTemplateStylesheet/);
  assert.doesNotMatch(appCore, /resolveStorefrontColorTokens/, "automatic foreground balancing should be removed");
  assert.match(fashionAndDesign, /--store-primary:\s*#[0-9a-f]{6}/i);
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
  assert.match(home, /html:not\(\[data-storefront="true"\]\)\s*\.customer-orders-shortcut[\s\S]*?display:\s*none\s*!important;/);
  assert.match(home, /html:not\(\[data-storefront="true"\]\)\s*#wishlist-toggle[\s\S]*?display:\s*none\s*!important;/);
  assert.match(home, /body:has\(#platform-hero\)[\s\S]*?background:\s*#f6f8f6/);
  assert.match(home, /\.platform-intro[\s\S]*?linear-gradient\([^;]*#fff/);
  assert.match(home, /\.platform-benefit-strip[\s\S]*?grid-template-columns:\s*repeat\(3/);
  assert.match(home, /\.platform-stores-grid[\s\S]*?grid-template-columns:\s*repeat\(4/);
  assert.match(home, /\.template-gallery-card[\s\S]*?border:\s*1px solid #e2ebe3/);
  assert.match(home, /@media\s*\(max-width:\s*640px\)/);
  assert.match(home, /prefers-reduced-motion:\s*reduce/);
});

test("every catalog template has a self-contained stylesheet and preview with baked-in color tokens", async () => {
  const catalog = JSON.parse(await read("../templates/catalog.json"));
  assert.equal(catalog.templates.length, 8, "expected exactly 8 generated templates");
  for (const template of catalog.templates) {
    assert.ok(template.stylesheet, `${template.id} must have a generated stylesheet`);
    assert.ok(template.preview, `${template.id} must have a generated preview`);
    const css = await read(`../templates/${template.stylesheet}`);
    const previewHtml = await read(`../templates/${template.preview}`);
    assert.match(css, /--store-primary:\s*#[0-9a-f]{6}/i, `${template.id} css must define its own --store-primary`);
    assert.match(css, /--store-paper:\s*#[0-9a-f]{6}/i, `${template.id} css must define its own --store-paper`);
    assert.match(css, /--store-ink:\s*#[0-9a-f]{6}/i, `${template.id} css must define its own --store-ink`);
    assert.match(css, /--store-on-primary:\s*#[0-9a-f]{6}/i, `${template.id} css must define its own --store-on-primary`);
    assert.match(previewHtml, new RegExp(`data-storefront-template="${template.id}"`));
    assert.doesNotMatch(previewHtml, /input type="color"/, `${template.id} preview must not include color pickers`);
  }
});
