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
  assert.match(html, /id="platform-coverage-hero"/);
  assert.doesNotMatch(html, /id="platform-kenya-metrics"/);
  assert.match(html, /id="metric-kenya-locations"/);
  assert.match(html, /id="metric-kenya-neighbors"/);
  assert.match(homeCss, /\.platform-coverage-mini-hero/);
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
  assert.doesNotMatch(searchJs, /selectMarketplaceBuyerLocation\(\$\{inlineJs\(/);
  assert.match(searchJs, /Product not found/i);
  assert.match(searchJs, /add more products and stores/i);
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

test("buyer-first platform homepage supports Google invite, location selector, and zero-hop checkout", async () => {
  const [html, cartJs] = await Promise.all([
    read("../index.html"),
    read("../scripts/storefront/marketplace-cart.js"),
  ]);
  for (const id of [
    "buyer-welcome-modal",
    "marketplace-item-modal",
    "marketplace-cart-drawer",
    "marketplace-checkout-modal",
    "marketplace-orders-modal",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /placeholder="Search for anything\.\.\."/);
  assert.match(html, /scripts\/storefront\/marketplace-cart\.js/);
  assert.ok(
    html.indexOf('id="platform-ripple-search-section"') < html.indexOf('class="platform-intro"'),
    "Expected buyer ripple discovery to appear before seller hero intro"
  );
  assert.match(html, /id="platform-mobile-bottom-nav"/);
  assert.match(cartJs, /\/api\/platform\/me/);
  assert.match(cartJs, /\/api\/platform\/marketplace\/checkout/);
  assert.match(cartJs, /\/api\/platform\/marketplace\/my-orders/);
});

test("platform stores directory lives on dedicated /stores route accessible from desktop and mobile menus", async () => {
  const [html, worker] = await Promise.all([
    read("../index.html"),
    read("../src/worker.ts"),
  ]);
  assert.match(html, /data-platform-view/);
  assert.match(html, /<a href="\/stores"[^>]*>[\s\S]*?<span>Stores<\/span>[\s\S]*?<\/a>/);
  assert.match(html, /Every Hustle[\s\S]*?has a home[\s\S]*?here/);
  assert.match(html, /<a href="\/stores"[^>]*><span>Active storefronts<\/span>/);
  assert.doesNotMatch(html, /platform-demo-stores-section|Demo businesses/);
  assert.match(worker, /url\.pathname === "\/stores"/);
  assert.match(worker, /data-platform-view/);
});

test("site is configured as an installable PWA across marketplace, storefronts, and admin", async () => {
  const [html, adminHtml, manifestRaw, swJs, offlineHtml, pwaJs, worker, headers] = await Promise.all([
    read("../index.html"),
    read("../admin.html"),
    read("../manifest.webmanifest"),
    read("../sw.js"),
    read("../offline.html"),
    read("../scripts/storefront/pwa.js"),
    read("../src/worker.ts"),
    read("../_headers"),
  ]);

  const manifest = JSON.parse(manifestRaw);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192" && icon.src === "/assets/pwa-icon-192.png"));
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.src === "/assets/pwa-icon-512.png"));
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "512x512" && icon.purpose === "maskable" && icon.src === "/assets/pwa-icon-maskable-512.png"
    )
  );

  for (const page of [html, adminHtml]) {
    assert.match(page, /<link rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(page, /<link rel="apple-touch-icon"[^>]+href="\/assets\/apple-touch-icon\.png"/);
    assert.match(page, /<meta name="theme-color" content="#0f7a44"/);
    assert.match(page, /<script src="\/scripts\/storefront\/pwa\.js"><\/script>/);
  }

  assert.match(swJs, /CACHE_VERSION/);
  assert.match(swJs, /\/offline\.html/);
  assert.match(swJs, /\/api\//);
  assert.match(swJs, /\/auth\//);
  assert.match(offlineHtml, /You are offline/);
  assert.match(pwaJs, /serviceWorker\.register\("\/sw\.js"/);
  assert.match(pwaJs, /beforeinstallprompt/);
  assert.match(worker, /url\.pathname === "\/sw\.js"/);
  assert.match(worker, /url\.pathname === "\/manifest\.webmanifest"/);
  assert.match(worker, /url\.pathname === "\/offline\.html"/);
  assert.match(headers, /\/sw\.js/);
  assert.match(headers, /Service-Worker-Allowed: \//);

  const iconFiles = [
    "../assets/pwa-icon-192.png",
    "../assets/pwa-icon-512.png",
    "../assets/pwa-icon-maskable-512.png",
    "../assets/apple-touch-icon.png",
  ];
  for (const iconPath of iconFiles) {
    const buf = await readFile(new URL(iconPath, import.meta.url));
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
    assert.equal(buf[2], 0x4e);
    assert.equal(buf[3], 0x47);
  }
});

test("google login return flow avoids white screen and stuck sign-in modals", async () => {
  const [swJs, platformJs, cartJs, customerJs, storefrontJs, googleCustomerSvc] = await Promise.all([
    read("../sw.js"),
    read("../scripts/storefront/platform.js"),
    read("../scripts/storefront/marketplace-cart.js"),
    read("../scripts/storefront/customer.js"),
    read("../scripts/storefront/storefront.js"),
    read("../../backend/src/services/google-customer-auth.service.ts"),
  ]);

  assert.match(swJs, /url\.searchParams\.has\("_customer_login"\)/);
  assert.match(platformJs, /if\s*\(!loginResult\s*\|\|\s*!state\.activeTenantSlug\)\s*return/);
  assert.match(cartJs, /cache:\s*"no-store"/);
  assert.match(cartJs, /window\.closeBuyerWelcomeModal\(false\)/);
  assert.match(cartJs, /window\.addEventListener\("pageshow"/);
  assert.match(customerJs, /hydrateStorefrontCustomerSession/);
  assert.match(customerJs, /closeShoppingSignInPrompt\(\)/);
  assert.match(storefrontJs, /hydrateStorefrontCustomerSession/);
  assert.doesNotMatch(googleCustomerSvc, /CUSTOMER_ACCOUNT_REQUIRED/);
});

test("user profile displays active store and admin supports password change and staff permissions", async () => {
  const [indexHtml, customerJs, cartJs, adminHtml, designJs, coreJs, authRoutes] = await Promise.all([
    read("../index.html"),
    read("../scripts/storefront/customer.js"),
    read("../scripts/storefront/marketplace-cart.js"),
    read("../admin.html"),
    read("../scripts/admin/design.js"),
    read("../scripts/admin/core.js"),
    read("../../backend/src/modules/auth/auth.routes.ts"),
  ]);

  assert.match(indexHtml, /id="customer-active-store-card"/);
  assert.match(customerJs, /function buildActiveStoreProfileHtml/);
  assert.match(cartJs, /buildActiveStoreProfileHtml\(platformUser\.activeStore/);

  assert.match(adminHtml, /id="settings-password-card"/);
  assert.match(adminHtml, /id="settings-staff-card"/);
  assert.match(adminHtml, /id="staff-account-form"/);
  assert.match(designJs, /async function handleChangeStorePassword/);
  assert.match(designJs, /async function handleCreateStaffAccount/);
  assert.match(coreJs, /function hasAdminPermission/);
  assert.match(coreJs, /function applyRolePermissionsUI/);
  assert.match(authRoutes, /authRouter\.post\(\s*"\/change-password"/);
  assert.match(authRoutes, /authRouter\.get\("\/staff"/);
  assert.match(authRoutes, /authRouter\.post\(\s*"\/staff"/);
});

test("store onboarding requires Google sign-in and locks owner email", async () => {
  const [html, onboardingJs, cartJs, platformRoutes] = await Promise.all([
    read("../index.html"),
    read("../scripts/storefront/onboarding.js"),
    read("../scripts/storefront/marketplace-cart.js"),
    read("../../backend/src/modules/platform/platform.routes.ts"),
  ]);

  assert.match(html, /id="onboard-auth-gate"/);
  assert.match(html, /id="btn-onboard-google-signin"/);
  assert.match(html, /id="onboard-email"[^>]*readonly/);
  assert.match(onboardingJs, /startOnboardGoogleSignIn/);
  assert.match(onboardingJs, /syncOnboardModalAuthState/);
  assert.match(onboardingJs, /platformUser\.email/);
  assert.match(cartJs, /store254_reopen_onboard/);
  assert.match(platformRoutes, /GOOGLE_AUTH_REQUIRED/);
  assert.match(platformRoutes, /EMAIL_MISMATCH/);
});
