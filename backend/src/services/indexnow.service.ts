// IndexNow (https://www.indexnow.org): notify Bing (and other participating engines) as soon as storefront
// URLs are created, updated or removed. The ownership key file is served by the frontend Worker on every host
// at /<key>.txt (see frontend/src/worker.ts), so keyLocation is always on the same host as the submitted URLs.
export const INDEXNOW_KEY = "a284a0cb988332f295c2b21ab44ae220";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const PRIMARY_DOMAIN_FALLBACK = "store254.co.ke";

export interface IndexNowTenant {
  subdomain: string;
  customDomain?: string | null;
}

export function resolveIndexNowHost(tenant: IndexNowTenant, primaryDomain = PRIMARY_DOMAIN_FALLBACK): string {
  const custom = tenant.customDomain?.trim().toLowerCase();
  return custom ? custom : `${tenant.subdomain}.${primaryDomain}`;
}

export function buildStorefrontIndexNowUrls(
  tenant: IndexNowTenant,
  paths: Array<string | null | undefined>,
  primaryDomain = PRIMARY_DOMAIN_FALLBACK
): string[] {
  const host = resolveIndexNowHost(tenant, primaryDomain);
  const urls = new Set<string>();
  urls.add(`https://${host}/`);
  for (const path of paths) {
    if (!path) continue;
    urls.add(`https://${host}${path.startsWith("/") ? path : `/${path}`}`);
  }
  return [...urls];
}

export function itemPath(slug: string): string {
  return `/item/${encodeURIComponent(slug)}`;
}

export function categoryPath(slug: string): string {
  return `/category/${encodeURIComponent(slug)}`;
}

export async function submitToIndexNow(
  tenant: IndexNowTenant,
  urls: string[],
  options: { primaryDomain?: string; environment?: string; fetchImpl?: typeof fetch } = {}
): Promise<boolean> {
  if (options.environment && options.environment !== "production") return false;
  if (urls.length === 0) return false;
  const host = resolveIndexNowHost(tenant, options.primaryDomain);
  const body = {
    host,
    key: INDEXNOW_KEY,
    keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
    urlList: urls.slice(0, 10_000),
  };
  try {
    const res = await (options.fetchImpl ?? fetch)(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    return res.ok || res.status === 202;
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget IndexNow ping that never delays or fails the API response.
 * Safe to call where no ExecutionContext exists (e.g. unit tests).
 */
export function notifyIndexNow(
  c: { env?: { ENVIRONMENT?: string; PRIMARY_DOMAIN?: string }; executionCtx?: { waitUntil?: (p: Promise<unknown>) => void } },
  tenant: IndexNowTenant,
  paths: Array<string | null | undefined>
): void {
  try {
    const urls = buildStorefrontIndexNowUrls(tenant, paths, c.env?.PRIMARY_DOMAIN || PRIMARY_DOMAIN_FALLBACK);
    const task = submitToIndexNow(tenant, urls, {
      primaryDomain: c.env?.PRIMARY_DOMAIN || PRIMARY_DOMAIN_FALLBACK,
      environment: c.env?.ENVIRONMENT,
    });
    let ctx: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
    try {
      ctx = c.executionCtx;
    } catch {
      ctx = undefined;
    }
    ctx?.waitUntil?.(task);
  } catch {
    // IndexNow is best-effort; never break catalog writes.
  }
}
