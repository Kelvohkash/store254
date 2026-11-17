export const PRIMARY_DOMAIN = "store254.co.ke";
export const BING_SITE_AUTH_TOKEN = "AC7BD4DB427A63D2264DB121A7803908";
// IndexNow key (https://www.indexnow.org). Served at /<key>.txt on every host so Bing can verify ownership.
export const INDEXNOW_KEY = "a284a0cb988332f295c2b21ab44ae220";

export function buildIndexNowKeyFile(): string {
  return INDEXNOW_KEY;
}

const SEO_TITLE_MAX = 60;

export function buildItemSeoTitle(itemTitle: string, priceLabel: string, storeName: string, maxLength = SEO_TITLE_MAX): string {
  const suffix = ` (${priceLabel}) | ${storeName}`;
  const full = `${itemTitle}${suffix}`;
  if (Array.from(full).length <= maxLength) return full;
  const room = Math.max(12, maxLength - Array.from(suffix).length - 1);
  const chars = Array.from(String(itemTitle).replace(/\s+/g, " ").trim());
  if (chars.length <= room) return full;
  const cut = chars.slice(0, room).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trim();
  return `${trimmed}…${suffix}`;
}

function categoryItemCount(cat: SeoCategory, categories: SeoCategory[], items: SeoItem[]): number {
  const childIds = new Set(categories.filter((c) => c.parentId === cat.id).map((c) => c.id));
  return items.filter((it) => it.categoryId === cat.id || (it.categoryId && childIds.has(it.categoryId))).length;
}

export function buildBingSiteAuthXml(token = BING_SITE_AUTH_TOKEN): string {
  return `<?xml version="1.0"?>\n<users>\n\t<user>${escapeXml(token)}</user>\n</users>\n`;
}

export function buildOpenSearchXml(options: {
  origin: string;
  shortName: string;
  description: string;
  iconUrl?: string;
}): string {
  const cleanOrigin = options.origin.replace(/\/+$/, "");
  const shortName = String(options.shortName || "Store254").trim().slice(0, 16) || "Store254";
  const description = truncateSeoText(options.description || `Search ${shortName} products and services`, 1024);
  const iconUrl = options.iconUrl || `${cleanOrigin}/assets/pwa-icon-192.png`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/" xmlns:moz="http://www.mozilla.org/2006/browser/search/">',
    `  <ShortName>${escapeXml(shortName)}</ShortName>`,
    `  <Description>${escapeXml(description)}</Description>`,
    "  <InputEncoding>UTF-8</InputEncoding>",
    "  <OutputEncoding>UTF-8</OutputEncoding>",
    `  <Image width="192" height="192" type="image/png">${escapeXml(iconUrl)}</Image>`,
    `  <Url type="text/html" method="get" template="${escapeXml(cleanOrigin)}/?q={searchTerms}"/>`,
    `  <moz:SearchForm>${escapeXml(cleanOrigin)}/</moz:SearchForm>`,
    "</OpenSearchDescription>",
    "",
  ].join("\n");
}

function buildSearchEngineAndIconTags(options: {
  origin: string;
  includeBingMeta?: boolean;
  includeIcons?: boolean;
  includeOpenSearch?: boolean;
  openSearchTitle?: string;
}): string {
  const tags: string[] = [];
  if (options.includeBingMeta) {
    tags.push(`<meta name="msvalidate.01" content="${escapeHtml(BING_SITE_AUTH_TOKEN)}">`);
  }
  if (options.includeOpenSearch) {
    tags.push(
      `<link rel="search" type="application/opensearchdescription+xml" title="${escapeHtml(options.openSearchTitle || "Store254")}" href="${escapeHtml(options.origin)}/opensearch.xml">`
    );
  }
  if (options.includeIcons) {
    tags.push(
      `<link rel="icon" type="image/x-icon" href="${escapeHtml(options.origin)}/favicon.ico">`,
      `<link rel="icon" type="image/png" sizes="192x192" href="${escapeHtml(options.origin)}/assets/pwa-icon-192.png">`,
      `<link rel="icon" type="image/webp" href="${escapeHtml(options.origin)}/assets/store254Icon.webp">`,
      `<link rel="apple-touch-icon" sizes="180x180" href="${escapeHtml(options.origin)}/assets/apple-touch-icon.png">`
    );
  }
  return tags.join("\n  ");
}

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

export function extractTenantSubdomain(
  rawHostname: string,
  primaryDomain = PRIMARY_DOMAIN
): string | null {
  const hostname = rawHostname.toLowerCase().trim();
  const normalizedDomain = primaryDomain.toLowerCase().trim();
  const suffix = `.${normalizedDomain}`;
  if (hostname.endsWith(suffix)) {
    const sub = hostname.slice(0, -suffix.length);
    const sanitized = sanitizeSlug(sub);
    return sanitized || null;
  }
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    const sanitized = sanitizeSlug(sub);
    return sanitized || null;
  }
  return null;
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

export function sanitizeCssUrl(rawUrl: unknown, origin?: string): string {
  if (typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("//")) return "";
  const resolved = origin ? toAbsoluteUrl(trimmed, origin) : trimmed;
  if (!resolved) return "";
  if (!/^https?:\/\//i.test(resolved) && !/^\/api\/media\/[^\s'"\\()\r\n]+$/i.test(resolved)) {
    return "";
  }
  try {
    if (/^https?:\/\//i.test(resolved)) {
      const parsed = new URL(resolved);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    }
  } catch {
    return "";
  }
  return resolved.replace(/['"\\()\r\n\s]/g, (ch) =>
    `%${ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
  );
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
    // Empty categories are thin pages (noindexed in SSR), so keep them out of the sitemap.
    if (categoryItemCount(cat, categories, items) === 0) continue;
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
  const bannerUrl = sanitizeCssUrl(settings.bannerUrl, origin);
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
    : "Store254 | Kenyan Online Stores, Every hustle has a home here";
  const description = isStoresView
    ? "Browse verified independent Kenyan online stores across counties and towns on Store254."
    : "Search local products and services, discover independent Kenyan online stores, and launch your own .store254.co.ke storefront with M-Pesa.";
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
    ...(!isPreview ? [`<meta name="msvalidate.01" content="${escapeHtml(BING_SITE_AUTH_TOKEN)}">`] : []),
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
    `    <a href="/about" class="px-3 py-1 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 no-underline">Why Store254</a>`,
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
  ${buildSearchEngineAndIconTags({
    origin,
    includeBingMeta: !options.isPreview,
    includeIcons: true,
    includeOpenSearch: true,
    openSearchTitle: "Store254",
  })}
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
        <a href="/about" style="color:#334155;text-decoration:none;">Why Store254</a>
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
  const title = "Why Store254 — Launch Your Kenyan Online Store with M-Pesa";
  const description =
    "Launch a Kenyan M-Pesa online store in minutes. Meet founder Kelvin Kamau (Kayzen Labs) and follow our step-by-step store setup guide.";
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
        inLanguage: "en-KE",
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
      {
        "@type": "HowTo",
        name: "How to Launch and Set Up Your Online Store on Store254",
        description:
          "Step-by-step onboarding guide to register your Kenyan business on Store254, create categories and subcategories, add products or bookable services, customize branding, and connect M-Pesa.",
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Sign in with Google and submit your store application",
            text: "Click Open your store on store254.co.ke, sign in with your Google account, pick your .store254.co.ke subdomain, select your business type, and pin your Kenyan county and town or shopping centre.",
            image: `${origin}/assets/guide/onboard-store.webp`,
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Create categories, subcategories, and product filters",
            text: "Open Store Admin, go to Categories, click New Category, choose an optional Parent Category for subcategories, let the auto icon classifier pick an icon, and add custom product filters.",
            image: `${origin}/assets/guide/create-category.webp`,
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Add physical products, bookable services, or digital goods",
            text: "Click Add Product, set your KES price, pick Physical Product, Bookable Service, or Digital Product, upload up to 5 photos or use automatic studio icon artwork, and save.",
            image: `${origin}/assets/guide/add-product.webp`,
          },
          {
            "@type": "HowToStep",
            position: 4,
            name: "Customize your branding and enable M-Pesa STK Push",
            text: "In Store Settings pick your brand colour, logo, banner, WhatsApp link, or custom domain, then enter your M-Pesa Till or Paybill details under M-Pesa / Payments.",
            image: `${origin}/assets/guide/mpesa-settings.webp`,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Why choose Store254 over selling only on WhatsApp or Instagram?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Social feeds bury old posts and make pricing hard to browse. Store254 gives you a permanent, Google-indexed storefront link, organized categories and filters, automated M-Pesa STK Push checkout, and local county-level discovery across Kenya.",
            },
          },
          {
            "@type": "Question",
            name: "Do I need photos for every item before launching?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. You can upload up to 5 original photos per item (automatically compressed to fast 720px WebP), and any item without a photo automatically receives a sleek studio icon illustration matched from 779+ icons.",
            },
          },
          {
            "@type": "Question",
            name: "Can service businesses like salons, clinics, or repair shops use Store254?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. When adding an item, select Bookable Service to configure booking availability, typical duration, and whether the service happens at your studio, on-site at the client location, or online.",
            },
          },
          {
            "@type": "Question",
            name: "How do M-Pesa payments work on Store254?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "In Store Admin under M-Pesa / Payments, enable M-Pesa prompts, choose Paybill or Till (Buy Goods), and add your shortcode and Safaricom Daraja credentials so customers pay directly to your business via STK Push.",
            },
          },
        ],
      },
    ],
  };

  const guideImgUrl = (name: string) => `${escapeHtml(origin)}/assets/guide/${name}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  ${buildSearchEngineAndIconTags({
    origin,
    includeBingMeta: !isPreview,
    includeIcons: true,
    includeOpenSearch: true,
    openSearchTitle: "Store254",
  })}
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
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.65; }
    a { color: #059669; }
    .container { max-width: 1060px; margin: 0 auto; padding: 0 20px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 28px; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03); }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 12px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; }
    .jump-nav { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
    .jump-nav a { display: inline-flex; align-items: center; padding: 7px 14px; border-radius: 999px; background: #f1f5f9; border: 1px solid #e2e8f0; color: #334155; font-size: 13px; font-weight: 600; text-decoration: none; transition: background .15s, border-color .15s; }
    .jump-nav a:hover { background: #ecfdf5; border-color: #6ee7b7; color: #047857; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-top: 22px; }
    .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; }
    .stat-num { font-size: 20px; font-weight: 800; color: #047857; line-height: 1.2; }
    .stat-label { font-size: 12px; color: #475569; font-weight: 600; margin-top: 4px; }
    .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .step-grid { display: grid; grid-template-columns: 1fr; gap: 22px; align-items: start; }
    .two-col { display: grid; grid-template-columns: 1fr; gap: 22px; }
    @media (min-width: 820px) {
      .step-grid { grid-template-columns: 1.05fr 1fr; }
      .step-grid.reverse .step-media { order: -1; }
      .two-col { grid-template-columns: 1fr 1fr; }
    }
    .step-badge { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 999px; background: #0f172a; color: #fff; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
    .step-badge span { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 999px; background: #10b981; color: #fff; font-size: 11px; font-weight: 800; }
    .shot-frame { margin: 0; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 12px 28px -12px rgba(15, 23, 42, 0.18); }
    .shot-bar { display: flex; align-items: center; gap: 6px; padding: 9px 12px; background: #e2e8f0; border-bottom: 1px solid #cbd5e1; }
    .shot-dot { width: 9px; height: 9px; border-radius: 999px; background: #94a3b8; }
    .shot-url { margin-left: 8px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #475569; background: #fff; padding: 2px 10px; border-radius: 999px; border: 1px solid #cbd5e1; }
    .shot-frame img { display: block; width: 100%; height: auto; }
    .shot-caption { padding: 10px 14px; background: #fff; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; font-weight: 500; }
    .checklist { margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 9px; }
    .checklist li { position: relative; padding-left: 24px; font-size: 14px; color: #334155; }
    .checklist li::before { content: "✓"; position: absolute; left: 0; top: 0; color: #059669; font-weight: 800; }
    .story-card { background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
    .faq-item { border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; background: #fff; }
    .faq-item h3 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #0f172a; }
    .faq-item p { margin: 0; font-size: 14px; color: #475569; }
    .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 12px; background: #059669; color: #fff; font-weight: 700; font-size: 14px; text-decoration: none; }
    .btn-primary:hover { background: #047857; }
    .btn-secondary { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 12px; background: #fff; color: #0f172a; border: 1px solid #cbd5e1; font-weight: 700; font-size: 14px; text-decoration: none; }
    .btn-secondary:hover { background: #f1f5f9; }
    code.inline { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 13px; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  </style>
</head>
<body>
  <header style="background:#fff;border-bottom:1px solid #e2e8f0;padding:14px 0;position:sticky;top:0;z-index:20;">
    <div class="container" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;">
      <a href="/" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:#0f172a;font-weight:800;font-size:18px;">
        <img src="${escapeHtml(origin)}/assets/store254Icon.webp" alt="Store254" width="30" height="30" style="border-radius:8px;display:block;">
        <span>Store254<span style="color:#059669;">.co.ke</span></span>
      </a>
      <nav aria-label="Primary" style="display:flex;align-items:center;gap:16px;font-size:13px;font-weight:600;flex-wrap:wrap;">
        <a href="/stores" style="color:#334155;text-decoration:none;">Active Stores</a>
        <a href="/directory" style="color:#334155;text-decoration:none;">Directory</a>
        <a href="/#open-store" style="color:#fff;background:#059669;padding:8px 14px;border-radius:10px;text-decoration:none;font-weight:700;">Launch Your Store &rarr;</a>
      </nav>
    </div>
  </header>

  <main class="container" style="padding-top:32px;padding-bottom:64px;display:flex;flex-direction:column;gap:26px;">
    <!-- HERO -->
    <section class="card" style="background:linear-gradient(135deg,#ffffff 0%,#ecfdf5 100%);border-color:#d1fae5;">
      <span class="pill">Why Store254</span>
      <h1 style="margin:14px 0 12px;font-size:clamp(28px,4vw,40px);line-height:1.15;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">
        Why Kenyan Businesses Choose Store254 to Sell Online
      </h1>
      <p style="margin:0 0 12px;color:#334155;font-size:16px;max-width:78ch;">
        <strong>Store254</strong> (<a href="https://store254.co.ke/" style="font-weight:700;text-decoration:none;">store254.co.ke</a>) turns any Kenyan retail shop, boutique, hardware, electronics dealer, salon, clinic, or service provider into a fast, Google-indexed online store in minutes — complete with your own <code class="inline">yourshop.store254.co.ke</code> web address, M-Pesa STK Push checkout, and local county discovery.
      </p>
      <p style="margin:0;color:#475569;font-size:15px;max-width:78ch;">
        Below, learn why Store254 was built, read the founder story behind <strong>Kayzen Labs Software Company Limited</strong>, and walk through the exact onboarding screenshots for opening your store, creating categories, adding products or services, and accepting M-Pesa payments.
      </p>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-num">47 Counties</div>
          <div class="stat-label">22,794+ Kenyan towns, wards &amp; shopping centres indexed</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">M-Pesa Direct</div>
          <div class="stat-label">STK Push to your own Safaricom Till or Paybill</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">779+ Icons</div>
          <div class="stat-label">Auto-matched studio artwork even before you upload photos</div>
        </div>
        <div class="stat-box">
          <div class="stat-num">Google SEO Ready</div>
          <div class="stat-label">Dedicated store sitemaps, Product &amp; Service schema</div>
        </div>
      </div>

      <nav class="jump-nav" aria-label="Guide sections">
        <a href="#why-store254">Why Store254</a>
        <a href="#founder-story">Founder Story &amp; Merchant Journeys</a>
        <a href="#onboarding-guide">1. Store Onboarding</a>
        <a href="#categories-guide">2. Creating Categories &amp; Filters</a>
        <a href="#products-services">3. Products, Services &amp; Artwork</a>
        <a href="#mpesa-branding">4. Branding &amp; M-Pesa Setup</a>
        <a href="#faq">FAQ</a>
      </nav>
    </section>

    <!-- WHY STORE254 -->
    <section id="why-store254" class="card">
      <span class="pill">Platform Advantages</span>
      <h2 style="margin:12px 0 8px;font-size:26px;font-weight:800;color:#0f172a;">Built for Real Kenyan Commerce — Not Generic Templates</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;">
        Most Kenyan businesses start by posting photos in WhatsApp statuses, Instagram, or TikTok. Buyers ask <em>"How much?"</em> in DMs, lose old posts, and cannot search your catalog or pay cleanly. Store254 fixes every part of that loop.
      </p>
      <div class="feature-grid">
        <article style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;">
          <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">1. Your Own Branded Link &amp; Custom Domain</h3>
          <p style="margin:0;color:#475569;font-size:14px;">Launch immediately on <code class="inline">yourshop.store254.co.ke</code> or connect your own <code class="inline">.co.ke</code> / <code class="inline">.com</code> domain. Share one clean link in your bio, WhatsApp status, or business card.</p>
        </article>
        <article style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;">
          <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">2. Found on Google &amp; Nearby Kenyan Towns</h3>
          <p style="margin:0;color:#475569;font-size:14px;">Every active store receives automatic XML sitemaps, canonical URLs, and structured <code class="inline">Product</code> / <code class="inline">Service</code> schema — plus 6-ring ripple search linking shoppers in nearby centres to your catalog.</p>
        </article>
        <article style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;">
          <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">3. Direct M-Pesa Till &amp; Paybill Checkout</h3>
          <p style="margin:0;color:#475569;font-size:14px;">Customers check out with their phone number and receive an M-Pesa STK Push prompt directly to your Safaricom Till (Buy Goods) or Paybill — no middleman holding your payouts.</p>
        </article>
        <article style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;">
          <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">4. Edge Speed on Mobile Data</h3>
          <p style="margin:0;color:#475569;font-size:14px;">Uploaded photos are automatically converted to crisp 720px WebP and cached at the edge, so shoppers open your catalog fast even on 3G/4G bundles anywhere in Kenya.</p>
        </article>
        <article style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;">
          <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">5. Products, Services &amp; Digital Items</h3>
          <p style="margin:0;color:#475569;font-size:14px;">Sell physical stock with sizes &amp; colours, accept appointments for bookable services (salons, kinyozis, clinics, repairs), or sell digital downloads in one dashboard.</p>
        </article>
        <article style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;">
          <h3 style="margin:0 0 8px;font-size:17px;font-weight:700;color:#0f172a;">6. Separate Staff Accounts &amp; Rights</h3>
          <p style="margin:0;color:#475569;font-size:14px;">Give shop attendants their own login with specific permissions — e.g. adding products or fulfilling orders — while keeping M-Pesa credentials and store settings locked to the owner.</p>
        </article>
      </div>
    </section>

    <!-- FOUNDER STORY & MERCHANT JOURNEYS -->
    <section id="founder-story" class="card">
      <span class="pill">Founder Story</span>
      <h2 style="margin:12px 0 12px;font-size:26px;font-weight:800;color:#0f172a;">The Story Behind Store254 &amp; Kayzen Labs</h2>
      <div class="two-col" style="align-items:start;">
        <div>
          <p style="margin:0 0 14px;color:#334155;font-size:15px;">
            Store254 was created by <strong>Kelvin Kamau</strong>, a Kenyan <strong>Software Developer</strong> and the <strong>Owner &amp; CEO</strong> of the platform, developed and operated under <strong>Kayzen Labs Software Company Limited</strong> in Nairobi, Kenya.
          </p>
          <p style="margin:0 0 14px;color:#475569;font-size:15px;">
            The idea started from watching thousands of energetic Kenyan business owners hustle daily across Nairobi, Kiambu, Mombasa, Nakuru, Kisumu, and Eldoret — spending hours repeating prices in WhatsApp chats, losing track of orders, or paying hefty agency fees for slow websites that never showed up on Google and broke whenever M-Pesa needed integration.
          </p>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;">
            Instead of forcing local businesses into foreign templates priced in dollars, Kayzen Labs engineered Store254 from the ground up around Kenyan realities: all <strong>47 counties, 290 constituencies, and 22,794+ towns and shopping centres</strong>, native <strong>M-Pesa STK Push</strong>, automatic image optimization, and search-ready storefronts that a merchant can manage right from their phone.
          </p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:6px;font-size:14px;color:#334155;">
            <div><strong>Founder &amp; CEO:</strong> Kelvin Kamau (Software Developer)</div>
            <div><strong>Operating Company:</strong> Kayzen Labs Software Company Limited</div>
            <div><strong>Headquarters:</strong> Nairobi, Kenya</div>
            <div><strong>Direct Contact:</strong> <a href="mailto:kelvin@store254.co.ke" style="font-weight:700;text-decoration:none;">kelvin@store254.co.ke</a> &bull; <a href="https://github.com/Kelvohkash" target="_blank" rel="noopener" style="font-weight:600;text-decoration:none;">GitHub</a></div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <h3 style="margin:0;font-size:17px;font-weight:800;color:#0f172a;">How Kenyan Founders Use Store254 Every Day</h3>
          <article class="story-card">
            <div style="font-size:12px;font-weight:800;color:#059669;text-transform:uppercase;margin-bottom:4px;">Retail &amp; Electronics Founders</div>
            <p style="margin:0;font-size:14px;color:#334155;">
              Instead of sending 20 separate photos per customer on WhatsApp, electronics and phone shops organize stock under <em>Smartphones &rarr; Android Phones</em> with storage filters (<code class="inline">128GB</code> / <code class="inline">256GB</code>) and instant M-Pesa Till checkout.
            </p>
          </article>
          <article class="story-card">
            <div style="font-size:12px;font-weight:800;color:#059669;text-transform:uppercase;margin-bottom:4px;">Salon, Barber &amp; Service Founders</div>
            <p style="margin:0;font-size:14px;color:#334155;">
              Service entrepreneurs list <strong>Bookable Services</strong> with session duration (<code class="inline">45 mins</code>, <code class="inline">2 hrs</code>) and venue mode (<em>At Studio</em>, <em>Mobile / On-Site</em>, or <em>Online</em>), letting clients browse clear prices and book without back-and-forth calls.
            </p>
          </article>
          <article class="story-card">
            <div style="font-size:12px;font-weight:800;color:#059669;text-transform:uppercase;margin-bottom:4px;">County Dukas, Hardware &amp; Agrovet Founders</div>
            <p style="margin:0;font-size:14px;color:#334155;">
              By pinning their exact county and local shopping centre during onboarding, county merchants appear in Store254's nearby-town ripple search so buyers in surrounding estates and wards find local stock first.
            </p>
          </article>
        </div>
      </div>
    </section>

    <!-- STEP-BY-STEP ONBOARDING GUIDE -->
    <section id="onboarding-guide" class="card">
      <span class="pill">Merchant Onboarding Guide</span>
      <h2 style="margin:12px 0 8px;font-size:26px;font-weight:800;color:#0f172a;">Step 1 &amp; 2: Opening Your Store on Store254</h2>
      <p style="margin:0 0 24px;color:#475569;font-size:15px;">
        Anyone with a Kenyan business can apply for a storefront in under 3 minutes from <a href="https://store254.co.ke/" style="font-weight:700;text-decoration:none;">store254.co.ke</a> by clicking <strong>Open your store</strong>.
      </p>

      <div class="step-grid" style="margin-bottom:32px;">
        <div>
          <div class="step-badge"><span>1</span> Verify Owner Identity with Google</div>
          <h3 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">Sign In with Google to Protect Ownership</h3>
          <p style="margin:0 0 10px;color:#475569;font-size:14px;">
            Before creating a store, click <strong>Continue with Google to Open Store</strong>. Your Google account email is permanently bound as the store owner email so nobody else can claim or alter your business ownership.
          </p>
          <ul class="checklist">
            <li>Takes one tap with your existing Gmail / Google Workspace account.</li>
            <li>Protects your admin recovery and store ownership permanently.</li>
            <li>Keeps store owner access separate from staff accounts you add later.</li>
          </ul>
        </div>
        <figure class="shot-frame step-media">
          <div class="shot-bar"><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-url">store254.co.ke &middot; Open your store</span></div>
          <img src="${guideImgUrl("onboard-google.webp")}" alt="Store254 Google Sign-In verification step inside the Onboard Your Store modal" loading="lazy">
          <figcaption class="shot-caption">Step 1: Verify your owner email via Google before entering store details.</figcaption>
        </figure>
      </div>

      <div class="step-grid reverse">
        <div>
          <div class="step-badge"><span>2</span> Pick Your Subdomain, Type &amp; Kenya Location</div>
          <h3 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">Claim Your <code class="inline">.store254.co.ke</code> Address &amp; Pin Your Town</h3>
          <p style="margin:0 0 10px;color:#475569;font-size:14px;">
            Once signed in, complete the onboarding form to configure how buyers find and recognize your business:
          </p>
          <ul class="checklist">
            <li><strong>Business / Store Name &amp; Subdomain:</strong> Type your desired handle (for example <code class="inline">nairobitech.store254.co.ke</code>) — availability is checked live as you type.</li>
            <li><strong>20 Business Types:</strong> Choose from General Retail &amp; Duka, Fashion/Mtumba, Electronics, Beauty/Salon, Food &amp; Groceries, Hardware, Pharmacy, Agrovet, Real Estate, Services, and more.</li>
            <li><strong>County &amp; Shopping Centre:</strong> Pick your County, then type your town, estate, ward, or market. Store254 automatically links your constituency and <strong>Smart Connected Nearby Centres</strong> (or lets you add an unlisted shopping centre).</li>
            <li><strong>Password &amp; Terms:</strong> Set your Store Admin password, accept the Terms &amp; original-media policy, and click <strong>Submit Store Application</strong>.</li>
          </ul>
        </div>
        <figure class="shot-frame step-media">
          <div class="shot-bar"><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-url">store254.co.ke &middot; Store Onboarding Form</span></div>
          <img src="${guideImgUrl("onboard-store.webp")}" alt="Store254 onboarding form showing live subdomain availability check, business type selector, and Kenya county and shopping centre location picker" loading="lazy">
          <figcaption class="shot-caption">Step 2: Choose your live subdomain, business category, county, and town or shopping centre.</figcaption>
        </figure>
      </div>
    </section>

    <!-- HOW TO CREATE CATEGORIES & FILTERS -->
    <section id="categories-guide" class="card">
      <span class="pill">Store Admin Guide</span>
      <h2 style="margin:12px 0 8px;font-size:26px;font-weight:800;color:#0f172a;">How to Create Categories, Subcategories &amp; Product Filters</h2>
      <p style="margin:0 0 22px;color:#475569;font-size:15px;">
        Well-organized categories turn casual visitors into buyers and help Google index your storefront cleanly. Inside your Store Admin (<code class="inline">yourshop.store254.co.ke/admin.html</code>), open <strong>Categories</strong> from the sidebar.
      </p>

      <div class="step-grid">
        <div>
          <div class="step-badge"><span>3</span> Organize Top-Level Categories &amp; Subcategories</div>
          <h3 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">Step-by-Step: Creating a Category or Subcategory</h3>
          <ul class="checklist">
            <li>Click <strong>+ New Category</strong> in the Categories toolbar.</li>
            <li>Enter a clear <strong>Category Name</strong> (e.g. <em>Smartphones &amp; Tablets</em>, <em>Baby Clothes</em>, or <em>Solar Inverters &amp; Batteries</em>).</li>
            <li><strong>Top-Level vs. Subcategory:</strong> Leave <strong>Parent Category</strong> as <em>None (top-level)</em> for a main aisle, or select an existing category (such as <em>Smartphones &amp; Tablets</em>) to nest a subcategory underneath it.</li>
            <li>Add a short <strong>Description</strong> — Store254's built-in <strong>Card Icon Classifier</strong> automatically picks a matching vector icon in real time, or you can search and pick any icon manually from the grid.</li>
            <li><strong>Add Product Filters:</strong> Click <strong>+ Add Product Filter</strong> to attach custom storefront filters like <em>Storage Capacity</em>, <em>Size</em>, <em>Warranty</em>, or <em>Brand</em> (Choice list, Number, Yes/No, or Multiple choices) to one category or all categories.</li>
          </ul>
        </div>
        <figure class="shot-frame step-media">
          <div class="shot-bar"><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-url">yourshop.store254.co.ke/admin.html &middot; Categories</span></div>
          <img src="${guideImgUrl("create-category.webp")}" alt="Store254 Store Admin New Category modal showing Category Name, Parent Category dropdown for subcategories, Description, and automatic Card Icon Classifier" loading="lazy">
          <figcaption class="shot-caption">Creating a subcategory in Store Admin with automatic icon matching and custom icon picker.</figcaption>
        </figure>
      </div>
    </section>

    <!-- PRODUCTS, SERVICES & STUDIO ARTWORK -->
    <section id="products-services" class="card">
      <span class="pill">Catalog &amp; Services</span>
      <h2 style="margin:12px 0 8px;font-size:26px;font-weight:800;color:#0f172a;">Adding Products, Bookable Services, Photos &amp; Studio Artwork</h2>
      <p style="margin:0 0 22px;color:#475569;font-size:15px;">
        Click <strong>+ Add Product</strong> from the top bar of Store Admin to publish physical products, bookable services, or digital downloads.
      </p>

      <div class="step-grid reverse">
        <div>
          <div class="step-badge"><span>4</span> Publish Items with Photos or Auto Studio Artwork</div>
          <h3 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;">Everything Inside the Product &amp; Service Editor</h3>
          <ul class="checklist">
            <li><strong>Title, Description &amp; KES Price:</strong> Enter your item title, clear description, <strong>Price (KES)</strong>, and an optional <strong>Compare-at Price</strong> to highlight discounts.</li>
            <li><strong>Choose Item Type:</strong> Pick <strong>Physical Product</strong> (tracks stock quantity), <strong>Bookable Service</strong> (unlocks Booking Status, Studio/On-site/Virtual venue &amp; duration), or <strong>Digital Product</strong> (unlimited availability).</li>
            <li><strong>Category &amp; Custom Details:</strong> Assign the item to a category/subcategory and fill in any category filters (like <em>Warranty</em> or <em>Storage</em>).</li>
            <li><strong>Product Variants:</strong> Add optional sizes, colours, or service packages, each with its own price and stock count.</li>
            <li><strong>Up to 5 Photos or No-Photo Studio Artwork:</strong> Upload up to 5 original photos (automatically optimized to fast WebP). Don't have a photo yet? Store254 automatically generates crisp <strong>Studio Icon Artwork</strong> from 779+ icons matched to your title and category.</li>
          </ul>
        </div>
        <figure class="shot-frame step-media">
          <div class="shot-bar"><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-url">yourshop.store254.co.ke/admin.html &middot; Add Product</span></div>
          <img src="${guideImgUrl("add-product.webp")}" alt="Store254 Add Product modal showing KES price, Category, Item Type, Product Details, Stock Quantity, Photo Upload, and No-Photo Studio Icon Artwork picker" loading="lazy">
          <figcaption class="shot-caption">Adding a product in Store Admin with category filters, stock tracking, photo uploads, and auto-matched studio icon artwork.</figcaption>
        </figure>
      </div>
    </section>

    <!-- STORE APPEARANCE & M-PESA -->
    <section id="mpesa-branding" class="card">
      <span class="pill">Branding &amp; Checkout</span>
      <h2 style="margin:12px 0 8px;font-size:26px;font-weight:800;color:#0f172a;">Customizing Your Storefront &amp; Connecting M-Pesa STK Push</h2>
      <p style="margin:0 0 22px;color:#475569;font-size:15px;">
        Finish setting up your shop identity under <strong>Store Settings</strong> and turn on instant mobile money checkout under <strong>M-Pesa / Payments</strong>.
      </p>

      <div class="two-col">
        <div>
          <div class="step-badge"><span>5</span> Store Appearance, Domain &amp; Staff</div>
          <h3 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#0f172a;">Make the Storefront Unmistakably Yours</h3>
          <p style="margin:0 0 12px;color:#475569;font-size:14px;">
            Choose from 9 accent colours, upload your <strong>Logo</strong> and <strong>Hero Banner</strong>, add your <strong>WhatsApp</strong>, phone, pickup address, and social links, map a <strong>Custom Domain</strong>, and create <strong>Staff Accounts</strong> with granular permissions.
          </p>
          <figure class="shot-frame">
            <div class="shot-bar"><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-url">admin.html &middot; Store Settings</span></div>
            <img src="${guideImgUrl("store-branding.webp")}" alt="Store254 Store Settings screen showing accent colour, product display mode, logo and hero banner upload, and contact links" loading="lazy">
            <figcaption class="shot-caption">Store Settings: accent colour, logo, hero banner, WhatsApp &amp; pickup address.</figcaption>
          </figure>
        </div>

        <div>
          <div class="step-badge"><span>6</span> M-Pesa Till / Paybill STK Push</div>
          <h3 style="margin:0 0 8px;font-size:18px;font-weight:800;color:#0f172a;">Accept Direct M-Pesa Payments</h3>
          <p style="margin:0 0 12px;color:#475569;font-size:14px;">
            Enable M-Pesa prompts for orders, pick <strong>Paybill</strong> or <strong>Till (Buy Goods)</strong>, enter your Shortcode and Safaricom Daraja Consumer Key, Consumer Secret, and Passkey (stored encrypted and never exposed to customers).
          </p>
          <figure class="shot-frame">
            <div class="shot-bar"><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-dot"></span><span class="shot-url">admin.html &middot; M-Pesa / Payments</span></div>
            <img src="${guideImgUrl("mpesa-settings.webp")}" alt="Store254 M-Pesa Payment Settings screen showing Paybill or Till Buy Goods selector, Shortcode, and encrypted Daraja API credentials" loading="lazy">
            <figcaption class="shot-caption">M-Pesa Settings: connect your own Till or Paybill for instant STK Push prompts.</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="card">
      <span class="pill">Common Questions</span>
      <h2 style="margin:12px 0 16px;font-size:26px;font-weight:800;color:#0f172a;">Frequently Asked Questions</h2>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <article class="faq-item">
          <h3>Why choose Store254 over selling only on WhatsApp or Instagram?</h3>
          <p>Social feeds bury older posts and force buyers to ask for prices in DMs. Store254 gives your business a permanent, Google-searchable catalog with categories, filters, instant cart/checkout, and M-Pesa STK Push.</p>
        </article>
        <article class="faq-item">
          <h3>Do I need product photos before I launch?</h3>
          <p>No. You can upload up to 5 photos per item (automatically converted to fast 720px WebP), and if a product has no photo yet, Store254 automatically displays crisp studio icon artwork matched from 779+ icons.</p>
        </article>
        <article class="faq-item">
          <h3>Can I sell services like salon bookings, plumbing, or phone repairs?</h3>
          <p>Yes. Select <strong>Bookable Service</strong> as the Item Type when adding an item to set booking availability, session duration, and whether the service is in-shop, mobile at the client's location, or virtual.</p>
        </article>
        <article class="faq-item">
          <h3>How quickly will my store appear on Google?</h3>
          <p>Once your store is active and has published items, Store254 automatically adds your storefront, categories, and products/services to dynamic XML sitemaps and emits structured JSON-LD schema for search engines.</p>
        </article>
      </div>
    </section>

    <!-- CTA -->
    <section class="card" style="background:linear-gradient(135deg,#064e3b 0%,#0f172a 100%);color:#fff;border-color:#065f46;text-align:center;padding:36px 24px;">
      <h2 style="margin:0 0 10px;font-size:28px;font-weight:800;color:#fff;">Ready to Put Your Business Online?</h2>
      <p style="margin:0 auto 22px;max-width:60ch;color:#d1fae5;font-size:15px;">
        Join Kenyan merchants across all 47 counties selling smarter with Store254. Launch your storefront today or explore active Kenyan shops in the directory.
      </p>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;">
        <a href="/#open-store" class="btn-primary" style="background:#10b981;color:#022c22;">Open Your Store on Store254 &rarr;</a>
        <a href="/directory" class="btn-secondary" style="background:rgba(255,255,255,0.1);color:#fff;border-color:rgba(255,255,255,0.25);">Browse Kenyan Store Directory</a>
      </div>
    </section>
  </main>

  <footer style="border-top:1px solid #e2e8f0;background:#fff;padding:20px;text-align:center;font-size:13px;color:#64748b;">
    &copy; 2026 Store254.co.ke &bull; Kayzen Labs Software Company Limited &bull; Nairobi, Kenya &bull;
    <a href="/stores" style="color:#059669;text-decoration:none;font-weight:600;">Stores</a> &bull;
    <a href="/directory" style="color:#059669;text-decoration:none;font-weight:600;">Directory</a> &bull;
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
  ${buildSearchEngineAndIconTags({
    origin,
    includeBingMeta: !options.robots.startsWith("noindex"),
    includeIcons: true,
    includeOpenSearch: true,
    openSearchTitle: "Store254",
  })}
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Store254">
  <meta property="og:locale" content="en_KE">
  <meta property="og:title" content="${escapeHtml(options.title)}">
  <meta property="og:description" content="${escapeHtml(options.description)}">
  <meta property="og:url" content="${escapeHtml(options.canonicalUrl)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(options.title)}">
  <meta name="twitter:description" content="${escapeHtml(options.description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
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
    <a href="/about" style="color:#059669;text-decoration:none;">Why Store254</a>
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
    "Store254 Terms & Conditions: copyright and image takedown (Kenya Copyright Act), M-Pesa payment terms, merchant responsibilities and liability limits.";

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
    "Store254 Privacy Policy under the Kenya Data Protection Act, 2019 (ODPC): how we collect, protect and process merchant, buyer and copyright report data.";

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
  const allBtn = `<a href="/" data-action="select-category" data-category-slug="" class="category-pill ${
    activeSlug === "" ? "category-pill-active" : "category-pill-inactive"
  }"><span>All Items</span></a>`;
  const links = roots.map((cat) => {
    const active = cat.slug === activeSlug;
    return `<a href="/category/${encodeURIComponent(cat.slug)}" data-action="select-category" data-category-slug="${escapeHtml(cat.slug)}" class="category-pill ${
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
  const storeLogoUrl = toAbsoluteUrl(settings.logoUrl, origin);
  const storeBannerUrl = toAbsoluteUrl(settings.bannerUrl || settings.heroBannerUrl, origin);
  const firstUploadedItemImg =
    items
      .map((it) => (Array.isArray(it.images) ? toAbsoluteUrl(it.images[0], origin) : ""))
      .find(Boolean) || "";
  // Always prioritize the merchant's own logo when sharing their storefront link,
  // falling back to their banner or uploaded product photo before Store254's mark.
  const storeImage =
    storeLogoUrl || storeBannerUrl || firstUploadedItemImg || `${origin}/assets/store254Logo.webp`;
  const robotsBase = isPreview
    ? "noindex, nofollow"
    : items.length === 0
      ? "noindex, follow"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const includeBingMeta = !isPreview && origin.toLowerCase().endsWith(`.${PRIMARY_DOMAIN}`);
  const bingMetaTag = includeBingMeta
    ? `<meta name="msvalidate.01" content="${escapeHtml(BING_SITE_AUTH_TOKEN)}">`
    : "";

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
    const title = buildItemSeoTitle(matchedItem.title, priceLabel, tenant.name);
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
      ...(bingMetaTag ? [bingMetaTag] : []),
      `<meta property="og:type" content="${isService ? "website" : "product"}">`,
      `<meta property="og:site_name" content="${escapeHtml(tenant.name)}">`,
      `<meta property="og:locale" content="en_KE">`,
      `<meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta property="og:description" content="${escapeHtml(description)}">`,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      `<meta property="og:image" content="${escapeHtml(primaryItemImg)}">`,
      `<meta property="og:image:alt" content="${escapeHtml(matchedItem.title)}">`,
      ...(storeLogoUrl ? [`<meta property="og:logo" content="${escapeHtml(storeLogoUrl)}">`] : []),
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
    const categoryRobots = isPreview
      ? "noindex, nofollow"
      : filteredItems.length === 0
        ? "noindex, follow"
        : robotsBase;
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
      `<meta name="robots" content="${escapeHtml(categoryRobots)}">`,
      ...(bingMetaTag && !categoryRobots.startsWith("noindex") ? [bingMetaTag] : []),
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${escapeHtml(tenant.name)}">`,
      `<meta property="og:locale" content="en_KE">`,
      `<meta property="og:title" content="${escapeHtml(title)}">`,
      `<meta property="og:description" content="${escapeHtml(description)}">`,
      `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
      `<meta property="og:image" content="${escapeHtml(storeImage)}">`,
      `<meta property="og:image:alt" content="${escapeHtml(`${cat.name} — ${tenant.name}`)}">`,
      ...(storeLogoUrl ? [`<meta property="og:logo" content="${escapeHtml(storeLogoUrl)}">`] : []),
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
      robots: categoryRobots,
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
    ...(bingMetaTag ? [bingMetaTag] : []),
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(tenant.name)}">`,
    `<meta property="og:locale" content="en_KE">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:image" content="${escapeHtml(storeImage)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(tenant.name)}">`,
    ...(storeLogoUrl ? [`<meta property="og:logo" content="${escapeHtml(storeLogoUrl)}">`] : []),
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
