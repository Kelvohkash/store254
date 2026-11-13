export const PRIMARY_DOMAIN = "store254.co.ke";

export interface PlatformStoreSeo {
  id: string;
  name: string;
  subdomain: string;
  customDomain?: string | null;
  businessType?: string;
  currency?: string;
  settings?: Record<string, unknown>;
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
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "billing",
  "cdn",
  "dashboard",
  "docs",
  "ftp",
  "help",
  "mail",
  "portal",
  "root",
  "smtp",
  "ssl",
  "static",
  "status",
  "store254",
  "support",
  "sysadmin",
  "system",
  "webmail",
  "www",
]);

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
    normalized === "/admin.html" ||
    normalized === "/super-admin" ||
    normalized === "/super-admin.html" ||
    normalized === "/super-admin-login" ||
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
  stores?: Pick<PlatformStoreSeo, "subdomain" | "customDomain">[];
  includePlatformIndex?: boolean;
}): string {
  if (options.isPreview) {
    return "User-agent: *\nDisallow: /\n";
  }

  const lines = [
    "User-agent: *",
    "Allow: /",
    "Allow: /api/media/",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /admin",
    "Disallow: /admin.html",
    "Disallow: /super-admin",
    "Disallow: /super-admin.html",
    "Disallow: /super-admin-login",
    "Disallow: /super-admin-login.html",
    "",
    `Sitemap: ${options.canonicalOrigin}/sitemap.xml`,
  ];

  if (options.includePlatformIndex) {
    lines.push(`Sitemap: ${options.canonicalOrigin}/sitemap-index.xml`);
    const seen = new Set<string>();
    for (const store of options.stores || []) {
      const storeOrigin = resolveStoreOriginForPlatform(store);
      const sitemapUrl = `${storeOrigin}/sitemap.xml`;
      if (!seen.has(sitemapUrl)) {
        seen.add(sitemapUrl);
        lines.push(`Sitemap: ${sitemapUrl}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export function buildPlatformSitemapXml(stores: PlatformStoreSeo[] = []): string {
  const origin = `https://${PRIMARY_DOMAIN}`;
  const latestTimestamp = stores
    .map((s) => formatIsoDate(s.updatedAt || s.createdAt))
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${escapeXml(origin)}/</loc>`,
    latestTimestamp ? `    <lastmod>${escapeXml(latestTimestamp)}</lastmod>` : "",
    "    <changefreq>daily</changefreq>",
    "    <priority>1.0</priority>",
    "  </url>",
    "</urlset>",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPlatformSitemapIndexXml(stores: PlatformStoreSeo[] = []): string {
  const rootOrigin = `https://${PRIMARY_DOMAIN}`;
  const entries = [
    [
      "  <sitemap>",
      `    <loc>${escapeXml(rootOrigin)}/sitemap.xml</loc>`,
      "  </sitemap>",
    ].join("\n"),
  ];

  const seenOrigins = new Set<string>();
  for (const store of stores) {
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
  const settings = parseSettings(tenant.settings);
  const storeImage = toAbsoluteUrl(settings.bannerUrl || settings.logoUrl, origin);
  const urls: string[] = [];

  urls.push(
    [
      "  <url>",
      `    <loc>${escapeXml(origin)}/</loc>`,
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

  for (const cat of categories) {
    if (!cat.slug) continue;
    urls.push(
      [
        "  <url>",
        `    <loc>${escapeXml(`${origin}/category/${encodeURIComponent(cat.slug)}`)}</loc>`,
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
      ].join("\n")
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

function getSchemaStoreType(businessType: string | undefined): string {
  switch (String(businessType || "").toUpperCase()) {
    case "ELECTRONICS":
      return "ElectronicsStore";
    case "FURNITURE":
      return "FurnitureStore";
    case "SERVICES":
      return "ProfessionalService";
    case "RETAIL":
      return "Store";
    default:
      return "OnlineStore";
  }
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
  const logo = toAbsoluteUrl(settings.logoUrl, origin) || `${origin}/assets/favicon.png`;
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

export function buildPlatformSeoData(
  stores: PlatformStoreSeo[],
  isPreview: boolean
): {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  headTagsHtml: string;
  ssrStoresHtml: string;
} {
  const origin = `https://${PRIMARY_DOMAIN}`;
  const title = "Store254 | Kenyan Online Stores & M-Pesa Storefronts";
  const description =
    "Browse independent Kenyan online stores on Store254, shop products and services directly with M-Pesa, or launch your own .store254.co.ke storefront.";
  const canonicalUrl = `${origin}/`;
  const robots = isPreview
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const ogImage = `${origin}/assets/store254Logo.webp`;

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Store254",
        url: `${origin}/`,
        logo: ogImage,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "Store254",
        url: `${origin}/`,
        description,
      },
      ...(stores.length > 0
        ? [
            {
              "@type": "ItemList",
              name: "Active Storefronts on Store254",
              itemListElement: stores.slice(0, 50).map((s, idx) => {
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
        : []),
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
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(ogImage)}">`,
    `<script type="application/ld+json">${safeJsonLd(graph)}</script>`,
  ].join("");

  const ssrStoresHtml = stores
    .slice(0, 50)
    .map((s) => {
      const settings = parseSettings(s.settings);
      const href = `${resolveStoreOriginForPlatform(s)}/`;
      const desc = escapeHtml(
        settings.description || settings.tagline || "Browse products & services and pay directly via M-Pesa."
      );
      const initial = escapeHtml((s.name || "S").trim().slice(0, 1).toUpperCase());
      const badge = escapeHtml((s.businessType || "Store").replace(/_/g, " "));
      const bannerUrl = toAbsoluteUrl(settings.bannerUrl, origin);
      const logoUrl = toAbsoluteUrl(settings.logoUrl, origin);
      const coverStyle = bannerUrl
        ? `style="background-image: linear-gradient(180deg, rgba(16, 30, 22, 0.2), rgba(16, 30, 22, 0.72)), url('${escapeHtml(bannerUrl)}'); background-size: cover; background-position: center;"`
        : "";
      const avatar = logoUrl
        ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover rounded-full">`
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
                <h4 class="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate text-sm sm:text-base">${escapeHtml(s.name)}</h4>
                <span class="text-xs text-slate-400 font-mono truncate block mt-0.5">${escapeHtml(s.subdomain)}.${PRIMARY_DOMAIN}</span>
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
    })
    .join("");

  return {
    title,
    description,
    canonicalUrl,
    robots,
    headTagsHtml,
    ssrStoresHtml,
  };
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

function buildSsrItemCardsHtml(origin: string, items: SeoItem[], currency: string, categories: SeoCategory[]): string {
  const catNameById = new Map<string, string>(categories.map((c) => [c.id, c.name]));
  return items.slice(0, 60).map((item) => {
    const isService = item.itemType === "SERVICE";
    const href = `/item/${encodeURIComponent(item.slug)}`;
    const primaryImg =
      (Array.isArray(item.images) && toAbsoluteUrl(item.images[0], origin)) ||
      (isService
        ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
        : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80");
    const categoryLabel =
      (item.attributes && typeof item.attributes.brand === "string" && item.attributes.brand) ||
      (item.categoryId && catNameById.get(item.categoryId)) ||
      (isService ? "Service" : "Featured");
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
    (isService
      ? "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80"
      : "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80");
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
  const defaultStoreDesc =
    settings.description ||
    settings.tagline ||
    `Shop verified products and services directly from ${tenant.name} (${subdomainLabel}) with instant M-Pesa checkout.`;
  const storeImage =
    toAbsoluteUrl(settings.bannerUrl || settings.logoUrl, origin) || `${origin}/assets/store254Logo.webp`;
  const robotsBase = isPreview
    ? "noindex, nofollow"
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
