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

test("store onboarding uses live County and Town/Shopping Centre search with linked constituency", async () => {
  const [html, onboardingJs] = await Promise.all([
    read("../index.html"),
    read("../scripts/storefront/onboarding.js"),
  ]);
  assert.match(html, /id="onboard-county-search"/);
  assert.match(html, /id="onboard-location-search"/);
  assert.match(html, /id="onboard-selected-location-card"/);
  assert.match(html, /id="onboard-nearby-preview"/);
  assert.match(onboardingJs, /\/api\/platform\/locations\/counties/);
  assert.match(onboardingJs, /\/api\/platform\/locations\/towns\?countyId=/);
  assert.match(onboardingJs, /\/api\/platform\/locations\/google-autocomplete/);
  assert.match(onboardingJs, /constituencyName/);
});

test("platform homepage renders Kenya coverage & smart network metrics", async () => {
  const [html, homeCss, platformJs] = await Promise.all([
    read("../index.html"),
    read("../styles/platform-home.css"),
    read("../scripts/storefront/platform.js"),
  ]);
  assert.match(html, /id="platform-kenya-metrics"/);
  assert.match(html, /id="metric-kenya-locations"/);
  assert.match(html, /id="metric-kenya-neighbors"/);
  assert.match(homeCss, /\.platform-metrics-band/);
  assert.match(platformJs, /\/api\/platform\/locations\/stats/);
});

test("platform homepage exposes progressive ripple product search with location picker", async () => {
  const [html, homeCss, searchJs] = await Promise.all([
    read("../index.html"),
    read("../styles/platform-home.css"),
    read("../scripts/storefront/marketplace-search.js"),
  ]);
  assert.match(html, /id="platform-ripple-search-section"/);
  assert.match(html, /id="marketplace-product-query"/);
  assert.match(html, /id="marketplace-ripple-trail"/);
  assert.match(homeCss, /\.platform-ripple-search-band/);
  assert.match(searchJs, /\/api\/platform\/search\/products/);
  assert.match(searchJs, /\/api\/platform\/search\/suggest/);
});

test("store onboarding supports expanded Kenyan and international business types", async () => {
  const [html, superAdmin, seo] = await Promise.all([
    read("../index.html"),
    read("../super-admin.html"),
    read("../src/seo.ts"),
  ]);
  for (const type of ["FASHION", "BEAUTY", "FOOD_BEVERAGE", "PHARMACY_HEALTH", "AGRICULTURE", "AUTOMOTIVE", "REAL_ESTATE", "BUILDING_HARDWARE", "WHOLESALE_B2B", "LOGISTICS_DELIVERY"]) {
    assert.match(html, new RegExp(`value="${type}"`));
    assert.match(superAdmin, new RegExp(`value="${type}"`));
    assert.match(seo, new RegExp(`enumType:\\s*"${type}"`));
  }
});
