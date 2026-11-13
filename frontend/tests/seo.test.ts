import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlatformAboutHtml,
  buildPlatformDirectoryHtml,
  buildPlatformSeoData,
  buildPlatformSitemapIndexXml,
  buildPlatformSitemapXml,
  buildRobotsTxt,
  buildStorefrontSeoData,
  buildStorefrontSitemapXml,
  classifyHost,
  filterIndexableStores,
  getDirectoryHubForBusinessType,
  parseStorefrontRoute,
  resolveTenantCanonicalOrigin,
  safeJsonLd,
  sanitizeSlug,
} from "../src/seo.ts";

const sampleStores = [
  {
    id: "tenant-alice-babycare-101",
    name: "Alice Baby Care",
    subdomain: "alicebabycare",
    businessType: "RETAIL",
    currency: "KES",
    settings: {
      tagline: "Gentle essentials for babies & moms",
      description: "Quality strollers, carriers, and baby care in Nairobi.",
      bannerUrl: "/api/media/tenant-alice-babycare-101/banner.webp",
      logoUrl: "/api/media/tenant-alice-babycare-101/logo.webp",
      contactPhone: "+254712345678",
      socialLinks: { instagram: "@alicebabycare", whatsapp: "0712345678" },
    },
    updatedAt: "2026-11-12T10:00:00.000Z",
  },
];

const samplePayload = {
  tenant: {
    id: "tenant-alice-babycare-101",
    name: "Alice Baby Care",
    subdomain: "alicebabycare",
    customDomain: null,
    businessType: "RETAIL",
    currency: "KES",
    status: "ACTIVE",
    settings: sampleStores[0].settings,
  },
  categories: [
    { id: "cat-1", name: "Baby Carriers", slug: "baby-carriers", parentId: null, description: "Ergonomic carriers" },
    { id: "cat-2", name: "Consulting", slug: "consulting", parentId: null, description: "Newborn consultations" },
  ],
  items: [
    {
      id: "item-1",
      categoryId: "cat-1",
      title: "Ergobaby Omni 360 Carrier",
      slug: "ergobaby-omni-360-carrier",
      description: "Breathable mesh baby carrier with lumbar support. </script><script>alert(1)</script>",
      itemType: "PHYSICAL",
      basePrice: 8500,
      compareAtPrice: 9800,
      sku: "ERG-360",
      trackInventory: true,
      stockQuantity: 12,
      images: ["/api/media/tenant-alice-babycare-101/carrier.webp"],
      attributes: { brand: "Ergobaby", color: "Graphite" },
      variants: [
        { id: "v1", title: "Graphite", price: 8500, stockQuantity: 8 },
        { id: "v2", title: "Midnight Blue", price: 8900, stockQuantity: 4 },
      ],
      reviewCount: 4,
      avgRating: 4.8,
      updatedAt: "2026-11-12T12:00:00.000Z",
    },
    {
      id: "item-2",
      categoryId: "cat-2",
      title: "Newborn Sleep Consultation",
      slug: "newborn-sleep-consultation",
      description: "60-minute private nursery & sleep coaching session.",
      itemType: "SERVICE",
      basePrice: 3500,
      stockQuantity: 0,
      trackInventory: false,
      images: [],
      attributes: { duration_minutes: 60 },
      variants: [],
      reviewCount: 2,
      avgRating: 5.0,
      updatedAt: "2026-11-11T09:00:00.000Z",
    },
  ],
};

test("host classification and canonical resolution keep subdomains independent", () => {
  assert.equal(classifyHost("store254.co.ke").isPlatformRoot, true);
  assert.equal(classifyHost("alicebabycare.store254.co.ke").isPlatformRoot, false);
  assert.equal(classifyHost("store254-frontend.workers.dev").isPreviewHost, true);

  assert.equal(
    resolveTenantCanonicalOrigin(new URL("https://store254.co.ke/?store=alicebabycare"), samplePayload.tenant),
    "https://alicebabycare.store254.co.ke"
  );
  assert.equal(
    resolveTenantCanonicalOrigin(new URL("https://shop.alicebabycare.co.ke/"), {
      subdomain: "alicebabycare",
      customDomain: "shop.alicebabycare.co.ke",
    }),
    "https://shop.alicebabycare.co.ke"
  );
});

test("parseStorefrontRoute recognizes home, category, item, and admin routes", () => {
  assert.deepEqual(parseStorefrontRoute("/"), { kind: "home" });
  assert.deepEqual(parseStorefrontRoute("/category/baby-carriers"), { kind: "category", slug: "baby-carriers" });
  assert.deepEqual(parseStorefrontRoute("/item/ergobaby-omni-360-carrier"), {
    kind: "item",
    slug: "ergobaby-omni-360-carrier",
  });
  assert.deepEqual(parseStorefrontRoute("/admin.html"), { kind: "admin" });
});

test("robots.txt allows uploaded product media, blocks admin/API JSON, and blocks preview hosts", () => {
  const rootRobots = buildRobotsTxt({
    isPreview: false,
    canonicalOrigin: "https://store254.co.ke",
    stores: sampleStores,
    includePlatformIndex: true,
  });
  assert.match(rootRobots, /Allow: \/api\/media\//);
  assert.match(rootRobots, /Disallow: \/api\//);
  assert.match(rootRobots, /Disallow: \/admin/);
  assert.match(rootRobots, /Sitemap: https:\/\/store254\.co\.ke\/sitemap-index\.xml/);
  assert.match(rootRobots, /Sitemap: https:\/\/alicebabycare\.store254\.co\.ke\/sitemap\.xml/);

  const storeRobots = buildRobotsTxt({
    isPreview: false,
    canonicalOrigin: "https://alicebabycare.store254.co.ke",
  });
  assert.match(storeRobots, /Sitemap: https:\/\/alicebabycare\.store254\.co\.ke\/sitemap\.xml/);

  const previewRobots = buildRobotsTxt({
    isPreview: true,
    canonicalOrigin: "https://store254-frontend.workers.dev",
  });
  assert.equal(previewRobots, "User-agent: *\nDisallow: /\n");
});

test("sitemaps include root marketplace index plus store homepage, categories, products, and services", () => {
  const rootSitemap = buildPlatformSitemapXml(sampleStores);
  assert.match(rootSitemap, /<loc>https:\/\/store254\.co\.ke\/<\/loc>/);

  const indexXml = buildPlatformSitemapIndexXml(sampleStores);
  assert.match(indexXml, /<loc>https:\/\/alicebabycare\.store254\.co\.ke\/sitemap\.xml<\/loc>/);

  const storeXml = buildStorefrontSitemapXml("https://alicebabycare.store254.co.ke", samplePayload);
  assert.match(storeXml, /<loc>https:\/\/alicebabycare\.store254\.co\.ke\/<\/loc>/);
  assert.match(storeXml, /<loc>https:\/\/alicebabycare\.store254\.co\.ke\/category\/baby-carriers<\/loc>/);
  assert.match(storeXml, /<loc>https:\/\/alicebabycare\.store254\.co\.ke\/item\/ergobaby-omni-360-carrier<\/loc>/);
  assert.match(storeXml, /<loc>https:\/\/alicebabycare\.store254\.co\.ke\/item\/newborn-sleep-consultation<\/loc>/);
  assert.match(storeXml, /<image:loc>https:\/\/alicebabycare\.store254\.co\.ke\/api\/media\/tenant-alice-babycare-101\/carrier\.webp<\/image:loc>/);
});

test("platform root SSR injects followable direct subdomain links and ItemList JSON-LD", () => {
  const platformSeo = buildPlatformSeoData(sampleStores, false);
  assert.match(platformSeo.headTagsHtml, /rel="canonical" href="https:\/\/store254\.co\.ke\/"/);
  assert.match(platformSeo.headTagsHtml, /Alice Baby Care/);
  assert.match(platformSeo.ssrStoresHtml, /href="https:\/\/alicebabycare\.store254\.co\.ke\/"/);

  const previewSeo = buildPlatformSeoData(sampleStores, true);
  assert.equal(previewSeo.robots, "noindex, nofollow");
});

test("storefront home SEO targets exact brand & subdomain searches with OfferCatalog schema", () => {
  const seo = buildStorefrontSeoData({
    origin: "https://alicebabycare.store254.co.ke",
    route: { kind: "home" },
    payload: samplePayload,
    isPreview: false,
  });

  assert.equal(seo.status, 200);
  assert.ok(seo.title.startsWith("Alice Baby Care"));
  assert.match(seo.headTagsHtml, /rel="canonical" href="https:\/\/alicebabycare\.store254\.co\.ke\/"/);
  assert.match(seo.headTagsHtml, /"alternateName":\["alicebabycare","alicebabycare\.store254\.co\.ke"\]/);
  assert.match(seo.headTagsHtml, /"@type":"OfferCatalog"/);
  assert.match(seo.ssrItemsHtml, /href="\/item\/ergobaby-omni-360-carrier"/);
  assert.match(seo.ssrCategoryHtml, /href="\/category\/baby-carriers"/);
});

test("product and service pages emit rich Product/Service schema, breadcrumbs, and XSS-safe JSON-LD", () => {
  const productSeo = buildStorefrontSeoData({
    origin: "https://alicebabycare.store254.co.ke",
    route: { kind: "item", slug: "ergobaby-omni-360-carrier" },
    payload: samplePayload,
    itemDetail: {
      tenant: samplePayload.tenant,
      item: samplePayload.items[0],
      category: samplePayload.categories[0],
      reviews: [{ customerName: "Grace", rating: 5, comment: "Super comfortable!" }],
    },
    isPreview: false,
  });

  assert.equal(productSeo.status, 200);
  assert.equal(productSeo.downgradeBannerHeading, true);
  assert.match(productSeo.title, /^Ergobaby Omni 360 Carrier \(KES 8,500\) \| Alice Baby Care$/);
  assert.match(productSeo.headTagsHtml, /"@type":"Product"/);
  assert.match(productSeo.headTagsHtml, /"@type":"AggregateOffer"/);
  assert.match(productSeo.headTagsHtml, /"priceCurrency":"KES"/);
  assert.match(productSeo.headTagsHtml, /"@type":"AggregateRating"/);
  assert.match(productSeo.headTagsHtml, /"@type":"BreadcrumbList"/);
  assert.doesNotMatch(productSeo.headTagsHtml, /<\/script><script>/);
  assert.match(productSeo.ssrItemDetailHtml, /<h1[^>]*>Ergobaby Omni 360 Carrier<\/h1>/);

  const serviceSeo = buildStorefrontSeoData({
    origin: "https://alicebabycare.store254.co.ke",
    route: { kind: "item", slug: "newborn-sleep-consultation" },
    payload: samplePayload,
    isPreview: false,
  });

  assert.equal(serviceSeo.status, 200);
  assert.match(serviceSeo.headTagsHtml, /"@type":"Service"/);
  assert.match(serviceSeo.headTagsHtml, /"@type":"LocalBusiness"/);
  assert.match(serviceSeo.headTagsHtml, /"price":"3500"/);

  const missingSeo = buildStorefrontSeoData({
    origin: "https://alicebabycare.store254.co.ke",
    route: { kind: "item", slug: "missing-product" },
    payload: samplePayload,
    isPreview: false,
  });
  assert.equal(missingSeo.status, 404);
  assert.equal(missingSeo.robots, "noindex, nofollow");

  assert.equal(safeJsonLd({ a: "</script>" }), '{"a":"\\u003c/script\\u003e"}');
});

test("thin or empty storefronts auto-noindex and are excluded from directory and sitemaps", () => {
  const emptyStoreSeo = buildStorefrontSeoData({
    origin: "https://newemptyshop.store254.co.ke",
    route: { kind: "home" },
    payload: {
      ...samplePayload,
      tenant: { ...samplePayload.tenant, name: "New Empty Shop", subdomain: "newemptyshop" },
      items: [],
    },
    isPreview: false,
  });
  assert.equal(emptyStoreSeo.robots, "noindex, follow");
  assert.match(emptyStoreSeo.headTagsHtml, /content="noindex, follow"/);

  const emptySitemap = buildStorefrontSitemapXml("https://newemptyshop.store254.co.ke", {
    ...samplePayload,
    items: [],
  });
  assert.doesNotMatch(emptySitemap, /<url>/);

  const mixedStores = [
    ...sampleStores,
    { id: "tenant-empty", name: "Empty Signup", subdomain: "emptyshop", businessType: "RETAIL", itemCount: 0 },
    { id: "tenant-demo-retail", name: "Demo Store", subdomain: "demo", businessType: "RETAIL", itemCount: 10 },
  ];
  const indexable = filterIndexableStores(mixedStores);
  assert.equal(indexable.length, 1);
  assert.equal(indexable[0].subdomain, "alicebabycare");
});

test("directory hubs paginate active stores, emit prev/next canonicals, and connect store category hubs", () => {
  const manyStores = Array.from({ length: 105 }, (_, i) => ({
    id: `tenant-${i}`,
    name: `Kenya Shop ${i + 1}`,
    subdomain: `kenyashop-${i + 1}`,
    businessType: i % 2 === 0 ? "RETAIL" : "ELECTRONICS",
    itemCount: 3,
    settings: { tagline: "Quality items" },
  }));

  const page2 = buildPlatformDirectoryHtml(manyStores, { page: 2, isPreview: false });
  assert.equal(page2.status, 200);
  assert.match(page2.html, /<link rel="canonical" href="https:\/\/store254\.co\.ke\/directory\?page=2">/);
  assert.match(page2.html, /<link rel="prev" href="https:\/\/store254\.co\.ke\/directory">/);
  assert.match(page2.html, /https:\/\/kenyashop-105\.store254\.co\.ke\//);

  const retailHub = buildPlatformDirectoryHtml(manyStores, { categorySlug: "retail", page: 1 });
  assert.equal(retailHub.status, 200);
  assert.match(retailHub.html, /Retail Online Stores/);

  const badHub = buildPlatformDirectoryHtml(manyStores, { categorySlug: "unknown-cat" });
  assert.equal(badHub.status, 404);
  assert.equal(badHub.robots, "noindex, nofollow");

  assert.deepEqual(getDirectoryHubForBusinessType("ELECTRONICS"), {
    href: "https://store254.co.ke/directory/electronics",
    label: "More Electronics Stores",
    slug: "electronics",
  });
});

test("sanitizeSlug blocks fintech and auth phishing subdomains", () => {
  for (const blocked of ["mpesa", "safaricom", "pay", "checkout", "login", "verify", "admin"]) {
    assert.equal(sanitizeSlug(blocked), "", `expected ${blocked} to be rejected`);
  }
  assert.equal(sanitizeSlug("alice-baby-shop"), "alice-baby-shop");
});

test("about page and platform schema identify Kelvin Kamau, Kayzen Labs Software Company Limited, and kelvin@store254.co.ke", () => {
  const about = buildPlatformAboutHtml(false);
  assert.equal(about.status, 200);
  assert.match(about.robots, /^index, follow/);
  assert.match(about.html, /<link rel="canonical" href="https:\/\/store254\.co\.ke\/about">/);
  assert.match(about.html, /"@type":"AboutPage"/);
  assert.match(about.html, /"@type":"Person"/);
  assert.match(about.html, /Kelvin Kamau/);
  assert.match(about.html, /Kayzen Labs Software Company Limited/);
  assert.match(about.html, /kelvin@store254\.co\.ke/);

  const rootSitemap = buildPlatformSitemapXml(sampleStores);
  assert.match(rootSitemap, /<loc>https:\/\/store254\.co\.ke\/about<\/loc>/);

  const platformSeo = buildPlatformSeoData(sampleStores, false);
  assert.match(platformSeo.headTagsHtml, /Kelvin Kamau/);
  assert.match(platformSeo.headTagsHtml, /Kayzen Labs Software Company Limited/);
});
