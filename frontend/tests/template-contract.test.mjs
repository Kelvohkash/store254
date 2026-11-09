import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const templateIds = [
  "market-modern",
  "editorial-boutique",
  "premium-maker",
  "tech-home",
  "service-studio",
  "food-local",
];

test("every storefront template is selectable, defaulted, applied, and styled", async () => {
  const [admin, adminDesign, appCore, templates, preview] = await Promise.all([
    read("../admin.html"),
    read("../scripts/admin/design.js"),
    read("../scripts/storefront/core.js"),
    read("../styles/storefront-templates.css"),
    read("../styles/admin.css"),
  ]);

  for (const template of templateIds) {
    assert.match(admin, new RegExp(`data-template=["']${template}["']`), `${template} missing from editor`);
    assert.match(adminDesign, new RegExp(`['"]${template}['"]\s*:`), `${template} missing design defaults`);
    assert.ok(appCore.includes(`"${template}"`), `${template} missing storefront allow-list`);
    assert.ok(templates.includes(`data-storefront-template="${template}"`), `${template} missing storefront styles`);
    assert.ok(preview.includes(`data-template="${template}"`), `${template} missing preview styles`);
  }
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
