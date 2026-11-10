// API Configuration
const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.endsWith(".localhost")
    ? "http://localhost:8787"
    : "";
const DEFAULT_STORE_LOGO = "./assets/Store254_Digital_Marketplace_Logo_transparent.png";

// Helper API Fetcher with legacy tenant hint (server resolves tenant from Host only)
async function apiFetch(endpoint, options = {}) {
  const { asMerchant, ...requestOptions } = options;
  const headers = {
    "Content-Type": "application/json",
    ...(requestOptions.headers || {}),
  };

  // Inject tenant scope header if targeting an active store (custom domains resolve via Host header)
  if (
    state.activeTenantSlug &&
    state.activeTenantSlug !== "__custom_domain__" &&
    !endpoint.startsWith("/api/platform")
  ) {
    headers["X-Tenant-Slug"] = state.activeTenantSlug;
  }

  // Inject auth token if available
  if (endpoint.startsWith("/api/platform")) {
    // Platform admin sessions are carried by the HttpOnly cookie.
  } else if (asMerchant && state.merchantToken) {
    headers["Authorization"] = `Bearer ${state.merchantToken}`;
  } else if (state.customerToken) {
    headers["Authorization"] = `Bearer ${state.customerToken}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...requestOptions,
      credentials: "include", // Super Admin session cookie is issued by the API subdomain.
      headers,
    });
    let data;
    const responseType = res.headers.get("content-type") || "";
    if (responseType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = {
          success: false,
          error: { message: `The API returned an unreadable response (${res.status}).` },
        };
      }
    } else {
      const responseText = await res.text();
      data = {
        success: false,
        error: {
          message: responseText || `The API returned an empty response (${res.status}).`,
        },
      };
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { ok: false, status: 0, data: { success: false, error: { message: "Request aborted" } } };
    }
    console.error(`[API Error] ${endpoint}:`, err);
    return { ok: false, status: 0, data: { success: false, error: { message: "Network connection failed" } } };
  }
}
