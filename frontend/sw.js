const CACHE_VERSION = "store254-pwa-v20";
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [
  "/",
  "/stores",
  "/offline.html",
  "/manifest.webmanifest",
  "/styles/tailwind.generated.css",
  "/styles/tailwind.generated.css?v=20261116",
  "/styles/base.css",
  "/styles/base.css?v=20261116",
  "/styles/base/tokens-reset.css",
  "/styles/base/header-nav.css",
  "/styles/base/hero-banner.css",
  "/styles/base/cards-catalog.css",
  "/styles/base/drawers-modals.css",
  "/styles/storefront-components.css",
  "/styles/storefront-components.css?v=20261116d",
  "/styles/components/tokens-variants.css",
  "/styles/components/archetypes-hero.css",
  "/styles/components/cards-interactions.css",
  "/styles/storefront-default.css",
  "/styles/storefront-default.css?v=20261116",
  "/styles/storefront-quality.css",
  "/styles/storefront-quality.css?v=20261116",
  "/styles/platform-home.css",
  "/styles/platform-home.css?v=20261115c",
  "/styles/ui-polish.css",
  "/styles/ui-polish.css?v=20261116",
  "/assets/store254Logo.webp",
  "/assets/store254Icon.webp",
  "/assets/pwa-icon-192.png",
  "/assets/pwa-icon-512.png",
  "/assets/apple-touch-icon.png",
  "/scripts/shared/item-artwork-classifier.js?v=20261116f"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch {
            // Keep install resilient if an asset is temporarily unavailable.
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isBypassPath(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/sitemap") ||
    pathname === "/robots.txt" ||
    pathname === "/sw.js"
  );
}

function isStaticAssetPath(pathname) {
  return (
    pathname.startsWith("/styles/") ||
    pathname.startsWith("/scripts/") ||
    pathname.startsWith("/assets/") ||
    pathname === "/manifest.webmanifest"
  );
}

function isProtectedAdminPath(pathname) {
  return pathname.startsWith("/admin") || pathname.startsWith("/super-admin");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBypassPath(url.pathname) || url.searchParams.has("_customer_login")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && !isProtectedAdminPath(url.pathname)) {
            const cache = await caches.open(CACHE_VERSION);
            cache.put(request, networkResponse.clone()).catch(() => {});
          }
          return networkResponse;
        } catch {
          const offlineFallback = await caches.match(OFFLINE_URL);
          if (offlineFallback) return offlineFallback;
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          if (!isProtectedAdminPath(url.pathname)) {
            const cachedShell = await caches.match("/");
            if (cachedShell) return cachedShell;
          }
          return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
        }
      })()
    );
    return;
  }

  if (isStaticAssetPath(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkFetch);
          return cached;
        }

        const fresh = await networkFetch;
        return fresh || new Response("", { status: 504 });
      })
    );
  }
});
