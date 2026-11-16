import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const artwork = require("../scripts/shared/item-artwork-classifier.js");

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("item artwork classifier exposes a large catalog and matches everyday, Swahili, and absurd concepts", () => {
  const catalog = artwork.getCatalog();
  assert.ok(catalog.length >= 500, `expected at least 500 high-detail icon archetypes, got ${catalog.length}`);
  assert.equal(new Set(catalog.map((d) => d.id)).size, catalog.length, "expected all icon archetype IDs to be unique");

  const cases = [
    { item: { title: "Air Max Running Kicks", itemType: "PHYSICAL" }, expected: "sneaker" },
    { item: { title: "Official Clarks Leather", itemType: "PHYSICAL" }, expected: "dress_shoe" },
    { item: { title: "Afrobeat Mixing & Mastering Session", itemType: "SERVICE" }, expected: "music_studio" },
    { item: { title: "Solar Inverter 5kVA System", itemType: "PHYSICAL" }, expected: "solar_energy" },
    { item: { title: "Kuku Broiler Starter Feed", itemType: "PHYSICAL" }, expected: "farm_livestock" },
    { item: { title: "Fundi Wa Maji Pipe Repair", itemType: "SERVICE" }, expected: "plumbing_water" },
    { item: { title: "Raw Mount Kenya Asali Honey", itemType: "PHYSICAL" }, expected: "beekeeping_honey" },
    { item: { title: "Quantum Telescope Lens", itemType: "PHYSICAL" }, expected: "telescope_astro" },
    { item: { title: "Unicorn Tarot Crystal Ball", itemType: "PHYSICAL" }, expected: "magic_mystic" },
    { item: { title: "Custom Kazoo Jam Workshop", itemType: "SERVICE" }, expected: "guitar_instrument" },
    { item: { title: "Taxidermy Lizard Display", itemType: "PHYSICAL" }, expected: "pets_veterinary" },
    { item: { title: "3D Printed Hologram Robot", itemType: "PHYSICAL" }, expected: "robot_3dprint" },
  ];

  for (const { item, expected } of cases) {
    const resolved = artwork.resolveArtwork(item, {});
    assert.equal(resolved.id, expected, `expected ${item.title} -> ${expected}, got ${resolved.id}`);
    const svg = artwork.renderSvgString(item, {});
    assert.match(svg, /^<svg[^>]+viewBox="0 0 120 120"/);
    const uri = artwork.buildDataUri(item, {});
    assert.ok(uri.startsWith("data:image/svg+xml;charset=utf-8,"));
  }

  // Completely unknown / absurd nonsense titles still produce tailored valid SVG & palette
  const nonsenseService = artwork.resolveArtwork({ title: "Zorgblax Flibbertwidget", itemType: "SERVICE" }, {});
  assert.equal(nonsenseService.id, "umbrella_service_general");
  const nonsenseProduct = artwork.resolveArtwork({ title: "Zorgblax Flibbertwidget", itemType: "PHYSICAL" }, {});
  assert.equal(nonsenseProduct.id, "product_artifact_general");
  assert.ok(artwork.searchCatalog("drone").length >= 1);
});

test("no generic Unsplash product/service default photo fallbacks remain in storefront or SSR modules", async () => {
  const files = [
    "../scripts/storefront/catalog.js",
    "../scripts/storefront/item-modal.js",
    "../scripts/storefront/marketplace-search.js",
    "../scripts/storefront/marketplace-cart.js",
    "../src/seo.ts",
  ];
  for (const file of files) {
    const src = await read(file);
    assert.doesNotMatch(src, /1526170375885-4d8ecf77b99f|1576091160399-112ba8d25d1d/, `Unsplash fallback found in ${file}`);
  }
});

test("admin, storefront, and backend separate SERVICE booking logic from PHYSICAL stock & delivery logic", async () => {
  const [adminHtml, editorJs, catalogJs, adminCatalogJs, cartJs, checkoutJs, itemsRoutes, checkoutSvc] = await Promise.all([
    read("../admin.html"),
    read("../scripts/admin/product-editor.js"),
    read("../scripts/storefront/catalog.js"),
    read("../scripts/admin/catalog.js"),
    read("../scripts/storefront/cart.js"),
    read("../scripts/storefront/checkout.js"),
    read("../../backend/src/modules/catalog/items.routes.ts"),
    read("../../backend/src/modules/orders/checkout.service.ts"),
  ]);

  assert.match(adminHtml, /id="service-setup-section"/);
  assert.match(adminHtml, /id="product-inventory-section"/);
  assert.match(adminHtml, /id="product-artwork-grid"/);
  assert.match(editorJs, /function syncItemEditorTypeUI/);
  assert.match(adminCatalogJs, /trackInventory:\s*!isService && !isDigital/);
  assert.match(catalogJs, /Book Session/);
  assert.match(cartJs, /function syncCheckoutDeliveryAndBookingUI/);
  assert.match(checkoutJs, /isServiceOnly && bookingMode === "ON_SITE_CLIENT"/);
  assert.match(itemsRoutes, /const resolvedTrackInventory = isServiceItem \? false : body\.trackInventory/);
  assert.match(checkoutSvc, /if \(isPhysical && dbItem\.trackInventory/);
  assert.match(checkoutSvc, /if \(hasPhysical && body\.paymentMethod === "CASH_ON_DELIVERY" && !body\.deliveryAddress\)/);
});
