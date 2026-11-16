export const PRIMARY_DOMAIN = "store254.co.ke";

export interface PlatformStoreSeo {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  businessType?: string;
  currency?: string;
  settings?: Record<string, unknown>;
  itemCount?: number;
  updatedAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
}

export interface TenantSeo {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  businessType: string;
  currency: string;
  status: string;
  settings?: Record<string, unknown>;
}

export interface SeoCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
  description?: string | null;
}

export interface SeoVariant {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  options?: Record<string, string>;
}

export interface SeoReview {
  customerName: string;
  rating: number;
  comment?: string | null;
  isVerifiedBuyer?: boolean;
  createdAt?: string | number | Date | null;
}

export interface SeoItem {
  id: string;
  categoryId?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  itemType: "PHYSICAL" | "SERVICE" | "DIGITAL" | string;
  basePrice: number;
  compareAtPrice?: number | null;
  sku?: string | null;
  trackInventory?: boolean;
  stockQuantity: number;
  images?: string[] | null;
  attributes?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  variants?: SeoVariant[];
  reviewCount?: number;
  avgRating?: number;
  updatedAt?: string | number | Date | null;
  createdAt?: string | number | Date | null;
}

export interface SeoStorefrontPayload {
  tenant: TenantSeo;
  categories: SeoCategory[];
  items: SeoItem[];
}

export interface SeoItemDetailPayload {
  tenant: TenantSeo;
  item: SeoItem;
  category: SeoCategory | null;
  reviews: SeoReview[];
}

export type StorefrontRoute =
  | { kind: "home" }
  | { kind: "category"; slug: string }
  | { kind: "item"; slug: string }
  | { kind: "admin" }
  | { kind: "other" };

export interface HostClassification {
  hostname: string;
  isPreviewHost: boolean;
  isLocalHost: boolean;
  isPlatformRoot: boolean;
}

const RESERVED_SUBDOMAINS = new Set([
  "account",
  "accounts",
  "admin",
  "administrator",
  "api",
  "app",
  "assets",
  "auth",
  "bank",
  "billing",
  "cdn",
  "cdn1",
  "cdn2",
  "checkout",
  "dashboard",
  "directory",
  "docs",
  "ftp",
  "help",
  "login",
  "m-pesa",
  "mail",
  "media",
  "mpesa",
  "ns1",
  "ns2",
  "oauth",
  "official",
  "pay",
  "payment",
  "payments",
  "portal",
  "register",
  "root",
  "safaricom",
  "security",
  "shop",
  "signin",
  "signup",
  "sso",
  "static",
  "status",
  "statuspage",
  "store",
  "store254",
  "stores",
  "support",
  "sysadmin",
  "system",
  "trust",
  "verify",
  "wallet",
  "webhook",
  "webhooks",
  "webmail",
  "www",
]);

export const DIRECTORY_PAGE_SIZE = 100;

export const DIRECTORY_CATEGORIES: ReadonlyArray<{ slug: string; label: string; enumType: string }> = [
  { slug: "retail", label: "Retail", enumType: "RETAIL" },
  { slug: "fashion", label: "Fashion & Footwear", enumType: "FASHION" },
  { slug: "electronics", label: "Electronics", enumType: "ELECTRONICS" },
  { slug: "beauty", label: "Beauty & Salons", enumType: "BEAUTY" },
  { slug: "food-beverage", label: "Food & Groceries", enumType: "FOOD_BEVERAGE" },
  { slug: "furniture", label: "Furniture & Decor", enumType: "FURNITURE" },
  { slug: "hardware", label: "Hardware & Building", enumType: "BUILDING_HARDWARE" },
  { slug: "pharmacy", label: "Pharmacy & Health", enumType: "PHARMACY_HEALTH" },
  { slug: "agriculture", label: "Agrovets & Farming", enumType: "AGRICULTURE" },
  { slug: "automotive", label: "Auto Spares & Motors", enumType: "AUTOMOTIVE" },
  { slug: "real-estate", label: "Real Estate & Rentals", enumType: "REAL_ESTATE" },
  { slug: "services", label: "Services", enumType: "SERVICES" },
  { slug: "digital-tech", label: "Digital & Tech", enumType: "DIGITAL_TECH" },
  { slug: "events-hospitality", label: "Events & Hospitality", enumType: "EVENTS_HOSPITALITY" },
  { slug: "education", label: "Books & Education", enumType: "EDUCATION" },
  { slug: "kids-baby", label: "Baby & Kids", enumType: "KIDS_BABY" },
  { slug: "sports-fitness", label: "Sports & Fitness", enumType: "SPORTS_FITNESS" },
  { slug: "wholesale", label: "Wholesale & B2B", enumType: "WHOLESALE_B2B" },
  { slug: "logistics", label: "Logistics & Courier", enumType: "LOGISTICS_DELIVERY" },
  { slug: "general", label: "General", enumType: "GENERAL" },
];

export function filterIndexableStores(stores: PlatformStoreSeo[] = []): PlatformStoreSeo[] {
  return stores.filter((store) => {
    if (!store?.subdomain) return false;
    if (String(store.id || "").startsWith("tenant-demo-")) return false;
    if (typeof store.itemCount === "number" && store.itemCount <= 0) return false;
    return true;
  });
}

export function getDirectoryHubForBusinessType(businessType?: string | null): {
  href: string;
  label: string;
  slug: string;
} {
  const normalized = String(businessType || "").trim().toUpperCase();
  const match = DIRECTORY_CATEGORIES.find((cat) => cat.enumType === normalized);
  if (match) {
    return {
      href: `https://${PRIMARY_DOMAIN}/directory/${match.slug}`,
      label: `More ${match.label} Stores`,
      slug: match.slug,
    };
  }
  return {
    href: `https://${PRIMARY_DOMAIN}/directory`,
    label: "Store254 Directory",
    slug: "",
  };
}

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function sanitizeSlug(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = raw.trim().toLowerCase();
  if (!SUBDOMAIN_REGEX.test(cleaned) || RESERVED_SUBDOMAINS.has(cleaned)) return "";
  return cleaned;
}

export function classifyHost(rawHostname: string): HostClassification {
  const hostname = rawHostname.toLowerCase().trim();
  const isPreviewHost = hostname.endsWith(".workers.dev") || hostname.endsWith(".pages.dev");
  const isLocalHost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost");
  const isPlatformRoot =
    hostname === PRIMARY_DOMAIN ||
    hostname === `www.${PRIMARY_DOMAIN}` ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    isPreviewHost;

  return {
    hostname,
    isPreviewHost,
    isLocalHost,
    isPlatformRoot,
  };
}

export function parseStorefrontRoute(pathname: string): StorefrontRoute {
  const normalized = pathname || "/";
  if (normalized === "/" || normalized === "/index.html") {
    return { kind: "home" };
  }

  if (
    normalized === "/admin" ||
    normalized === "/admin/" ||
    normalized === "/admin.html" ||
    normalized === "/super-admin" ||
    normalized === "/super-admin/" ||
    normalized === "/super-admin.html" ||
    normalized === "/super-admin-login" ||
    normalized === "/super-admin-login/" ||
    normalized === "/super-admin-login.html"
  ) {
    return { kind: "admin" };
  }

  const categoryMatch = normalized.match(/^\/category\/([^/]+)\/?$/);
  if (categoryMatch) {
    try {
      return { kind: "category", slug: decodeURIComponent(categoryMatch[1]) };
    } catch {
      return { kind: "other" };
    }
  }

  const itemMatch = normalized.match(/^\/item\/([^/]+)\/?$/);
  if (itemMatch) {
    try {
      return { kind: "item", slug: decodeURIComponent(itemMatch[1]) };
    } catch {
      return { kind: "other" };
    }
  }

  return { kind: "other" };
}

export function resolveTenantCanonicalOrigin(requestUrl: URL, tenant?: Pick<TenantSeo, "subdomain" | "customDomain"> | null): string {
  const hostInfo = classifyHost(requestUrl.hostname);
  if (tenant?.customDomain && hostInfo.hostname === tenant.customDomain.toLowerCase()) {
    return `https://${tenant.customDomain.toLowerCase()}`;
  }
  if (tenant?.subdomain) {
    if (hostInfo.isLocalHost && requestUrl.hostname.endsWith(".localhost")) {
      return requestUrl.origin;
    }
    return `https://${tenant.subdomain}.${PRIMARY_DOMAIN}`;
  }
  if (!hostInfo.isPlatformRoot) {
    return `https://${hostInfo.hostname}`;
  }
  return `https://${PRIMARY_DOMAIN}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}

export function escapeXml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return ch;
    }
  });
}

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function truncateSeoText(text: string, maxLength = 158): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}

export function formatIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value;
    date = new Date(ms);
  } else {
    const num = Number(value);
    if (!Number.isNaN(num) && String(value).trim() !== "") {
      date = new Date(num < 1_000_000_000_000 ? num * 1000 : num);
    } else {
      date = new Date(String(value));
    }
  }
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toAbsoluteUrl(rawUrl: unknown, origin: string): string {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed || /^data:/i.test(trimmed) || /^javascript:/i.test(trimmed)) return "";
  if (trimmed.startsWith("/")) return `${origin}${trimmed}`;
  if (trimmed.startsWith("./")) return `${origin}/${trimmed.slice(2)}`;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function parseSettings(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, any>) : {};
}

function buildSocialSameAs(socialLinks: unknown): string[] {
  if (!socialLinks || typeof socialLinks !== "object") return [];
  const links = socialLinks as Record<string, unknown>;
  const profiles: Record<string, string> = {
    instagram: "https://www.instagram.com/",
    facebook: "https://www.facebook.com/",
    tiktok: "https://www.tiktok.com/@",
    twitter: "https://x.com/",
  };
  const results: string[] = [];
  for (const [key, raw] of Object.entries(links)) {
    const val = typeof raw === "string" ? raw.trim() : "";
    if (!val) continue;
    if (/^https?:\/\//i.test(val)) {
      results.push(val);
      continue;
    }
    if (key === "whatsapp") {
      const phone = val.replace(/\D/g, "");
      if (phone) results.push(`https://wa.me/${phone}`);
      continue;
    }
    const base = profiles[key];
    const handle = val.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
    if (base && handle) {
      results.push(`${base}${encodeURIComponent(handle)}`);
    }
  }
  return results;
}

function resolveStoreOriginForPlatform(store: Pick<PlatformStoreSeo, "subdomain" | "customDomain">): string {
  if (store.customDomain) {
    return `https://${store.customDomain.toLowerCase()}`;
  }
  return `https://${store.subdomain}.${PRIMARY_DOMAIN}`;
}

export function buildRobotsTxt(options: {
  isPreview: boolean;
  canonicalOrigin: string;
  stores?: PlatformStoreSeo[];
  includePlatformIndex?: boolean;
}): string {
  if (options.isPreview) {
    return "User-agent: *\nDisallow: /\n";
  }

  const lines = [
    "User-agent: *",
    "Allow: /",
    "Allow: /api/media/",
    "Allow: /api/platform/stores",
    "Allow: /api/platform/search/",
    "Allow: /api/platform/locations/",
    "Allow: /api/platform/google-config",
    "Allow: /api/platform/me",
    "Allow: /api/store",
    "Allow: /api/categories",
    "Allow: /api/filters",
    "Allow: /api/items",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /admin",
    "Disallow: /admin.html",
    "Disallow: /super-admin",
    "Disallow: /super-admin.html",
    "Disallow: /super-admin-login",
    "Disallow: /super-admin-login.html",
    "Disallow: /offline.html",
    "Disallow: /cdn-cgi/",
    "",
  ];

  if (options.includePlatformIndex) {
    lines.push(`Sitemap: ${options.canonicalOrigin}/sitemap-index.xml`);
    lines.push(`Sitemap: ${options.canonicalOrigin}/sitemap.xml`);
    const seen = new Set<string>();
    // Keep robots.txt comfortably below Google's 500 KiB limit; sitemap-index.xml holds up to 50,000 sitemaps.
    const MAX_ROBOTS_STORE_SITEMAPS = 2000;
    for (const store of filterIndexableStores(options.stores || [])) {
      if (seen.size >= MAX_ROBOTS_STORE_SITEMAPS) break;
      const storeOrigin = resolveStoreOriginForPlatform(store);
      const sitemapUrl = `${storeOrigin}/sitemap.xml`;
      if (!seen.has(sitemapUrl)) {
        seen.add(sitemapUrl);
        lines.push(`Sitemap: ${sitemapUrl}`);
      }
    }
  } else {
    lines.push(`Sitemap: ${options.canonicalOrigin}/sitemap.xml`);
  }

  return `${lines.join("\n")}\n`;
}

export function buildPlatformSitemapXml(stores: PlatformStoreSeo[] = []): string {
  const origin = `https://${PRIMARY_DOMAIN}`;
  const indexableStores = filterIndexableStores(stores);
  const latestTimestamp = indexableStores
    .map((s) => formatIsoDate(s.updatedAt || s.createdAt))
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  const urls: string[] = [
    [
      "  <url>",
      `    <loc>${escapeXml(origin)}/</loc>`,
      latestTimestamp ? `    <lastmod>${escapeXml(latestTimestamp)}</lastmod>` : "",
      "    <changefreq>daily</changefreq>",
      "    <priority>1.0</priority>",
      `    <image:image><image:loc>${escapeXml(origin)}/assets/store254Logo.webp</image:loc></image:image>`,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
    [
      "  <url>",
      `    <loc>${escapeXml(origin)}/stores</loc>`,
      latestTimestamp ? `    <lastmod>${escapeXml(latestTimestamp)}</lastmod>` : "",
      "    <changefreq>daily</changefreq>",
      "    <priority>0.9</priority>",
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
    [
      "  <url>",
      `    <loc>${escapeXml(origin)}/about</loc>`,
      "    <changefreq>monthly</changefreq>",
      "    <priority>0.7</priority>",
      "  </url>",
    ].join("\n"),
    [
      "  <url>",
      `    <loc>${escapeXml(origin)}/terms</loc>`,
      "    <changefreq>monthly</changefreq>",
      "    <priority>0.6</priority>",
      "  </url>",
    ].join("\n"),
    [
      "  <url>",
      `    <loc>${escapeXml(origin)}/privacy</loc>`,
      "    <changefreq>monthly</changefreq>",
      "    <priority>0.6</priority>",
      "  </url>",
    ].join("\n"),
  ];

  const totalDirPages = Math.max(1, Math.ceil(indexableStores.length / DIRECTORY_PAGE_SIZE));
  for (let p = 1; p <= totalDirPages; p++) {
    const loc = p === 1 ? `${origin}/directory` : `${origin}/directory?page=${p}`;
    urls.push(
      [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        latestTimestamp ? `    <lastmod>${escapeXml(latestTimestamp)}</lastmod>` : "",
        "    <changefreq>daily</changefreq>",
        `    <priority>${p === 1 ? "0.9" : "0.7"}</priority>`,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  for (const cat of DIRECTORY_CATEGORIES) {
    const catCount = indexableStores.filter(
      (s) => String(s.businessType || "GENERAL").toUpperCase() === cat.enumType
    ).length;
    if (catCount === 0) continue;
    const catPages = Math.max(1, Math.ceil(catCount / DIRECTORY_PAGE_SIZE));
    for (let p = 1; p <= catPages; p++) {
      const loc = p === 1 ? `${origin}/directory/${cat.slug}` : `${origin}/directory/${cat.slug}?page=${p}`;
      urls.push(
        [
          "  <url>",
          `    <loc>${escapeXml(loc)}</loc>`,
          latestTimestamp ? `    <lastmod>${escapeXml(latestTimestamp)}</lastmod>` : "",
          "    <changefreq>daily</changefreq>",
          `    <priority>${p === 1 ? "0.8" : "0.6"}</priority>`,
          "  </url>",
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    "</urlset>",
  ].join("\n");
}

export function buildPlatformSitemapIndexXml(stores: PlatformStoreSeo[] = []): string {
  const indexableStores = filterIndexableStores(stores);
  const rootOrigin = `https://${PRIMARY_DOMAIN}`;
  const latestTimestamp = indexableStores
    .map((s) => formatIsoDate(s.updatedAt || s.createdAt))
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();
  const entries = [
    [
      "  <sitemap>",
      `    <loc>${escapeXml(rootOrigin)}/sitemap.xml</loc>`,
      latestTimestamp ? `    <lastmod>${escapeXml(latestTimestamp)}</lastmod>` : "",
      "  </sitemap>",
    ]
      .filter(Boolean)
      .join("\n"),
  ];

  const seenOrigins = new Set<string>();
  const MAX_SITEMAP_INDEX_ENTRIES = 49999;
  for (const store of indexableStores) {
    if (seenOrigins.size >= MAX_SITEMAP_INDEX_ENTRIES) break;
    if (!store?.subdomain) continue;
    const storeOrigin = resolveStoreOriginForPlatform(store);
    if (seenOrigins.has(storeOrigin)) continue;
    seenOrigins.add(storeOrigin);
    const lastmod = formatIsoDate(store.updatedAt || store.createdAt);
    entries.push(
      [
        "  <sitemap>",
        `    <loc>${escapeXml(storeOrigin)}/sitemap.xml</loc>`,
        lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : "",
        "  </sitemap>",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</sitemapindex>",
  ].join("\n");
}

export function buildStorefrontSitemapXml(origin: string, payload: SeoStorefrontPayload): string {
  const { tenant, categories = [], items = [] } = payload;
  if (items.length === 0) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
      "</urlset>",
    ].join("\n");
  }
  const settings = parseSettings(tenant.settings);
  const storeImage = toAbsoluteUrl(settings.bannerUrl || settings.logoUrl, origin);
  const latestStoreMod = items
    .map((it) => formatIsoDate(it.updatedAt || it.createdAt))
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();
  const urls: string[] = [];

  urls.push(
    [
      "  <url>",
      `    <loc>${escapeXml(origin)}/</loc>`,
      latestStoreMod ? `    <lastmod>${escapeXml(latestStoreMod)}</lastmod>` : "",
      "    <changefreq>daily</changefreq>",
      "    <priority>1.0</priority>",
      storeImage
        ? `    <image:image><image:loc>${escapeXml(storeImage)}</image:loc><image:title>${escapeXml(tenant.name)}</image:title></image:image>`
        : "",
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n")
  );

  const childCategoryMap = new Map<string, Set<string>>();
  for (const cat of categories) {
    if (cat.parentId) {
      const set = childCategoryMap.get(cat.parentId) || new Set<string>();
      set.add(cat.id);
      childCategoryMap.set(cat.parentId, set);
    }
  }

  for (const cat of categories) {
    if (!cat.slug) continue;
    const childIds = childCategoryMap.get(cat.id);
    const catLastMod = items
      .filter((it) => it.categoryId === cat.id || (it.categoryId && childIds?.has(it.categoryId)))
      .map((it) => formatIsoDate(it.updatedAt || it.createdAt))
      .filter((d): d is string => Boolean(d))
      .sort()
      .pop();
    urls.push(
      [
        "  <url>",
        `    <loc>${escapeXml(`${origin}/category/${encodeURIComponent(cat.slug)}`)}</loc>`,
        catLastMod ? `    <lastmod>${escapeXml(catLastMod)}</lastmod>` : "",
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  for (const item of items) {
    if (!item.slug) continue;
    const lastmod = formatIsoDate(item.updatedAt || item.createdAt);
    const images = Array.isArray(item.images)
      ? item.images.map((img) => toAbsoluteUrl(img, origin)).filter(Boolean).slice(0, 5)
      : [];

    urls.push(
      [
        "  <url>",
        `    <loc>${escapeXml(`${origin}/item/${encodeURIComponent(item.slug)}`)}</loc>`,
        lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : "",
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.9</priority>",
        ...images.map(
          (img) =>
            `    <image:image><image:loc>${escapeXml(img)}</image:loc><image:title>${escapeXml(item.title)}</image:title></image:image>`
        ),
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...urls,
    "</urlset>",
  ].join("\n");
}

const SCHEMA_STORE_TYPES: Record<string, string> = {
  ELECTRONICS: "ElectronicsStore",
  DIGITAL_TECH: "ComputerStore",
  FURNITURE: "FurnitureStore",
  BUILDING_HARDWARE: "HardwareStore",
  FASHION: "ClothingStore",
  BEAUTY: "HealthAndBeautyBusiness",
  FOOD_BEVERAGE: "Restaurant",
  PHARMACY_HEALTH: "Pharmacy",
  AUTOMOTIVE: "AutoPartsStore",
  REAL_ESTATE: "RealEstateAgent",
  EDUCATION: "BookStore",
  SPORTS_FITNESS: "SportingGoodsStore",
  WHOLESALE_B2B: "WholesaleStore",
  SERVICES: "ProfessionalService",
  LOGISTICS_DELIVERY: "MovingCompany",
  RETAIL: "Store",
};

function getSchemaStoreType(businessType: string | undefined): string {
  return SCHEMA_STORE_TYPES[String(businessType || "").toUpperCase()] || "OnlineStore";
}

function getItemAvailabilityUrl(item: SeoItem): string {
  if (item.itemType === "SERVICE" || item.itemType === "DIGITAL") {
    return "https://schema.org/InStock";
  }
  const hasVariantStock =
    Array.isArray(item.variants) && item.variants.some((v) => Number(v.stockQuantity) > 0);
  if (item.trackInventory === false || Number(item.stockQuantity) > 0 || hasVariantStock) {
    return "https://schema.org/InStock";
  }
  return "https://schema.org/OutOfStock";
}

function buildStoreSchemaNode(origin: string, tenant: TenantSeo): Record<string, unknown> {
  const settings = parseSettings(tenant.settings);
  const logo = toAbsoluteUrl(settings.logoUrl, origin) || `${origin}/assets/store254Icon.webp`;
  const banner = toAbsoluteUrl(settings.bannerUrl, origin) || logo;
  const phone = settings.contactPhone || settings.phone || "";
  const email = settings.contactEmail || "";
  const physicalAddress = settings.physicalAddress || "";
  const sameAs = buildSocialSameAs(settings.socialLinks);

  const node: Record<string, unknown> = {
    "@type": getSchemaStoreType(tenant.businessType),
    "@id": `${origin}/#store`,
    name: tenant.name,
    alternateName: [tenant.subdomain, `${tenant.subdomain}.${PRIMARY_DOMAIN}`],
    url: `${origin}/`,
    description:
      settings.description ||
      settings.tagline ||
      `Shop directly from ${tenant.name} on Store254 with instant M-Pesa checkout.`,
    image: banner,
    logo,
    paymentAccepted: "M-Pesa",
    currenciesAccepted: tenant.currency || "KES",
    memberOf: {
      "@type": "Organization",
      "@id": `https://${PRIMARY_DOMAIN}/#organization`,
      name: "Store254",
      url: `https://${PRIMARY_DOMAIN}/`,
    },
  };

  if (phone) node.telephone = String(phone);
  if (email) node.email = String(email);
  if (sameAs.length > 0) node.sameAs = sameAs;
  node.address = physicalAddress
    ? {
        "@type": "PostalAddress",
        streetAddress: String(physicalAddress),
        addressCountry: "KE",
      }
    : {
        "@type": "PostalAddress",
        addressCountry: "KE",
      };

  return node;
}

function buildItemSchemaNode(
  origin: string,
  tenant: TenantSeo,
  item: SeoItem,
  categoryName: string | null,
  reviews: SeoReview[] = []
): Record<string, unknown> {
  const currency = tenant.currency || "KES";
  const settings = parseSettings(tenant.settings);
  const itemUrl = `${origin}/item/${encodeURIComponent(item.slug)}`;
  const rawImages = Array.isArray(item.images)
    ? item.images.map((img) => toAbsoluteUrl(img, origin)).filter(Boolean)
    : [];
  const fallbackStoreImg = toAbsoluteUrl(settings.bannerUrl || settings.logoUrl, origin);
  const images = rawImages.length > 0 ? rawImages : fallbackStoreImg ? [fallbackStoreImg] : [`${origin}/assets/store254Logo.webp`];
  const attrs = item.attributes && typeof item.attributes === "object" ? item.attributes : {};
  const brandName = typeof attrs.brand === "string" && attrs.brand.trim() ? attrs.brand.trim() : tenant.name;
  const cleanDescription =
    (typeof item.description === "string" && item.description.trim()) ||
    `${item.title} offered by ${tenant.name} (${currency} ${Number(item.basePrice).toLocaleString()}).`;

  const variants = Array.isArray(item.variants) ? item.variants : [];
  const variantPrices = variants.map((v) => Number(v.price)).filter((p) => Number.isFinite(p) && p > 0);
  const minPrice = variantPrices.length > 0 ? Math.min(item.basePrice, ...variantPrices) : item.basePrice;
  const maxPrice = variantPrices.length > 0 ? Math.max(item.basePrice, ...variantPrices) : item.basePrice;
  const availability = getItemAvailabilityUrl(item);

  const offer =
    variantPrices.length > 0 && maxPrice > minPrice
      ? {
          "@type": "AggregateOffer",
          url: itemUrl,
          priceCurrency: currency,
          lowPrice: String(minPrice),
          highPrice: String(maxPrice),
          offerCount: variants.length,
          availability,
          seller: {
            "@type": "Organization",
            name: tenant.name,
            url: `${origin}/`,
          },
        }
      : {
          "@type": "Offer",
          url: itemUrl,
          priceCurrency: currency,
          price: String(item.basePrice),
          availability,
          ...(item.itemType !== "SERVICE" ? { itemCondition: "https://schema.org/NewCondition" } : {}),
          seller: {
            "@type": "Organization",
            name: tenant.name,
            url: `${origin}/`,
          },
        };

  if (item.itemType === "SERVICE") {
    const serviceSchema: Record<string, unknown> = {
      "@type": "Service",
      "@id": `${itemUrl}#service`,
      name: item.title,
      description: cleanDescription,
      url: itemUrl,
      image: images,
      serviceType: categoryName || item.title,
      category: categoryName || "Services",
      provider: {
        "@id": `${origin}/#store`,
        "@type": "LocalBusiness",
        name: tenant.name,
        url: `${origin}/`,
      },
      areaServed: {
        "@type": "Country",
        name: "Kenya",
      },
      offers: offer,
    };
    if ((item.reviewCount || 0) > 0 && (item.avgRating || 0) > 0) {
      serviceSchema.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: String(item.avgRating),
        reviewCount: String(item.reviewCount),
        bestRating: "5",
        worstRating: "1",
      };
    }
    return serviceSchema;
  }

  const productSchema: Record<string, unknown> = {
    "@type": "Product",
    "@id": `${itemUrl}#product`,
    name: item.title,
    description: cleanDescription,
    url: itemUrl,
    image: images,
    sku: item.sku || item.id,
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    ...(categoryName ? { category: categoryName } : {}),
    offers: offer,
  };

  if ((item.reviewCount || 0) > 0 && (item.avgRating || 0) > 0) {
    productSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: String(item.avgRating),
      reviewCount: String(item.reviewCount),
      bestRating: "5",
      worstRating: "1",
    };
  }

  const nonEmptyReviews = reviews.filter((r) => typeof r.comment === "string" && r.comment.trim()).slice(0, 5);
  if (nonEmptyReviews.length > 0) {
    productSchema.review = nonEmptyReviews.map((rev) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: rev.customerName,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(rev.rating),
        bestRating: "5",
        worstRating: "1",
      },
      reviewBody: rev.comment,
      ...(formatIsoDate(rev.createdAt) ? { datePublished: formatIsoDate(rev.createdAt) } : {}),
    }));
  }

  return productSchema;
}

function buildStoreDirectoryCardHtml(store: PlatformStoreSeo, origin: string): string {
  const settings = parseSettings(store.settings);
  const href = `${resolveStoreOriginForPlatform(store)}/`;
  const desc = escapeHtml(
    settings.description || settings.tagline || "Browse products & services and pay directly via M-Pesa."
  );
  const initial = escapeHtml((store.name || "S").trim().slice(0, 1).toUpperCase());
  const badge = escapeHtml((store.businessType || "Store").replace(/_/g, " "));
  const bannerUrl = toAbsoluteUrl(settings.bannerUrl, origin);
  const logoUrl = toAbsoluteUrl(settings.logoUrl, origin);
  const coverStyle = bannerUrl
    ? `style="background-image: linear-gradient(180deg, rgba(16, 30, 22, 0.2), rgba(16, 30, 22, 0.72)), url('${escapeHtml(bannerUrl)}'); background-size: cover; background-position: center;"`
    : "";
  const avatar = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(store.name)}" loading="lazy" decoding="async" class="w-full h-full object-cover rounded-full">`
    : initial;

  return `
    <a href="${escapeHtml(href)}" class="platform-store-card bg-white rounded-xl border border-slate-200 hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer text-left group flex flex-col justify-between no-underline overflow-hidden">
      <div>
        <div class="platform-store-cover${bannerUrl ? " has-hero-photo" : ""}" ${coverStyle}>
          <span class="platform-store-avatar">${avatar}</span>
          <small>${badge}</small>
        </div>
        <div class="platform-store-details">
          <div>
            <h4 class="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate text-sm sm:text-base">${escapeHtml(store.name)}</h4>
            <span class="text-xs text-slate-400 font-mono truncate block mt-0.5">${escapeHtml(store.subdomain)}.${PRIMARY_DOMAIN}</span>
          </div>
          <p class="text-xs sm:text-[13px] text-slate-600 line-clamp-2 leading-relaxed mt-1.5">${desc}</p>
        </div>
      </div>
      <div class="platform-store-card-footer mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-bold text-emerald-600">
        <span class="flex items-center gap-1.5 text-xs sm:text-sm">Visit Storefront</span>
        <span class="platform-store-live-pill">Open</span>
      </div>
    </a>
  `;
}

export function buildPlatformSeoData(
  stores: PlatformStoreSeo[],
  isPreview: boolean,
  options: { view?: "home" | "stores" } = {}
): {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  headTagsHtml: string;
  ssrStoresHtml: string;
  ssrHomeHubsHtml: string;
} {
  const view = options.view === "stores" ? "stores" : "home";
  const indexableStores = filterIndexableStores(stores);
  const origin = `https://${PRIMARY_DOMAIN}`;
  const isStoresView = view === "stores";
  const title = isStoresView
    ? "Active Kenyan Storefronts | Store254"
    : "Store254 | Kenyan Online Stores, Local Search & M-Pesa Storefronts";
  const description = isStoresView
    ? "Browse verified independent Kenyan online stores across counties and towns on Store254."
    : "Store254 is Kenya's marketplace to search local products and services, discover independent Kenyan online stores, and launch your own .store254.co.ke storefront with M-Pesa.";
  const canonicalUrl = isStoresView ? `${origin}/stores` : `${origin}/`;
  const robots = isPreview
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const ogImage = `${origin}/assets/store254Logo.webp`;

  const itemListNode =
    indexableStores.length > 0
      ? [
          {
            "@type": "ItemList",
            name: "Active Storefronts on Store254",
            numberOfItems: Math.min(indexableStores.length, 50),
            itemListElement: indexableStores.slice(0, 50).map((s, idx) => {
              const settings = parseSettings(s.settings);
              const storeUrl = `${resolveStoreOriginForPlatform(s)}/`;
              return {
                "@type": "ListItem",
                position: idx + 1,
                url: storeUrl,
                name: s.name,
                description: settings.description || settings.tagline || `Online store on ${s.subdomain}.${PRIMARY_DOMAIN}`,
              };
            }),
          },
        ]
      : [];

  const graph = {
    "@context": "https://schema.org",
    "@graph": isStoresView
      ? [
          {
            "@type": "CollectionPage",
            "@id": `${canonicalUrl}#webpage`,
            url: canonicalUrl,
            name: title,
            description,
            inLanguage: "en-KE",
            isPartOf: { "@id": `${origin}/#website` },
            about: { "@id": `${origin}/#organization` },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Store254", item: `${origin}/` },
              { "@type": "ListItem", position: 2, name: "Active Storefronts", item: canonicalUrl },
            ],
          },
          ...itemListNode,
        ]
      : [
          {
            "@type": "Organization",
            "@id": `${origin}/#organization`,
            name: "Store254",
            alternateName: ["Store254.co.ke", "Store 254"],
            url: `${origin}/`,
            description,
            logo: {
              "@type": "ImageObject",
              url: ogImage,
            },
            image: ogImage,
            email: "kelvin@store254.co.ke",
            areaServed: {
              "@type": "Country",
              name: "Kenya",
            },
            founder: {
              "@type": "Person",
              "@id": `${origin}/about#founder`,
              name: "Kelvin Kamau",
              jobTitle: "Software Developer, Owner & CEO",
              email: "kelvin@store254.co.ke",
              url: `${origin}/about`,
              sameAs: ["https://github.com/Kelvohkash"],
            },
            parentOrganization: {
              "@type": "Organization",
              name: "Kayzen Labs Software Company Limited",
            },
          },
          {
            "@type": "WebSite",
            "@id": `${origin}/#website`,
            name: "Store254",
            alternateName: ["Store254.co.ke", "Store 254"],
            url: `${origin}/`,
            description,
            inLanguage: "en-KE",
            publisher: { "@id": `${origin}/#organization` },
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${origin}/?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          },
          {
            "@type": "WebPage",
            "@id": `${origin}/#webpage`,
            url: `${origin}/`,
            name: title,
            description,
            inLanguage: "en-KE",
            isPartOf: { "@id": `${origin}/#website` },
            about: { "@id": `${origin}/#organization` },
            primaryImageOfPage: ogImage,
          },
          ...itemListNode,
        ],
  };

  const headTagsHtml = [
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    `<meta name="robots" content="${escapeHtml(robots)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Store254">`,
    `<meta property="og:locale" content="en_KE">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:image" content="${escapeHtml(ogImage)}">`,
    `<meta property="og:image:alt" content="Store254 — Kenyan Online Stores & M-Pesa Storefronts">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}">`,
    `<script type="application/ld+json">${safeJsonLd(graph)}</script>`,
  ].join("");

  const featuredCardsHtml = indexableStores
    .slice(0, 50)
    .map((s) => buildStoreDirectoryCardHtml(s, origin))
    .join("");

  const categoryHubLinks = DIRECTORY_CATEGORIES.map((cat) => {
    const count = indexableStores.filter(
      (s) => String(s.businessType || "GENERAL").toUpperCase() === cat.enumType
    ).length;
    if (count === 0) return "";
    return `<a href="/directory/${cat.slug}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition-colors no-underline">${escapeHtml(cat.label)} (${count})</a>`;
  })
    .filter(Boolean)
    .join("");

  const directoryFooterHtml =
    indexableStores.length > 0
      ? `<nav aria-label="Store254 Marketplace Directory" class="col-span-full mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <a href="/directory" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors no-underline">All Verified Stores (${indexableStores.length})</a>
            ${categoryHubLinks}
          </div>
          ${
            indexableStores.length > 50
              ? `<a href="/directory?page=2" class="text-xs font-semibold text-emerald-700 hover:underline no-underline">Next Page &rarr;</a>`
              : ""
          }
        </nav>`
      : "";

  const ssrStoresHtml = `${featuredCardsHtml}${directoryFooterHtml}`;

  const topStoreTextLinks = indexableStores
    .slice(0, 12)
    .map((s) => {
      const href = `${resolveStoreOriginForPlatform(s)}/`;
      return `<a href="${escapeHtml(href)}" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 transition-colors no-underline">${escapeHtml(s.name)}</a>`;
    })
    .join("");

  const ssrHomeHubsHtml = [
    `<div class="flex flex-wrap items-center justify-between gap-2">`,
    `  <p class="m-0 font-bold text-slate-800">Explore Store254 Kenya</p>`,
    `  <div class="flex flex-wrap items-center gap-2">`,
    `    <a href="/stores" class="px-3 py-1 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 no-underline">Browse Active Stores${indexableStores.length > 0 ? ` (${indexableStores.length})` : ""}</a>`,
    `    <a href="/directory" class="px-3 py-1 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 no-underline">Business Directory</a>`,
    `    <a href="/about" class="px-3 py-1 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 no-underline">About Store254</a>`,
    `  </div>`,
    `</div>`,
    categoryHubLinks ? `<div class="flex flex-wrap items-center gap-1.5">${categoryHubLinks}</div>` : "",
    topStoreTextLinks ? `<div class="flex flex-wrap items-center gap-1.5"><span class="text-[11px] font-bold text-slate-500 mr-1">Featured shops:</span>${topStoreTextLinks}</div>` : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    title,
    description,
    canonicalUrl,
    robots,
    headTagsHtml,
    ssrStoresHtml,
    ssrHomeHubsHtml,
  };
}

export function buildPlatformDirectoryHtml(
  stores: PlatformStoreSeo[],
  options: { categorySlug?: string; page?: number; isPreview?: boolean } = {}
): {
  status: number;
  html: string;
  robots: string;
} {
  const indexableStores = filterIndexableStores(stores);
  const rawSlug = String(options.categorySlug || "").toLowerCase().trim();
  const matchedCategory = rawSlug ? DIRECTORY_CATEGORIES.find((c) => c.slug === rawSlug) || null : null;

  if (rawSlug && !matchedCategory) {
    return {
      status: 404,
      robots: "noindex, nofollow",
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><title>Directory Category Not Found | Store254</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center;"><h1>Directory Category Not Found</h1><p><a href="https://${PRIMARY_DOMAIN}/directory">Browse All Store254 Stores</a></p></body></html>`,
    };
  }

  const filtered = matchedCategory
    ? indexableStores.filter((s) => String(s.businessType || "GENERAL").toUpperCase() === matchedCategory.enumType)
    : indexableStores;

  const totalPages = Math.max(1, Math.ceil(filtered.length / DIRECTORY_PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Math.floor(Number(options.page) || 1)), totalPages);
  const start = (currentPage - 1) * DIRECTORY_PAGE_SIZE;
  const pageStores = filtered.slice(start, start + DIRECTORY_PAGE_SIZE);

  const origin = `https://${PRIMARY_DOMAIN}`;
  const basePath = matchedCategory ? `/directory/${matchedCategory.slug}` : "/directory";
  const canonicalUrl = currentPage > 1 ? `${origin}${basePath}?page=${currentPage}` : `${origin}${basePath}`;
  const prevUrl =
    currentPage > 1
      ? currentPage === 2
        ? `${origin}${basePath}`
        : `${origin}${basePath}?page=${currentPage - 1}`
      : null;
  const nextUrl = currentPage < totalPages ? `${origin}${basePath}?page=${currentPage + 1}` : null;

  const robots = options.isPreview
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1";

  const categoryTitle = matchedCategory ? `${matchedCategory.label} Online Stores` : "Kenyan Online Stores Directory";
  const pageSuffix = currentPage > 1 ? ` — Page ${currentPage}` : "";
  const title = `${categoryTitle}${pageSuffix} | Store254`;
  const description = truncateSeoText(
    `Browse ${filtered.length} verified ${matchedCategory ? `${matchedCategory.label.toLowerCase()} ` : ""}Kenyan businesses selling on Store254 with M-Pesa checkout.`
  );

  const ogImage = `${origin}/assets/store254Logo.webp`;
  const breadcrumbs = [
    { "@type": "ListItem", position: 1, name: "Store254", item: `${origin}/` },
    { "@type": "ListItem", position: 2, name: "Directory", item: `${origin}/directory` },
    ...(matchedCategory
      ? [{ "@type": "ListItem", position: 3, name: matchedCategory.label, item: `${origin}/directory/${matchedCategory.slug}` }]
      : []),
  ];

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#page`,
        url: canonicalUrl,
        name: title,
        description,
        inLanguage: "en-KE",
        isPartOf: { "@id": `${origin}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs,
      },
      {
        "@type": "ItemList",
        name: categoryTitle,
        numberOfItems: pageStores.length,
        itemListElement: pageStores.map((store, idx) => ({
          "@type": "ListItem",
          position: start + idx + 1,
          url: `${resolveStoreOriginForPlatform(store)}/`,
          name: store.name,
        })),
      },
    ],
  };

  const tabsHtml = [
    `<a href="/directory" style="padding:8px 14px;border-radius:999px;font-size:13px;font-weight:700;text-decoration:none;${!matchedCategory ? "background:#059669;color:#fff;" : "background:#f1f5f9;color:#334155;"}">All Stores (${indexableStores.length})</a>`,
    ...DIRECTORY_CATEGORIES.map((cat) => {
      const count = indexableStores.filter(
        (s) => String(s.businessType || "GENERAL").toUpperCase() === cat.enumType
      ).length;
      const isActive = matchedCategory?.slug === cat.slug;
      return `<a href="/directory/${cat.slug}" style="padding:8px 14px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;${isActive ? "background:#059669;color:#fff;" : "background:#f1f5f9;color:#334155;"}">${escapeHtml(cat.label)} (${count})</a>`;
    }),
  ].join("");

  const cardsHtml =
    pageStores.length > 0
      ? pageStores
          .map((s) => {
            const settings = parseSettings(s.settings);
            const href = `${resolveStoreOriginForPlatform(s)}/`;
            const desc = escapeHtml(
              truncateSeoText(settings.description || settings.tagline || "Verified Kenyan business on Store254", 120)
            );
            const catLabel = escapeHtml((s.businessType || "Store").replace(/_/g, " "));
            return `<article style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;">
              <div>
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#059669;margin-bottom:4px;">${catLabel}</div>
                <h2 style="margin:0;font-size:16px;font-weight:700;color:#0f172a;"><a href="${escapeHtml(href)}" style="color:inherit;text-decoration:none;">${escapeHtml(s.name)}</a></h2>
                <div style="font-size:12px;color:#64748b;font-family:monospace;margin-top:2px;">${escapeHtml(s.subdomain)}.${PRIMARY_DOMAIN}</div>
                <p style="margin:8px 0 0;font-size:13px;color:#475569;line-height:1.45;">${desc}</p>
              </div>
              <a href="${escapeHtml(href)}" style="font-size:13px;font-weight:700;color:#059669;text-decoration:none;">Visit Store &rarr;</a>
            </article>`;
          })
          .join("")
      : `<p style="color:#64748b;">No stores with published items listed in this category yet.</p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  ${prevUrl ? `<link rel="prev" href="${escapeHtml(prevUrl)}">` : ""}
  ${nextUrl ? `<link rel="next" href="${escapeHtml(nextUrl)}">` : ""}
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="icon" type="image/webp" href="${escapeHtml(origin)}/assets/store254Icon.webp">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Store254">
  <meta property="og:locale" content="en_KE">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <script type="application/ld+json">${safeJsonLd(graph)}</script>
</head>
<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;">
  <header style="background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 20px;">
    <div style="max-width:1180px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <a href="/" style="font-weight:800;font-size:18px;color:#059669;text-decoration:none;">Store254</a>
      <nav aria-label="Primary" style="display:flex;align-items:center;gap:16px;font-size:13px;font-weight:600;">
        <a href="/stores" style="color:#334155;text-decoration:none;">Active Storefronts</a>
        <a href="/about" style="color:#334155;text-decoration:none;">About Store254</a>
        <a href="/" style="color:#059669;text-decoration:none;">Search Products &rarr;</a>
      </nav>
    </div>
  </header>
  <main style="max-width:1180px;margin:0 auto;padding:28px 20px;">
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;">${escapeHtml(categoryTitle)}</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;">${escapeHtml(description)}</p>
    <nav aria-label="Directory categories" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px;">${tabsHtml}</nav>
    <section style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;">${cardsHtml}</section>
    <nav aria-label="Pagination" style="display:flex;align-items:center;justify-content:space-between;margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:14px;">
      <span>Page ${currentPage} of ${totalPages} (${filtered.length} stores)</span>
      <div style="display:flex;gap:16px;">
        ${prevUrl ? `<a href="${escapeHtml(prevUrl)}" style="color:#059669;font-weight:700;text-decoration:none;">&larr; Previous</a>` : ""}
        ${nextUrl ? `<a href="${escapeHtml(nextUrl)}" style="color:#059669;font-weight:700;text-decoration:none;">Next &rarr;</a>` : ""}
      </div>
    </nav>
  </main>
</body>
</html>`;

  return { status: 200, html, robots };
}

export function buildPlatformAboutHtml(isPreview = false): {
  status: number;
  html: string;
  robots: string;
} {
  const origin = `https://${PRIMARY_DOMAIN}`;
  const canonicalUrl = `${origin}/about`;
  const robots = isPreview
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1";
  const title = "About Store254 — Founded by Kelvin Kamau | Kayzen Labs Software Company Limited";
  const description =
    "Learn about Store254, Kenya's storefront and M-Pesa e-commerce platform created by Kelvin Kamau (Software Developer, Owner & CEO) under Kayzen Labs Software Company Limited.";
  const ogImage = `${origin}/assets/store254Logo.webp`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: title,
        description,
        isPartOf: { "@id": `${origin}/#website` },
        mainEntity: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Store254",
        url: `${origin}/`,
        logo: ogImage,
        email: "kelvin@store254.co.ke",
        description:
          "Store254 empowers Kenyan merchants and service providers to launch fast, search-indexed online storefronts with M-Pesa checkout.",
        founder: { "@id": `${canonicalUrl}#founder` },
        parentOrganization: { "@id": `${canonicalUrl}#company` },
      },
      {
        "@type": "Organization",
        "@id": `${canonicalUrl}#company`,
        name: "Kayzen Labs Software Company Limited",
        founder: { "@id": `${canonicalUrl}#founder` },
      },
      {
        "@type": "Person",
        "@id": `${canonicalUrl}#founder`,
        name: "Kelvin Kamau",
        jobTitle: "Software Developer, Owner & CEO",
        description:
          "Kelvin Kamau is a Kenyan software developer and the founder, owner, and CEO of Store254 and Kayzen Labs Software Company Limited.",
        email: "kelvin@store254.co.ke",
        url: canonicalUrl,
        worksFor: { "@id": `${canonicalUrl}#company` },
        owns: { "@id": `${origin}/#organization` },
        sameAs: ["https://github.com/Kelvohkash"],
      },
    ],
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Store254">
  <meta property="og:locale" content="en_KE">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  <script type="application/ld+json">${safeJsonLd(graph)}</script>
</head>
<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;line-height:1.65;">
  <header style="background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 20px;">
    <div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <a href="/" style="font-weight:800;font-size:18px;color:#059669;text-decoration:none;">Store254.co.ke</a>
      <div style="display:flex;gap:16px;font-size:13px;font-weight:600;">
        <a href="/directory" style="color:#334155;text-decoration:none;">Store Directory</a>
        <a href="/" style="color:#059669;text-decoration:none;">Launch Your Store &rarr;</a>
      </div>
    </div>
  </header>

  <main style="max-width:960px;margin:0 auto;padding:36px 20px 56px;">
    <section style="background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:32px;margin-bottom:24px;">
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;">About Store254</span>
      <h1 style="margin:12px 0 12px;font-size:32px;line-height:1.2;font-weight:800;color:#0f172a;">Empowering Kenyan Businesses to Sell Online</h1>
      <p style="margin:0 0 14px;color:#475569;font-size:16px;">
        <strong>Store254</strong> (<a href="https://store254.co.ke/" style="color:#059669;text-decoration:none;">store254.co.ke</a>) is a Kenyan e-commerce and digital storefront platform built to help local retailers, boutiques, electronics shops, furniture makers, and service providers launch professional online stores in minutes.
      </p>
      <p style="margin:0;color:#475569;font-size:15px;">
        Every business on Store254 receives an independent branded web address (such as <code style="background:#f1f5f9;padding:2px 6px;border-radius:6px;font-size:13px;">yourbusiness.store254.co.ke</code>) or custom domain mapping, integrated M-Pesa checkout, automatic WebP image optimization, and full Google Search indexing for every storefront, category, product, and service.
      </p>
    </section>

    <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-bottom:24px;">
      <article style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px;">
        <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">Built for Local Commerce</h2>
        <p style="margin:0;color:#475569;font-size:14px;">Designed around Kenyan shopping habits with fast mobile loading, WhatsApp-friendly sharing links, and seamless M-Pesa payments.</p>
      </article>
      <article style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px;">
        <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">Search-Engine Ready</h2>
        <p style="margin:0;color:#475569;font-size:14px;">Every active merchant store gets dedicated sitemaps, structured Product and Service schema, and clean URLs so customers find local businesses directly on Google.</p>
      </article>
      <article style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px;">
        <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">Edge Speed &amp; Reliability</h2>
        <p style="margin:0;color:#475569;font-size:14px;">Powered by global edge caching and automated media compression so storefronts open quickly even on mobile data connections.</p>
      </article>
    </section>

    <section style="background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:30px;">
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#0f172a;">Founder &amp; Operating Company</h2>
      <p style="margin:0 0 12px;color:#334155;font-size:15px;">
        Store254 was created by <strong>Kelvin Kamau</strong>, a Kenyan <strong>Software Developer</strong> and the <strong>Owner &amp; CEO</strong> of the platform.
      </p>
      <p style="margin:0 0 18px;color:#475569;font-size:15px;">
        The platform is developed and operated under <strong>Kayzen Labs Software Company Limited</strong>, focused on building reliable, scalable digital infrastructure for African businesses.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;display:flex;flex-wrap:wrap;gap:18px;font-size:14px;color:#334155;">
        <div><strong>Founder &amp; CEO:</strong> Kelvin Kamau (Software Developer)</div>
        <div><strong>Company:</strong> Kayzen Labs Software Company Limited</div>
        <div><strong>Email:</strong> <a href="mailto:kelvin@store254.co.ke" style="color:#059669;font-weight:600;text-decoration:none;">kelvin@store254.co.ke</a></div>
      </div>
    </section>
  </main>

  <footer style="border-top:1px solid #e2e8f0;background:#fff;padding:18px 20px;text-align:center;font-size:13px;color:#64748b;">
    &copy; 2026 Store254.co.ke &bull; Kayzen Labs Software Company Limited &bull; Nairobi, Kenya &bull;
    <a href="/terms" style="color:#059669;text-decoration:none;font-weight:600;">Terms &amp; Conditions</a> &bull;
    <a href="/privacy" style="color:#059669;text-decoration:none;font-weight:600;">Privacy Policy</a>
  </footer>
</body>
</html>`;

  return { status: 200, html, robots };
}

function renderLegalDocumentShell(options: {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  badge: string;
  heading: string;
  intro: string;
  updatedDate: string;
  sectionsHtml: string;
}): string {
  const origin = `https://${PRIMARY_DOMAIN}`;
  const ogImage = `${origin}/assets/store254Logo.webp`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${options.canonicalUrl}#webpage`,
        url: options.canonicalUrl,
        name: options.title,
        description: options.description,
        inLanguage: "en-KE",
        isPartOf: { "@id": `${origin}/#website` },
        about: { "@id": `${origin}/#organization` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Store254", item: `${origin}/` },
          { "@type": "ListItem", position: 2, name: options.heading, item: options.canonicalUrl },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(options.title)}</title>
  <meta name="description" content="${escapeHtml(options.description)}">
  <link rel="canonical" href="${escapeHtml(options.canonicalUrl)}">
  <meta name="robots" content="${escapeHtml(options.robots)}">
  <link rel="icon" type="image/webp" href="${escapeHtml(origin)}/assets/store254Icon.webp">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Store254">
  <meta property="og:locale" content="en_KE">
  <meta property="og:title" content="${escapeHtml(options.title)}">
  <meta property="og:description" content="${escapeHtml(options.description)}">
  <meta property="og:url" content="${escapeHtml(options.canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <script type="application/ld+json">${safeJsonLd(graph)}</script>
</head>
<body style="margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;line-height:1.68;">
  <header style="background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 20px;">
    <div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <a href="/" style="font-weight:800;font-size:18px;color:#059669;text-decoration:none;">Store254</a>
      <nav aria-label="Legal navigation" style="display:flex;gap:16px;font-size:13px;font-weight:600;flex-wrap:wrap;">
        <a href="/terms" style="color:#334155;text-decoration:none;">Terms</a>
        <a href="/privacy" style="color:#334155;text-decoration:none;">Privacy</a>
        <a href="/?report=copyright" style="color:#b91c1c;text-decoration:none;">Report Copyright</a>
        <a href="/stores" style="color:#059669;text-decoration:none;">Browse Stores &rarr;</a>
      </nav>
    </div>
  </header>

  <main style="max-width:960px;margin:0 auto;padding:32px 20px 56px;">
    <section style="background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:30px;margin-bottom:20px;">
      <span style="display:inline-block;padding:4px 12px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;">${escapeHtml(options.badge)}</span>
      <h1 style="margin:12px 0 8px;font-size:30px;line-height:1.2;font-weight:800;color:#0f172a;">${escapeHtml(options.heading)}</h1>
      <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;">Effective Date: ${escapeHtml(options.updatedDate)} &bull; Operated by Kayzen Labs Software Company Limited (Nairobi, Kenya)</p>
      <p style="margin:0;color:#475569;font-size:15px;">${options.intro}</p>
    </section>

    <div style="display:flex;flex-direction:column;gap:16px;">
      ${options.sectionsHtml}
    </div>
  </main>

  <footer style="border-top:1px solid #e2e8f0;background:#fff;padding:18px 20px;text-align:center;font-size:13px;color:#64748b;">
    &copy; 2026 Store254.co.ke &bull; Kayzen Labs Software Company Limited &bull;
    <a href="/terms" style="color:#059669;text-decoration:none;">Terms</a> &bull;
    <a href="/privacy" style="color:#059669;text-decoration:none;">Privacy</a> &bull;
    <a href="/?report=copyright" style="color:#b91c1c;text-decoration:none;">Report Copyrighted Image</a> &bull;
    <a href="/about" style="color:#059669;text-decoration:none;">About</a>
  </footer>
</body>
</html>`;
}

export function buildPlatformTermsHtml(isPreview = false): {
  status: number;
  html: string;
  robots: string;
} {
  const origin = `https://${PRIMARY_DOMAIN}`;
  const canonicalUrl = `${origin}/terms`;
  const robots = isPreview
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1";
  const title = "Terms & Conditions & Copyright Policy | Store254";
  const description =
    "Read Store254 Terms & Conditions, Copyright & Image Takedown Policy (Kenya Copyright Act Cap. 130), M-Pesa Payment Terms, Merchant Responsibilities, and Limitation of Liability.";

  const cardStyle = "background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;";
  const h2Style = "margin:0 0 10px;font-size:18px;font-weight:800;color:#0f172a;";
  const pStyle = "margin:0 0 10px;color:#334155;font-size:14px;";
  const ulStyle = "margin:0;padding-left:20px;color:#334155;font-size:14px;display:flex;flex-direction:column;gap:6px;";

  const sectionsHtml = `
    <article id="copyright" style="${cardStyle}border-left:4px solid #dc2626;">
      <h2 style="${h2Style}">1. Copyright, Trademarks &amp; Media Takedown Policy (Mandatory)</h2>
      <p style="${pStyle}">
        Store254 strictly respects intellectual property rights under the <strong>Kenya Copyright Act (Cap. 130)</strong>, the <strong>Trademarks Act (Cap. 506)</strong>, the <strong>Anti-Counterfeit Act</strong>, and applicable international copyright frameworks (including DMCA notice-and-takedown standards).
      </p>
      <ul style="${ulStyle}">
        <li><strong>No Copyrighted Images or Unauthorized Media:</strong> Merchants and users <strong>must not upload, display, copy, or distribute any copyrighted photographs, watermarked stock images, brand logos, product graphics, or third-party media</strong> unless they own the copyright or hold a valid commercial license or written permission from the rights holder.</li>
        <li><strong>Merchant Warranty:</strong> By uploading any image, logo, banner, or listing media to Store254, the merchant warrants that the content is original or properly licensed and does not infringe any copyright, trademark, publicity, or privacy right.</li>
        <li><strong>Store254's Right to Take Down Content Immediately:</strong> Store254 reserves the absolute, unilateral right to <strong>remove, strip, or permanently delete any reported or suspected copyrighted image or listing from storefronts and cloud storage immediately without prior notice</strong>, and to suspend or permanently terminate repeat offenders.</li>
        <li><strong>How to Report Copyrighted Images:</strong> Rights holders or any user can report an infringing image directly via our <a href="/?report=copyright" style="color:#b91c1c;font-weight:700;text-decoration:none;">Report Copyrighted Image form</a> (also available on every product page) or by emailing <a href="mailto:kelvin@store254.co.ke" style="color:#059669;font-weight:700;text-decoration:none;">kelvin@store254.co.ke</a> with the image URL, store link, proof of ownership, and a good-faith declaration.</li>
      </ul>
    </article>

    <article style="${cardStyle}">
      <h2 style="${h2Style}">2. Platform Role &amp; Independent Merchants</h2>
      <p style="${pStyle}">
        Store254 (<a href="https://store254.co.ke/" style="color:#059669;text-decoration:none;">store254.co.ke</a>), operated by <strong>Kayzen Labs Software Company Limited</strong>, provides e-commerce software, hosting, and storefront infrastructure (<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">*.store254.co.ke</code>).
      </p>
      <ul style="${ulStyle}">
        <li><strong>Not the Seller of Record:</strong> Store254 is not the manufacturer, seller, owner, custodian, or delivery agent of any products or services listed by independent merchants.</li>
        <li><strong>Merchant Legal &amp; Regulatory Compliance:</strong> Each merchant is solely responsible for product authenticity, safety, accurate descriptions, pricing, stock availability, warranties, delivery, refunds, returns, local county permits, professional/sector licenses (e.g. Pharmacy &amp; Poisons Board for health/pharmacy goods), and Kenya Revenue Authority (KRA) tax obligations (VAT, Turnover Tax, eTIMS/receipts).</li>
        <li><strong>Consumer Protection:</strong> Merchants must comply with the <strong>Kenya Consumer Protection Act (Cap. 501)</strong> and <strong>Sale of Goods Act (Cap. 31)</strong>, including honest pricing and transparent refund/delivery policies.</li>
      </ul>
    </article>

    <article id="payments" style="${cardStyle}">
      <h2 style="${h2Style}">3. Payments, M-Pesa, Cash on Delivery &amp; Money Disputes</h2>
      <p style="${pStyle}">
        Customer purchases on Store254 settle directly with the merchant via the merchant's own configured Safaricom M-Pesa Till/Paybill (Daraja STK Push or manual Paybill/Till instructions) or Cash on Delivery.
      </p>
      <ul style="${ulStyle}">
        <li><strong>No Escrow or Banking Role:</strong> Store254 is a technology provider, not a bank, payment service provider, or escrow holder. Order funds do not pass through Store254 accounts when customers pay a merchant's Till or Paybill directly.</li>
        <li><strong>Protection Against User &amp; Merchant Mistakes:</strong> Store254 and Kayzen Labs Software Company Limited are <strong>not responsible or liable for any financial loss, misdirected funds, or failed orders</strong> resulting from: (a) a merchant configuring an incorrect M-Pesa Till, Paybill, Account Number, or Daraja API credential; (b) a customer entering a wrong phone number, wrong Till/Paybill reference, wrong M-Pesa PIN, or making duplicate payments; (c) pricing typos, incorrect stock quantities, or accidental deletion of items/data by a merchant or their staff; or (d) incorrect delivery addresses provided by buyers.</li>
        <li><strong>Third-Party Network Outages:</strong> Store254 is not liable for delays, timeouts, or missed callbacks caused by Safaricom M-Pesa Daraja, mobile network operators, Google OAuth, or external courier providers.</li>
        <li><strong>Refunds &amp; Order Disputes:</strong> All order cancellations, exchanges, and refunds are strictly between the customer and the selling merchant.</li>
        <li><strong>Merchant Platform Subscriptions:</strong> Where a monthly platform fee applies to a merchant's storefront, failure to renew by the due date may suspend public storefront access. Subscription fees are for software access and are non-refundable once the active billing period begins, except where required by Kenyan law.</li>
      </ul>
    </article>

    <article style="${cardStyle}">
      <h2 style="${h2Style}">4. Prohibited Content, Acceptable Use &amp; Cybercrime Compliance</h2>
      <p style="${pStyle}">
        Users and merchants must comply with the <strong>Computer Misuse and Cybercrimes Act, 2018</strong> and all laws of the Republic of Kenya. You may not list or transmit:
      </p>
      <ul style="${ulStyle}">
        <li>Counterfeit, pirated, stolen, or illegal goods, narcotics, weapons, hazardous materials, or regulated prescription drugs without valid statutory licensing.</li>
        <li>Fraudulent listings, phishing storefronts, impersonation of financial/mobile-money brands (including M-Pesa or Safaricom), malware, or automated scraping/abuse.</li>
        <li>Defamatory, abusive, obscene, or deceptive content. Store254 may suspend or delete violating accounts immediately and cooperate with lawful authorities.</li>
      </ul>
    </article>

    <article style="${cardStyle}">
      <h2 style="${h2Style}">5. Account Security, Staff Access &amp; Backups</h2>
      <p style="${pStyle}">
        Merchants are fully responsible for safeguarding their Google Sign-In sessions, store admin passwords, staff accounts, and M-Pesa credentials. Actions performed by any invited staff account or using valid credentials are the responsibility of the store owner. Store254 does not guarantee permanent retention of deleted items or suspended storefronts.
      </p>
    </article>

    <article style="${cardStyle}">
      <h2 style="${h2Style}">6. Disclaimer, Limitation of Liability &amp; Indemnification</h2>
      <p style="${pStyle}">
        <strong>As-Is Service:</strong> Store254 is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis without warranties of uninterrupted availability or merchant performance.
      </p>
      <p style="${pStyle}">
        <strong>Limitation of Liability:</strong> To the maximum extent permitted by Kenyan law, Kayzen Labs Software Company Limited and Store254 shall not be liable for any indirect, incidental, consequential, or punitive damages, lost profits, lost data, misdirected payments, or merchant-buyer disputes. Our total aggregate liability for any claim shall not exceed the total platform subscription fees actually paid by you to Store254 in the three (3) months preceding the claim (or KES 5,000 if no fees were paid).
      </p>
      <p style="margin:0;color:#334155;font-size:14px;">
        <strong>Indemnification:</strong> You agree to indemnify and hold harmless Kayzen Labs Software Company Limited, Store254, and its officers and engineers from any claims, damages, fines, legal fees, copyright infringement actions, tax assessments, or consumer disputes arising from your uploaded images, listings, M-Pesa configuration, or breach of these Terms.
      </p>
    </article>

    <article style="${cardStyle}">
      <h2 style="${h2Style}">7. Data Protection, Governing Law &amp; Contact</h2>
      <p style="${pStyle}">
        Personal data is processed in accordance with our <a href="/privacy" style="color:#059669;font-weight:700;text-decoration:none;">Privacy &amp; Data Protection Policy</a> and the <strong>Kenya Data Protection Act, 2019</strong>.
      </p>
      <p style="margin:0;color:#334155;font-size:14px;">
        These Terms are governed by the laws of the <strong>Republic of Kenya</strong>, with exclusive jurisdiction in the courts of Nairobi, Kenya. Legal &amp; takedown inquiries: <a href="mailto:kelvin@store254.co.ke" style="color:#059669;font-weight:700;text-decoration:none;">kelvin@store254.co.ke</a>.
      </p>
    </article>
  `;

  const html = renderLegalDocumentShell({
    title,
    description,
    canonicalUrl,
    robots,
    badge: "Legal & Compliance",
    heading: "Terms & Conditions",
    intro:
      "By accessing Store254, creating a storefront, uploading images, or placing an order, you agree to these Terms & Conditions, including our strict prohibition on copyrighted images and our payment/liability protections.",
    updatedDate: "November 16, 2026",
    sectionsHtml,
  });

  return { status: 200, html, robots };
}

export function buildPlatformPrivacyHtml(isPreview = false): {
  status: number;
  html: string;
  robots: string;
} {
  const origin = `https://${PRIMARY_DOMAIN}`;
  const canonicalUrl = `${origin}/privacy`;
  const robots = isPreview
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1";
  const title = "Privacy & Data Protection Policy | Store254";
  const description =
    "Store254 Privacy Policy compliant with the Kenya Data Protection Act, 2019 (ODPC). Learn how Store254 collects, protects, and processes merchant, buyer, and copyright report data.";

  const cardStyle = "background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;";
  const h2Style = "margin:0 0 10px;font-size:18px;font-weight:800;color:#0f172a;";
  const pStyle = "margin:0 0 10px;color:#334155;font-size:14px;";
  const ulStyle = "margin:0;padding-left:20px;color:#334155;font-size:14px;display:flex;flex-direction:column;gap:6px;";

  const sectionsHtml = `
    <article style="${cardStyle}">
      <h2 style="${h2Style}">1. Data Controller &amp; Scope (Kenya Data Protection Act, 2019)</h2>
      <p style="margin:0;color:#334155;font-size:14px;">
        <strong>Store254</strong> (<a href="https://store254.co.ke/" style="color:#059669;text-decoration:none;">store254.co.ke</a>) is operated by <strong>Kayzen Labs Software Company Limited</strong> (Nairobi, Kenya) in compliance with the <strong>Kenya Data Protection Act, 2019</strong> and regulations of the Office of the Data Protection Commissioner (ODPC). Each independent merchant acts as a separate data controller for customer orders fulfilled by their individual store.
      </p>
    </article>

    <article style="${cardStyle}">
      <h2 style="${h2Style}">2. Information We Collect</h2>
      <ul style="${ulStyle}">
        <li><strong>Account &amp; Authentication Data:</strong> Name, email address, and Google account identifier when signing in with Google OAuth, plus hashed store admin/staff passwords (PBKDF2-HMAC-SHA512).</li>
        <li><strong>Merchant Storefront Data:</strong> Business name, subdomain, county/town location, contact phone/email, uploaded logos/banners/product photos, and encrypted M-Pesa Daraja/Paybill/Till settings.</li>
        <li><strong>Order &amp; Checkout Data:</strong> Customer name, phone number, delivery address, order items, and M-Pesa transaction references (we never store your M-Pesa PIN).</li>
        <li><strong>Copyright &amp; Abuse Reports:</strong> Reporter name, email, claimed original work URL, reported image URL, and audit logs.</li>
        <li><strong>Technical &amp; Local Storage Data:</strong> Essential session cookies (HttpOnly), cart/wishlist preferences in browser storage, and IP/geo headers used strictly for rate limiting, fraud prevention, and location search.</li>
      </ul>
    </article>

    <article style="${cardStyle}">
      <h2 style="${h2Style}">3. How &amp; Why We Process Data</h2>
      <ul style="${ulStyle}">
        <li>To operate storefronts, authenticate users, display local Kenyan stores/products, and route customer orders and M-Pesa payment requests.</li>
        <li>To enforce our <a href="/terms" style="color:#059669;font-weight:700;text-decoration:none;">Terms &amp; Conditions</a>, investigate copyright takedown requests, prevent fraud/spam, and comply with Kenyan legal obligations.</li>
        <li><strong>Infrastructure &amp; Sub-processors:</strong> Data is processed using trusted infrastructure providers including Cloudflare (edge hosting, D1 database, R2 media storage), Google (OAuth sign-in &amp; optional Maps location lookup), Safaricom Daraja (M-Pesa STK Push), and Resend (transactional OTP and notification emails).</li>
      </ul>
    </article>

    <article style="${cardStyle}">
      <h2 style="${h2Style}">4. Security, Retention &amp; Your Data Rights</h2>
      <p style="${pStyle}">
        We protect data in transit via HTTPS/TLS, encrypt sensitive M-Pesa merchant secrets at rest, and isolate tenant records per store. Data is retained only as long as necessary to provide the service, resolve disputes/takedowns, or satisfy statutory tax/audit requirements.
      </p>
      <p style="margin:0;color:#334155;font-size:14px;">
        Under the <strong>Kenya Data Protection Act, 2019</strong>, you have the right to request access, correction, or deletion of your personal data, or object to processing. Contact our Data Protection Contact at <a href="mailto:kelvin@store254.co.ke" style="color:#059669;font-weight:700;text-decoration:none;">kelvin@store254.co.ke</a>.
      </p>
    </article>
  `;

  const html = renderLegalDocumentShell({
    title,
    description,
    canonicalUrl,
    robots,
    badge: "Data Protection (Kenya DPA 2019)",
    heading: "Privacy & Data Protection Policy",
    intro:
      "How Store254 and Kayzen Labs Software Company Limited collect, use, secure, and protect personal data across store254.co.ke and independent merchant storefronts.",
    updatedDate: "November 16, 2026",
    sectionsHtml,
  });

  return { status: 200, html, robots };
}

function buildSsrCategoryLinksHtml(categories: SeoCategory[], activeSlug = ""): string {
  const roots = categories.filter((c) => !c.parentId);
  const allBtn = `<a href="/" onclick="event.preventDefault(); selectCategory('')" class="category-pill ${
    activeSlug === "" ? "category-pill-active" : "category-pill-inactive"
  }"><span>All Items</span></a>`;
  const links = roots.map((cat) => {
    const active = cat.slug === activeSlug;
    return `<a href="/category/${encodeURIComponent(cat.slug)}" onclick="event.preventDefault(); selectCategory('${escapeHtml(cat.slug)}')" class="category-pill ${
      active ? "category-pill-active" : "category-pill-inactive"
    }"><span>${escapeHtml(cat.name)}</span></a>`;
  });
  return [allBtn, ...links].join("");
}

function buildSsrFallbackArtworkUri(item: SeoItem, categoryName: string | undefined, tenant?: TenantSeo): string {
  try {
    // Load shared artwork classifier when bundled or available globally
    const classifier =
      (globalThis as unknown as { Store254ItemArtwork?: { buildDataUri: (i: unknown, c: unknown) => string } }).Store254ItemArtwork;
    if (classifier?.buildDataUri) {
      return classifier.buildDataUri(item, {
        categoryName,
        businessType: tenant?.businessType,
        storeName: tenant?.name,
      });
    }
  } catch {
    // Fallback cleanly below
  }
  const isService = item.itemType === "SERVICE";
  const accent = isService ? "#4f46e5" : "#059669";
  const bg = isService ? "#eef2ff" : "#ecfdf5";
  const strokeDark = isService ? "#312e81" : "#064e3b";
  const shape = isService
    ? `<rect x="24" y="28" width="72" height="64" rx="12" fill="#ffffff" stroke="${accent}" stroke-width="3"/><path d="M24 44h72" stroke="${accent}" stroke-width="3"/><path d="M44 66l10 10 22-22" fill="none" stroke="${accent}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M60 20l34 18v44L60 100 26 82V38l34-18z" fill="${accent}" stroke="${strokeDark}" stroke-width="2.5"/><path d="M60 20l34 18-34 18-34-18 34-18z" fill="#34d399"/>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${bg}"/>${shape}</svg>`)}`;
}

function buildSsrItemCardsHtml(origin: string, items: SeoItem[], currency: string, categories: SeoCategory[]): string {
  const catNameById = new Map<string, string>(categories.map((c) => [c.id, c.name]));
  return items.slice(0, 60).map((item) => {
    const isService = item.itemType === "SERVICE";
    const href = `/item/${encodeURIComponent(item.slug)}`;
    const categoryLabel =
      (item.attributes && typeof item.attributes.brand === "string" && item.attributes.brand) ||
      (item.categoryId && catNameById.get(item.categoryId)) ||
      (isService ? "Service" : "Featured");
    const primaryImg =
      (Array.isArray(item.images) && toAbsoluteUrl(item.images[0], origin)) ||
      buildSsrFallbackArtworkUri(item, categoryLabel);
    const desc = item.description ? `<p class="product-card-desc">${escapeHtml(truncateSeoText(item.description, 120))}</p>` : "";
    return `
      <article class="product-card${isService ? " product-card--service" : ""} flex flex-col group relative">
        <a href="${escapeHtml(href)}" class="product-card-media relative overflow-hidden flex items-center justify-center cursor-pointer no-underline">
          <img src="${escapeHtml(primaryImg)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async" width="400" height="400" class="w-full h-full object-cover">
        </a>
        <div class="product-card-content flex-1 flex flex-col justify-between">
          <div>
            <div class="product-card-meta-row flex items-center justify-between gap-1.5 mb-1">
              <span class="product-tag-pill truncate">${escapeHtml(categoryLabel)}</span>
            </div>
            <h3 class="product-card-title"><a href="${escapeHtml(href)}" class="no-underline text-inherit hover:underline">${escapeHtml(item.title)}</a></h3>
            ${desc}
          </div>
          <div class="product-card-footer pt-2.5 mt-auto">
            <div class="product-price-block flex items-baseline flex-wrap gap-1.5 mb-2.5">
              <span class="product-card-price">${escapeHtml(currency)} ${Number(item.basePrice).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function buildSsrItemDetailHtml(
  origin: string,
  tenant: TenantSeo,
  item: SeoItem,
  category: SeoCategory | null
): string {
  const currency = tenant.currency || "KES";
  const isService = item.itemType === "SERVICE";
  const primaryImg =
    (Array.isArray(item.images) && toAbsoluteUrl(item.images[0], origin)) ||
    buildSsrFallbackArtworkUri(item, category?.name, tenant);
  const attrs = item.attributes && typeof item.attributes === "object" ? Object.entries(item.attributes).filter(([, v]) => v !== null && v !== undefined && String(v).trim()) : [];
  const hasCompare = item.compareAtPrice && Number(item.compareAtPrice) > Number(item.basePrice);

  return `
    <section id="ssr-item-detail" class="ssr-item-detail mb-6 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
      <nav aria-label="Breadcrumb" class="text-xs text-slate-500 mb-3 flex flex-wrap items-center gap-1.5">
        <a href="/" class="text-emerald-700 font-semibold hover:underline">${escapeHtml(tenant.name)}</a>
        <span>/</span>
        ${category ? `<a href="/category/${encodeURIComponent(category.slug)}" class="text-emerald-700 font-semibold hover:underline">${escapeHtml(category.name)}</a><span>/</span>` : ""}
        <span class="text-slate-700 font-semibold">${escapeHtml(item.title)}</span>
      </nav>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div class="rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
          <img src="${escapeHtml(primaryImg)}" alt="${escapeHtml(item.title)}" class="w-full h-auto object-cover" width="600" height="600">
        </div>
        <div>
          <span class="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 mb-2">${isService ? "Service" : "Product"} · ${escapeHtml(tenant.name)}</span>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">${escapeHtml(item.title)}</h1>
          <div class="flex items-baseline gap-2.5 mb-3">
            <strong class="text-xl font-black text-emerald-700">${escapeHtml(currency)} ${Number(item.basePrice).toLocaleString()}</strong>
            ${hasCompare ? `<span class="text-sm text-slate-400 line-through">${escapeHtml(currency)} ${Number(item.compareAtPrice).toLocaleString()}</span>` : ""}
          </div>
          <p class="text-sm text-slate-600 leading-relaxed mb-4">${escapeHtml(item.description || `${item.title} available directly from ${tenant.name} with instant M-Pesa checkout.`)}</p>
          ${attrs.length > 0 ? `<dl class="grid grid-cols-2 gap-2 mb-4">${attrs.slice(0, 6).map(([k, v]) => `<div class="bg-slate-50 p-2 rounded-lg border border-slate-100"><dt class="text-[10px] text-slate-500 font-semibold uppercase">${escapeHtml(k.replace(/_/g, " "))}</dt><dd class="text-xs font-bold text-slate-800">${escapeHtml(v)}</dd></div>`).join("")}</dl>` : ""}
          <a href="/" class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:underline">&larr; Browse all ${escapeHtml(tenant.name)} products &amp; services</a>
        </div>
      </div>
    </section>
  `;
}

export function buildStorefrontSeoData(options: {
  origin: string;
  route: StorefrontRoute;
  payload: SeoStorefrontPayload;
  itemDetail?: SeoItemDetailPayload | null;
  isPreview: boolean;
}): {
  status: number;
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  headTagsHtml: string;
  ssrStoreAddress: string;
  ssrStoreName: string;
  ssrStoreTagline: string;
  ssrStoreDesc: string;
  ssrCategoryHtml: string;
  ssrItemsHtml: string;
  ssrItemDetailHtml: string;
  downgradeBannerHeading: boolean;
} {
  const { origin, route, payload, itemDetail, isPreview } = options;
  const { tenant, categories = [], items = [] } = payload;
  const settings = parseSettings(tenant.settings);
  const currency = tenant.currency || "KES";
  const subdomainLabel = `${tenant.subdomain}.${PRIMARY_DOMAIN}`;
  const rawTagline = typeof settings.tagline === "string" ? settings.tagline.trim() : "";
  const rawDescription = typeof settings.description === "string" ? settings.description.trim() : "";
  const isDuplicateTaglineDesc =
    Boolean(rawTagline) && rawDescription.toLowerCase() === rawTagline.toLowerCase();
  const defaultStoreDesc =
    (rawDescription && !isDuplicateTaglineDesc ? rawDescription : "") ||
    `Shop verified products and services directly from ${tenant.name} (${subdomainLabel}) with instant M-Pesa checkout.`;
  const storeImage =
    toAbsoluteUrl(settings.bannerUrl || settings.logoUrl, origin) || `${origin}/assets/store254Logo.webp`;
  const robotsBase = isPreview
    ? "noindex, nofollow"
    : items.length === 0
      ? "noindex, follow"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  const categoryById = new Map<string, SeoCategory>(categories.map((c) => [c.id, c]));
  const storeNode = buildStoreSchemaNode(origin, tenant);

  if (route.kind === "item") {
    const matchedItem = itemDetail?.item || items.find((it) => it.slug === route.slug);
    if (!matchedItem) {
      const missingTitle = `Item not found | ${tenant.name}`;
      return {
        status: 404,
        title: missingTitle,
        description: truncateSeoText(defaultStoreDesc),
        canonicalUrl: `${origin}/`,
        robots: "noindex, nofollow",
        headTagsHtml: `<link rel="canonical" href="${escapeHtml(origin)}/"><meta name="robots" content="noindex, nofollow">`,
        ssrStoreAddress: subdomainLabel,
        ssrStoreName: tenant.name,
        ssrStoreTagline: settings.tagline || "",
        ssrStoreDesc: defaultStoreDesc,
        ssrCategoryHtml: buildSsrCategoryLinksHtml(categories, ""),
        ssrItemsHtml: buildSsrItemCardsHtml(origin, items, currency, categories),
        ssrItemDetailHtml: "",
        downgradeBannerHeading: false,
      };
    }

    const cat = itemDetail?.category || (matchedItem.categoryId ? categoryById.get(matchedItem.categoryId) || null : null);
    const isService = matchedItem.itemType === "SERVICE";
    const priceLabel = `${currency} ${Number(matchedItem.basePrice).toLocaleString()}`;
    const title = `${matchedItem.title} (${priceLabel}) | ${tenant.name}`;
    const description = truncateSeoText(
      matchedItem.description
        ? `${matchedItem.description} ${isService ? "Book" : "Order"} from ${tenant.name} for ${priceLabel} with M-Pesa checkout.`
        : `${isService ? "Book" : "Buy"} ${matchedItem.title} from ${tenant.name} (${subdomainLabel}) for ${priceLabel}. Fast service and instant M-Pesa payment.`
    );
    const canonicalUrl = `${origin}/item/${encodeURIComponent(matchedItem.slug)}`;
    const primaryItemImg =
      (Array.isArray(matchedItem.images) && toAbsoluteUrl(matchedItem.images[0], origin)) || storeImage;
    const itemSchema = buildItemSchemaNode(origin, tenant, matchedItem, cat?.name || null, itemDetail?.reviews || []);

    const breadcrumbs = [
      { "@type": "ListItem", position: 1, name: tenant.name, item: `${origin}/` },
      ...(cat
        ? [{ "@type": "ListItem", position: 2, name: cat.name, item: `${origin}/category/${encodeURIComponent(cat.slug)}` }]
        : []),
      { "@type": "ListItem", position: cat ? 3 : 2, name: matchedItem.title, item: canonicalUrl },
    ];

    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        storeNode,
        itemSchema,
        {
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbs,
        },
      ],
    };

    const availabilityText = getItemAvailabilityUrl(matchedItem).endsWith("InStock") ? "in stock" : "out of stock";
    const headTagsHtml = [
      `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
      `<meta name="robots" content="${escapeHtml(robotsBase)}">`,
      `<meta property="og:type" content="${isService ? "website" : "product"}">`,
      `<meta property="og:site_name" content="${escapeHtml(tenant.name)}">`,
      `<meta property="og:locale" content="en_KE">`,
      `<meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta property="og:description" content="${escapeHtml(description)}">`,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      `<meta property="og:image" content="${escapeHtml(primaryItemImg)}">`,
      `<meta property="og:image:alt" content="${escapeHtml(matchedItem.title)}">`,
      `<meta property="product:price:amount" content="${escapeHtml(String(matchedItem.basePrice))}">`,
      `<meta property="product:price:currency" content="${escapeHtml(currency)}">`,
      `<meta property="product:availability" content="${availabilityText}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escapeHtml(title)}">`,
      `<meta name="twitter:description" content="${escapeHtml(description)}">`,
      `<meta name="twitter:image" content="${escapeHtml(primaryItemImg)}">`,
      `<script type="application/ld+json">${safeJsonLd(graph)}</script>`,
    ].join("");

    return {
      status: 200,
      title,
      description,
      canonicalUrl,
      robots: robotsBase,
      headTagsHtml,
      ssrStoreAddress: subdomainLabel,
      ssrStoreName: tenant.name,
      ssrStoreTagline: settings.tagline || "",
      ssrStoreDesc: defaultStoreDesc,
      ssrCategoryHtml: buildSsrCategoryLinksHtml(categories, cat?.slug || ""),
      ssrItemsHtml: buildSsrItemCardsHtml(origin, items, currency, categories),
      ssrItemDetailHtml: buildSsrItemDetailHtml(origin, tenant, matchedItem, cat),
      downgradeBannerHeading: true,
    };
  }

  if (route.kind === "category") {
    const cat = categories.find((c) => c.slug === route.slug);
    if (!cat) {
      return {
        status: 404,
        title: `Category not found | ${tenant.name}`,
        description: truncateSeoText(defaultStoreDesc),
        canonicalUrl: `${origin}/`,
        robots: "noindex, nofollow",
        headTagsHtml: `<link rel="canonical" href="${escapeHtml(origin)}/"><meta name="robots" content="noindex, nofollow">`,
        ssrStoreAddress: subdomainLabel,
        ssrStoreName: tenant.name,
        ssrStoreTagline: settings.tagline || "",
        ssrStoreDesc: defaultStoreDesc,
        ssrCategoryHtml: buildSsrCategoryLinksHtml(categories, ""),
        ssrItemsHtml: buildSsrItemCardsHtml(origin, items, currency, categories),
        ssrItemDetailHtml: "",
        downgradeBannerHeading: false,
      };
    }

    const childIds = new Set(categories.filter((c) => c.parentId === cat.id).map((c) => c.id));
    const filteredItems = items.filter((it) => it.categoryId === cat.id || (it.categoryId && childIds.has(it.categoryId)));
    const canonicalUrl = `${origin}/category/${encodeURIComponent(cat.slug)}`;
    const title = `${cat.name} — ${tenant.name} | Store254`;
    const description = truncateSeoText(
      cat.description ||
        `Browse ${cat.name} (${filteredItems.length} available) from ${tenant.name} (${subdomainLabel}). Order online with fast M-Pesa checkout.`
    );

    const graph = {
      "@context": "https://schema.org",
      "@graph": [
        storeNode,
        {
          "@type": "CollectionPage",
          "@id": `${canonicalUrl}#collection`,
          name: `${cat.name} | ${tenant.name}`,
          url: canonicalUrl,
          description,
          isPartOf: { "@id": `${origin}/#website` },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: tenant.name, item: `${origin}/` },
            { "@type": "ListItem", position: 2, name: cat.name, item: canonicalUrl },
          ],
        },
        ...(filteredItems.length > 0
          ? [
              {
                "@type": "ItemList",
                name: `${cat.name} at ${tenant.name}`,
                itemListElement: filteredItems.slice(0, 30).map((it, idx) => ({
                  "@type": "ListItem",
                  position: idx + 1,
                  url: `${origin}/item/${encodeURIComponent(it.slug)}`,
                  item: buildItemSchemaNode(origin, tenant, it, cat.name),
                })),
              },
            ]
          : []),
      ],
    };

    const headTagsHtml = [
      `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
      `<meta name="robots" content="${escapeHtml(robotsBase)}">`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${escapeHtml(tenant.name)}">`,
      `<meta property="og:locale" content="en_KE">`,
      `<meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta property="og:description" content="${escapeHtml(description)}">`,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      `<meta property="og:image" content="${escapeHtml(storeImage)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escapeHtml(title)}">`,
      `<meta name="twitter:description" content="${escapeHtml(description)}">`,
      `<meta name="twitter:image" content="${escapeHtml(storeImage)}">`,
      `<script type="application/ld+json">${safeJsonLd(graph)}</script>`,
    ].join("");

    return {
      status: 200,
      title,
      description,
      canonicalUrl,
      robots: robotsBase,
      headTagsHtml,
      ssrStoreAddress: subdomainLabel,
      ssrStoreName: `${tenant.name} — ${cat.name}`,
      ssrStoreTagline: settings.tagline || "",
      ssrStoreDesc: cat.description || defaultStoreDesc,
      ssrCategoryHtml: buildSsrCategoryLinksHtml(categories, cat.slug),
      ssrItemsHtml: buildSsrItemCardsHtml(origin, filteredItems, currency, categories),
      ssrItemDetailHtml: "",
      downgradeBannerHeading: false,
    };
  }

  // Default: Storefront Home (/)
  const tagline = typeof settings.tagline === "string" && settings.tagline.trim() ? settings.tagline.trim() : "";
  const title = tagline ? `${tenant.name} — ${tagline} | Store254` : `${tenant.name} — Shop Products & Services Online | Store254`;
  const topCats = categories.filter((c) => !c.parentId).slice(0, 4).map((c) => c.name);
  const catSummary = topCats.length > 0 ? ` Browse ${topCats.join(", ")}.` : "";
  const description = truncateSeoText(
    `${tenant.name} (${subdomainLabel}): ${settings.description || tagline || "Shop online directly from this Kenyan store with M-Pesa."}${catSummary}`
  );
  const canonicalUrl = `${origin}/`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      storeNode,
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: tenant.name,
        alternateName: subdomainLabel,
        url: `${origin}/`,
        publisher: { "@id": `${origin}/#store` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${origin}/?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      ...(items.length > 0
        ? [
            {
              "@type": "OfferCatalog",
              "@id": `${origin}/#catalog`,
              name: `${tenant.name} Catalog`,
              itemListElement: items.slice(0, 30).map((it, idx) => {
                const catName = it.categoryId ? categoryById.get(it.categoryId)?.name || null : null;
                return {
                  "@type": "ListItem",
                  position: idx + 1,
                  url: `${origin}/item/${encodeURIComponent(it.slug)}`,
                  item: buildItemSchemaNode(origin, tenant, it, catName),
                };
              }),
            },
          ]
        : []),
    ],
  };

  const headTagsHtml = [
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    `<meta name="robots" content="${escapeHtml(robotsBase)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(tenant.name)}">`,
    `<meta property="og:locale" content="en_KE">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:image" content="${escapeHtml(storeImage)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(tenant.name)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(storeImage)}">`,
    `<script type="application/ld+json">${safeJsonLd(graph)}</script>`,
  ].join("");

  return {
    status: 200,
    title,
    description,
    canonicalUrl,
    robots: robotsBase,
    headTagsHtml,
    ssrStoreAddress: subdomainLabel,
    ssrStoreName: tenant.name,
    ssrStoreTagline: tagline,
    ssrStoreDesc: defaultStoreDesc,
    ssrCategoryHtml: buildSsrCategoryLinksHtml(categories, ""),
    ssrItemsHtml: buildSsrItemCardsHtml(origin, items, currency, categories),
    ssrItemDetailHtml: "",
    downgradeBannerHeading: false,
  };
}
