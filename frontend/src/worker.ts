import {
  PRIMARY_DOMAIN,
  buildPlatformAboutHtml,
  buildPlatformDirectoryHtml,
  buildPlatformSeoData,
  buildPlatformSitemapIndexXml,
  buildPlatformSitemapXml,
  buildRobotsTxt,
  buildStorefrontSeoData,
  buildStorefrontSitemapXml,
  classifyHost,
  escapeHtml,
  getDirectoryHubForBusinessType,
  parseStorefrontRoute,
  resolveTenantCanonicalOrigin,
  sanitizeSlug,
  type PlatformStoreSeo,
  type SeoItemDetailPayload,
  type SeoStorefrontPayload,
} from "./seo";

interface Env {
  ASSETS: Fetcher;
  API: Fetcher;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

async function fetchCachedSeoJson<T>(
  api: Fetcher,
  apiPath: string,
  cacheKeySuffix: string,
  tenantHeaders: Record<string, string>,
  clientIp: string,
  ctx?: ExecutionContext,
  ttlSeconds = 60
): Promise<{ status: number; data: T | null }> {
  const cacheUrl = `https://seo-cache.internal${apiPath}?key=${encodeURIComponent(cacheKeySuffix)}`;
  const cacheRequest = new Request(cacheUrl, { method: "GET" });
  const cache = typeof caches !== "undefined" ? (caches as unknown as { default: Cache }).default : null;

  if (cache) {
    try {
      const cached = await cache.match(cacheRequest);
      if (cached) {
        if (!cached.ok) {
          return { status: cached.status, data: null };
        }
        const json = (await cached.json()) as { success?: boolean; data?: T };
        return { status: cached.status, data: json?.success ? (json.data ?? null) : null };
      }
    } catch {
      // Cache lookup failed; fall through to live internal API request
    }
  }

  const headers = new Headers(tenantHeaders);
  if (clientIp) {
    headers.set("CF-Connecting-IP", clientIp);
  }

  const res = await api.fetch(new Request(`https://api.internal${apiPath}`, { method: "GET", headers }));
  if (!res.ok) {
    return { status: res.status, data: null };
  }

  const bodyText = await res.text();
  if (cache) {
    const cacheResponse = new Response(bodyText, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });
    if (ctx) {
      ctx.waitUntil(cache.put(cacheRequest, cacheResponse));
    } else {
      await cache.put(cacheRequest, cacheResponse);
    }
  }

  try {
    const parsed = JSON.parse(bodyText) as { success?: boolean; data?: T };
    return { status: res.status, data: parsed?.success ? (parsed.data ?? null) : null };
  } catch {
    return { status: 502, data: null };
  }
}

function withRobotsHeader(response: Response, value: string, status?: number): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", value);
  return new Response(response.body, {
    status: status ?? response.status,
    statusText: response.statusText,
    headers,
  });
}

function removeHiddenClass(el: Element): void {
  const cls = el.getAttribute("class") || "";
  if (!cls) return;
  const next = cls
    .split(/\s+/)
    .filter((token) => token && token !== "hidden")
    .join(" ");
  if (next) {
    el.setAttribute("class", next);
  } else {
    el.removeAttribute("class");
  }
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const hostInfo = classifyHost(url.hostname);
    const clientIp = getClientIp(request);

    // Proxy API and OAuth endpoints directly to the backend worker.
    if (
      url.pathname === "/api" ||
      url.pathname.startsWith("/api/") ||
      url.pathname === "/auth" ||
      url.pathname.startsWith("/auth/")
    ) {
      const isPublicMediaRead =
        url.pathname.startsWith("/api/media/") &&
        (request.method === "GET" || request.method === "HEAD");
      const edgeCache = isPublicMediaRead
        ? (caches as unknown as { default?: Cache }).default
        : undefined;
      const cacheKey = isPublicMediaRead ? new Request(url.toString(), { method: "GET" }) : undefined;

      if (edgeCache && cacheKey) {
        const cached = await edgeCache.match(cacheKey);
        if (cached) {
          const ifNoneMatch = request.headers.get("if-none-match");
          const cachedEtag = cached.headers.get("etag");
          if (ifNoneMatch && cachedEtag && ifNoneMatch === cachedEtag) {
            return new Response(null, { status: 304, headers: cached.headers });
          }
          if (request.method === "HEAD") {
            return new Response(null, { status: cached.status, headers: cached.headers });
          }
          return cached;
        }
      }

      const apiUrl = new URL(`${url.pathname}${url.search}`, "https://api.internal");
      const headers = new Headers(request.headers);
      headers.set("X-Forwarded-Host", url.host);
      headers.delete("X-CF-Latitude");
      headers.delete("X-CF-Longitude");
      headers.delete("X-CF-City");
      headers.delete("X-CF-Country");
      const cfMeta = (request as Request & {
        cf?: { latitude?: string | number; longitude?: string | number; city?: string; country?: string };
      }).cf;
      if (cfMeta?.latitude !== undefined && cfMeta?.longitude !== undefined) {
        headers.set("X-CF-Latitude", String(cfMeta.latitude));
        headers.set("X-CF-Longitude", String(cfMeta.longitude));
      }
      if (cfMeta?.city) headers.set("X-CF-City", String(cfMeta.city));
      if (cfMeta?.country) headers.set("X-CF-Country", String(cfMeta.country));

      const apiResponse = await env.API.fetch(
        new Request(apiUrl, {
          method: request.method,
          headers,
          body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
          redirect: "manual",
        })
      );

      if (url.pathname.startsWith("/auth/")) {
        return apiResponse;
      }
      // Allow Googlebot-Image on public product photos (/api/media/*) & cache immutable responses at edge.
      if (url.pathname.startsWith("/api/media/")) {
        if (isPublicMediaRead && apiResponse.status === 200 && edgeCache && cacheKey) {
          ctx.waitUntil(edgeCache.put(cacheKey, apiResponse.clone()));
        }
        return apiResponse;
      }
      return withRobotsHeader(apiResponse, "noindex, nofollow");
    }

    // Dynamic robots.txt for both the root marketplace and every independent storefront subdomain.
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/robots.txt") {
      if (hostInfo.isPreviewHost || hostInfo.hostname === `api.${PRIMARY_DOMAIN}`) {
        return new Response(buildRobotsTxt({ isPreview: true, canonicalOrigin: url.origin }), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      }

      if (hostInfo.isPlatformRoot) {
        const { data: stores } = await fetchCachedSeoJson<PlatformStoreSeo[]>(
          env.API,
          "/api/platform/seo-stores",
          "platform-stores",
          { "X-Forwarded-Host": url.host },
          clientIp,
          ctx,
          120
        );
        return new Response(
          buildRobotsTxt({
            isPreview: false,
            canonicalOrigin: `https://${PRIMARY_DOMAIN}`,
            stores: stores || [],
            includePlatformIndex: true,
          }),
          {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
            },
          }
        );
      }

      const { data: storefrontPayload } = await fetchCachedSeoJson<SeoStorefrontPayload>(
        env.API,
        "/api/seo/storefront",
        hostInfo.hostname,
        { "X-Forwarded-Host": url.host },
        clientIp,
        ctx,
        120
      );

      if (!storefrontPayload?.tenant) {
        return new Response("User-agent: *\nDisallow: /\n", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }

      const canonicalOrigin = resolveTenantCanonicalOrigin(url, storefrontPayload.tenant);
      return new Response(
        buildRobotsTxt({
          isPreview: false,
          canonicalOrigin,
        }),
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
          },
        }
      );
    }

    // Dynamic XML sitemaps for root marketplace and independent subdomains.
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sitemap-index.xml") {
      if (!hostInfo.isPlatformRoot || hostInfo.isPreviewHost) {
        return new Response("Not Found", { status: 404 });
      }
      const { data: stores } = await fetchCachedSeoJson<PlatformStoreSeo[]>(
        env.API,
        "/api/platform/seo-stores",
        "platform-stores",
        { "X-Forwarded-Host": url.host },
        clientIp,
        ctx,
        120
      );
      return new Response(buildPlatformSitemapIndexXml(stores || []), {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      });
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/sitemap.xml") {
      if (hostInfo.isPreviewHost || hostInfo.hostname === `api.${PRIMARY_DOMAIN}`) {
        return new Response("Not Found", { status: 404 });
      }

      if (hostInfo.isPlatformRoot) {
        const { data: stores } = await fetchCachedSeoJson<PlatformStoreSeo[]>(
          env.API,
          "/api/platform/seo-stores",
          "platform-stores",
          { "X-Forwarded-Host": url.host },
          clientIp,
          ctx,
          120
        );
        return new Response(buildPlatformSitemapXml(stores || []), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
          },
        });
      }

      const { status, data: storefrontPayload } = await fetchCachedSeoJson<SeoStorefrontPayload>(
        env.API,
        "/api/seo/storefront",
        hostInfo.hostname,
        { "X-Forwarded-Host": url.host },
        clientIp,
        ctx,
        60
      );

      if (!storefrontPayload?.tenant) {
        return new Response("Storefront sitemap not found", {
          status: status === 404 ? 404 : 503,
          headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
        });
      }

      const canonicalOrigin = resolveTenantCanonicalOrigin(url, storefrontPayload.tenant);
      return new Response(buildStorefrontSitemapXml(canonicalOrigin, storefrontPayload), {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      });
    }

    const route = parseStorefrontRoute(url.pathname);
    const explicitStoreSlug = sanitizeSlug(url.searchParams.get("store") || url.searchParams.get("subdomain"));
    const isTenantContext = !hostInfo.isPlatformRoot || Boolean(explicitStoreSlug);

    // About Page (/about) on platform root domain (kept off top header nav; indexed via sitemap & subtle footer link)
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      !isTenantContext &&
      (url.pathname === "/about" || url.pathname === "/about/")
    ) {
      const aboutPage = buildPlatformAboutHtml(hostInfo.isPreviewHost);
      return new Response(request.method === "HEAD" ? null : aboutPage.html, {
        status: aboutPage.status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Robots-Tag": aboutPage.robots,
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      });
    }

    // Marketplace Directory Hub Pages (/directory and /directory/:category) on root domain
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      !isTenantContext &&
      (url.pathname === "/directory" || url.pathname.startsWith("/directory/"))
    ) {
      const dirMatch = url.pathname.match(/^\/directory(?:\/([^/]+))?\/?$/);
      if (dirMatch) {
        const categorySlug = dirMatch[1] ? decodeURIComponent(dirMatch[1]) : "";
        const page = Number(url.searchParams.get("page") || "1");
        const { data: stores } = await fetchCachedSeoJson<PlatformStoreSeo[]>(
          env.API,
          "/api/platform/seo-stores",
          "platform-stores",
          { "X-Forwarded-Host": url.host },
          clientIp,
          ctx,
          120
        );
        const dirPage = buildPlatformDirectoryHtml(stores || [], {
          categorySlug,
          page,
          isPreview: hostInfo.isPreviewHost,
        });
        return new Response(request.method === "HEAD" ? null : dirPage.html, {
          status: dirPage.status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "X-Robots-Tag": dirPage.robots,
            "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
          },
        });
      }
    }

    // Admin routes get explicit noindex headers
    if (route.kind === "admin") {
      const adminRes = await env.ASSETS.fetch(request);
      return withRobotsHeader(adminRes, "noindex, nofollow");
    }

    const isPlatformStoresPage = !isTenantContext && (url.pathname === "/stores" || url.pathname === "/stores/");

    // Serve base index.html for home, /stores, or storefront SPA deep paths (/category/:slug, /item/:slug)
    const shouldServeStorefrontShell =
      route.kind === "home" ||
      isPlatformStoresPage ||
      (isTenantContext && (route.kind === "category" || route.kind === "item"));

    const assetRequest =
      shouldServeStorefrontShell && (route.kind !== "home" || isPlatformStoresPage)
        ? new Request(new URL("/", url.origin), { method: request.method, headers: request.headers })
        : request;

    const assetResponse = await env.ASSETS.fetch(assetRequest);
    const contentType = assetResponse.headers.get("content-type") || "";

    if (
      request.method !== "GET" ||
      !shouldServeStorefrontShell ||
      !contentType.includes("text/html") ||
      typeof HTMLRewriter === "undefined"
    ) {
      return hostInfo.isPreviewHost ? withRobotsHeader(assetResponse, "noindex, nofollow") : assetResponse;
    }

    // 1. Platform Marketplace Home & Stores Directory SSR & SEO (store254.co.ke, store254.co.ke/stores)
    if (!isTenantContext && (route.kind === "home" || isPlatformStoresPage)) {
      try {
        const { data: stores } = await fetchCachedSeoJson<PlatformStoreSeo[]>(
          env.API,
          "/api/platform/seo-stores",
          "platform-stores",
          { "X-Forwarded-Host": url.host },
          clientIp,
          ctx,
          120
        );
        const seo = buildPlatformSeoData(stores || [], hostInfo.isPreviewHost);
        const pageTitle = isPlatformStoresPage ? "Active Kenyan Storefronts | Store254" : seo.title;
        const pageDescription = isPlatformStoresPage
          ? "Browse verified independent Kenyan online stores and demo storefronts across counties and towns on Store254."
          : seo.description;
        let rewriter = new HTMLRewriter()
          .on("title", {
            element(el) {
              el.setInnerContent(pageTitle);
            },
          })
          .on('meta[name="description"]', {
            element(el) {
              el.setAttribute("content", pageDescription);
            },
          })
          .on("head", {
            element(el) {
              el.append(seo.headTagsHtml, { html: true });
            },
          })
          .on("#platform-stores-grid", {
            element(el) {
              if (seo.ssrStoresHtml) {
                el.setInnerContent(seo.ssrStoresHtml, { html: true });
              }
            },
          });
        if (isPlatformStoresPage) {
          rewriter = rewriter.on("html", {
            element(el) {
              el.setAttribute("data-platform-view", "stores");
            },
          });
        }
        const transformed = rewriter.transform(assetResponse);

        return hostInfo.isPreviewHost ? withRobotsHeader(transformed, "noindex, nofollow") : transformed;
      } catch {
        return hostInfo.isPreviewHost ? withRobotsHeader(assetResponse, "noindex, nofollow") : assetResponse;
      }
    }

    // 2. Tenant Storefront / Category / Item Edge SSR & SEO (*.store254.co.ke or custom domain)
    try {
      const tenantHeaders: Record<string, string> = explicitStoreSlug
        ? { "X-Forwarded-Host": "api.internal", "X-Tenant-Slug": explicitStoreSlug }
        : { "X-Forwarded-Host": url.host };
      const cacheScope = explicitStoreSlug || hostInfo.hostname;

      const { data: storefrontPayload } = await fetchCachedSeoJson<SeoStorefrontPayload>(
        env.API,
        "/api/seo/storefront",
        cacheScope,
        tenantHeaders,
        clientIp,
        ctx,
        60
      );

      if (!storefrontPayload?.tenant) {
        const transformed = new HTMLRewriter()
          .on("#platform-hero, .platform-nav-links, #platform-mobile-menu", {
            element(el) {
              el.remove();
            },
          })
          .on("head", {
            element(el) {
              el.append('<meta name="robots" content="noindex, nofollow">', { html: true });
            },
          })
          .transform(assetResponse);
        return withRobotsHeader(transformed, "noindex, nofollow", 404);
      }

      let itemDetail: SeoItemDetailPayload | null = null;
      if (route.kind === "item") {
        const detailRes = await fetchCachedSeoJson<SeoItemDetailPayload>(
          env.API,
          `/api/seo/item/${encodeURIComponent(route.slug)}`,
          `${cacheScope}:item:${route.slug}`,
          tenantHeaders,
          clientIp,
          ctx,
          60
        );
        itemDetail = detailRes.data;
      }

      const canonicalOrigin = resolveTenantCanonicalOrigin(url, storefrontPayload.tenant);
      const seo = buildStorefrontSeoData({
        origin: canonicalOrigin,
        route,
        payload: storefrontPayload,
        itemDetail,
        isPreview: hostInfo.isPreviewHost,
      });

      const directoryHub = getDirectoryHubForBusinessType(storefrontPayload.tenant.businessType);
      const rewriter = new HTMLRewriter()
        .on("#platform-hero, .platform-nav-links, #platform-mobile-menu, #footer-about-link", {
          element(el) {
            el.remove();
          },
        })
        .on("#footer-powered-by", {
          element(el) {
            removeHiddenClass(el);
          },
        })
        .on("#footer-directory-link", {
          element(el) {
            removeHiddenClass(el);
            el.setAttribute("href", directoryHub.href);
            el.setInnerContent(directoryHub.label);
          },
        })
        .on("title", {
          element(el) {
            el.setInnerContent(seo.title);
          },
        })
        .on('meta[name="description"]', {
          element(el) {
            el.setAttribute("content", seo.description);
          },
        })
        .on("head", {
          element(el) {
            el.append(seo.headTagsHtml, { html: true });
          },
        })
        .on("#store-info-banner", {
          element(el) {
            removeHiddenClass(el);
          },
        })
        .on("#storefront-view", {
          element(el) {
            removeHiddenClass(el);
            if (seo.ssrItemDetailHtml) {
              el.prepend(seo.ssrItemDetailHtml, { html: true });
            }
          },
        })
        .on("#banner-store-subdomain", {
          element(el) {
            el.setInnerContent(seo.ssrStoreAddress);
          },
        })
        .on("#banner-store-name", {
          element(el) {
            if (seo.downgradeBannerHeading) {
              el.tagName = "p";
            }
            el.setInnerContent(seo.ssrStoreName);
          },
        })
        .on("#banner-store-tagline", {
          element(el) {
            if (seo.ssrStoreTagline) {
              removeHiddenClass(el);
              el.setInnerContent(seo.ssrStoreTagline);
            }
          },
        })
        .on("#banner-store-desc", {
          element(el) {
            el.setInnerContent(seo.ssrStoreDesc);
          },
        })
        .on("#category-pills", {
          element(el) {
            if (seo.ssrCategoryHtml) {
              el.setInnerContent(seo.ssrCategoryHtml, { html: true });
            }
          },
        })
        .on("#items-grid", {
          element(el) {
            if (seo.ssrItemsHtml) {
              el.setInnerContent(seo.ssrItemsHtml, { html: true });
            } else {
              el.setInnerContent(
                `<p class="col-span-full text-sm text-slate-500 py-8 text-center">Browse ${escapeHtml(storefrontPayload.tenant.name)} on Store254.</p>`,
                { html: true }
              );
            }
          },
        });

      const transformed = rewriter.transform(assetResponse);
      const needsNoIndex = hostInfo.isPreviewHost || seo.status >= 400 || seo.robots.startsWith("noindex");
      if (needsNoIndex) {
        const robotsHeader = hostInfo.isPreviewHost || seo.status >= 400 ? "noindex, nofollow" : seo.robots;
        return withRobotsHeader(transformed, robotsHeader, seo.status);
      }
      if (seo.status !== 200) {
        return new Response(transformed.body, {
          status: seo.status,
          statusText: transformed.statusText,
          headers: transformed.headers,
        });
      }
      return transformed;
    } catch {
      return hostInfo.isPreviewHost ? withRobotsHeader(assetResponse, "noindex, nofollow") : assetResponse;
    }
  },
};
