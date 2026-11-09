interface Env {
  ASSETS: Fetcher;
  API: Fetcher;
}

function isPlatformRootHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "store254.co.ke" ||
    host === "www.store254.co.ke" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".workers.dev") ||
    host.endsWith(".pages.dev")
  );
}

function escapeAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const apiUrl = new URL(`${url.pathname}${url.search}`, "https://api.internal");
      const headers = new Headers(request.headers);
      headers.set("X-Forwarded-Host", url.host);

      return env.API.fetch(
        new Request(apiUrl, {
          method: request.method,
          headers,
          body: request.body,
          redirect: "manual",
        })
      );
    }

    const assetResponse = await env.ASSETS.fetch(request);

    // Inject dynamic Store SEO & OpenGraph tags at the Edge for tenant storefronts
    const contentType = assetResponse.headers.get("content-type") || "";
    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/index.html") &&
      contentType.includes("text/html") &&
      !isPlatformRootHost(url.hostname) &&
      typeof HTMLRewriter !== "undefined"
    ) {
      try {
        const storeRes = await env.API.fetch(
          new Request("https://api.internal/api/store", {
            headers: { "X-Forwarded-Host": url.host },
          })
        );
        if (storeRes.ok) {
          const payload = (await storeRes.json()) as {
            success?: boolean;
            data?: {
              name?: string;
              settings?: {
                tagline?: string;
                description?: string;
                bannerUrl?: string;
                logoUrl?: string;
              };
            };
          };
          const store = payload?.data;
          if (store?.name) {
            const title = `${store.name} | Shop Online on Store254`;
            const description =
              store.settings?.tagline ||
              store.settings?.description ||
              `Shop directly from ${store.name} on Store254 with instant M-Pesa checkout.`;
            const rawImage = store.settings?.bannerUrl || store.settings?.logoUrl || "";
            const ogImage = rawImage.startsWith("/")
              ? `${url.origin}${rawImage}`
              : rawImage;

            return new HTMLRewriter()
              .on("title", {
                element(el) {
                  el.setInnerContent(title);
                },
              })
              .on('meta[name="description"]', {
                element(el) {
                  el.setAttribute("content", description);
                },
              })
              .on("head", {
                element(el) {
                  el.append(
                    `<meta property="og:type" content="website">` +
                      `<meta property="og:title" content="${escapeAttr(title)}">` +
                      `<meta property="og:description" content="${escapeAttr(description)}">` +
                      `<meta property="og:url" content="${escapeAttr(url.origin)}">` +
                      (ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}">` : ""),
                    { html: true }
                  );
                },
              })
              .transform(assetResponse);
          }
        }
      } catch {
        // Fall through to unmodified assetResponse if metadata lookup fails
      }
    }

    return assetResponse;
  },
};
