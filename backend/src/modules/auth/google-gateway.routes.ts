import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { tenants } from "../../db/schema/tenants";
import { AppError } from "../../security/error-handler";
import { generateSecureToken, timingSafeEqual } from "../../security/crypto";
import { verifyGoogleIdToken } from "../../security/google-auth";
import { requireSecret } from "../../security/secrets";
import { customerSessionCookie } from "../../security/session-cookie";
import { resolveGoogleCustomerForTenant } from "../../services/google-customer-auth.service";
import { createCustomerSsoToken } from "../../security/jwt";
import { rateLimiter } from "../../security/rate-limiter";
import { sanitizeSubdomain } from "../../security/sanitize";

const STATE_COOKIE = "__Secure-store254_google_oauth";
const OAUTH_FLOW_TTL_SECONDS = 10 * 60;
const CUSTOMER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

interface OAuthFlow {
  state: string;
  nonce: string;
  codeVerifier: string;
  tenantSlug: string;
  returnTo: string;
  expiresAt: number;
}

export const googleGatewayRouter = new Hono<AppEnv>();

function googleCredentials(c: Context<AppEnv>) {
  const clientId = c.env?.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = c.env?.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (
    !clientId ||
    !clientSecret ||
    /^(your_|replace_|placeholder)/i.test(clientId) ||
    /^(your_|replace_|placeholder)/i.test(clientSecret)
  ) {
    throw new AppError("Google OAuth credentials have not been configured.", 503, "GOOGLE_AUTH_NOT_CONFIGURED");
  }
  return { clientId, clientSecret };
}

function getPrimaryDomain(c: Context<AppEnv>): string {
  const domain = (c.env?.PRIMARY_DOMAIN || "store254.co.ke").trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new AppError("The platform primary domain is invalid.", 500, "INVALID_PRIMARY_DOMAIN");
  }
  return domain;
}

function getRedirectUri(c: Context<AppEnv>): string {
  const domain = getPrimaryDomain(c);
  const expected = `https://${domain}/auth/google/callback`;
  const configured = c.env?.GOOGLE_REDIRECT_URI?.trim();
  if (configured && configured !== expected) {
    throw new AppError("GOOGLE_REDIRECT_URI must match the central callback URL.", 500, "INVALID_GOOGLE_REDIRECT_URI");
  }
  return expected;
}

export const PLATFORM_ROOT_RETURN_SLUG = "__platform__";

export function parseTenantReturnTo(value: string | undefined, primaryDomain: string): { url: URL; tenantSlug: string } | null {
  if (!value || value.length > 1800) return null;
  try {
    const url = new URL(value);
    const normalizedDomain = primaryDomain.toLowerCase();
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    if (hostname === normalizedDomain || hostname === `www.${normalizedDomain}`) {
      return { url, tenantSlug: PLATFORM_ROOT_RETURN_SLUG };
    }

    const suffix = `.${normalizedDomain}`;
    if (!hostname.endsWith(suffix)) {
      return null;
    }

    const tenantSlug = sanitizeSubdomain(hostname.slice(0, -suffix.length));
    if (!tenantSlug) return null;

    return { url, tenantSlug };
  } catch {
    return null;
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function flowEncryptionKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`store254-google-oauth-flow-v1:${secret}`)
  );
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function sealFlow(flow: OAuthFlow, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(STATE_COOKIE) },
    await flowEncryptionKey(secret),
    new TextEncoder().encode(JSON.stringify(flow))
  );
  return `${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(encrypted))}`;
}

async function openFlow(value: string, secret: string): Promise<OAuthFlow | null> {
  try {
    const [ivValue, encryptedValue, ...extra] = value.split(".");
    if (!ivValue || !encryptedValue || extra.length) return null;
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: decodeBase64Url(ivValue),
        additionalData: new TextEncoder().encode(STATE_COOKIE),
      },
      await flowEncryptionKey(secret),
      decodeBase64Url(encryptedValue)
    );
    const flow = JSON.parse(new TextDecoder().decode(decrypted)) as OAuthFlow;
    if (
      typeof flow.state !== "string" ||
      typeof flow.nonce !== "string" ||
      typeof flow.codeVerifier !== "string" ||
      typeof flow.tenantSlug !== "string" ||
      typeof flow.returnTo !== "string" ||
      !Number.isInteger(flow.expiresAt) ||
      flow.expiresAt < Date.now()
    ) {
      return null;
    }
    return flow;
  } catch {
    return null;
  }
}

function stateCookie(value: string, maxAge: number): string {
  return `${STATE_COOKIE}=${value}; Path=/auth/google; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearStateCookie(): string {
  return stateCookie("", 0);
}

function appendLoginResult(returnTo: string, result: "success" | "error"): string {
  const url = new URL(returnTo);
  url.searchParams.set("_customer_login", result);
  return url.toString();
}

googleGatewayRouter.get(
  "/login",
  rateLimiter({ max: 20, windowMs: 60 * 1000 }),
  async (c) => {
    const { clientId } = googleCredentials(c);
    const redirectUri = getRedirectUri(c);
    const primaryDomain = getPrimaryDomain(c);
    const returnTarget = parseTenantReturnTo(c.req.query("return_to"), primaryDomain);
    if (!returnTarget) {
      throw new AppError("Sign in must be started from Store254.", 400, "INVALID_OAUTH_RETURN_URL");
    }

    let resolvedTenantSlug = returnTarget.tenantSlug;
    if (returnTarget.tenantSlug !== PLATFORM_ROOT_RETURN_SLUG) {
      if (!c.env?.DB) throw new AppError("Database not ready.", 500, "DB_NOT_INITIALIZED");

      const db = createDb(c.env.DB);
      const [tenant] = await db
        .select({ subdomain: tenants.subdomain, status: tenants.status })
        .from(tenants)
        .where(eq(tenants.subdomain, returnTarget.tenantSlug))
        .limit(1);
      if (!tenant || tenant.status !== "ACTIVE") {
        throw new AppError("This storefront is not available for customer sign-in.", 403, "STORE_NOT_ACTIVE");
      }
      resolvedTenantSlug = tenant.subdomain;
    }

    const jwtSecret = requireSecret(c.env?.JWT_SECRET, "JWT_SECRET");
    const state = generateSecureToken(32);
    const nonce = generateSecureToken(32);
    const codeVerifier = generateSecureToken(48);
    const challenge = encodeBase64Url(
      new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)))
    );
    const returnTo = returnTarget.url.toString();
    const flow: OAuthFlow = {
      state,
      nonce,
      codeVerifier,
      tenantSlug: resolvedTenantSlug,
      returnTo,
      expiresAt: Date.now() + OAUTH_FLOW_TTL_SECONDS * 1000,
    };

    const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();

    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Set-Cookie", stateCookie(await sealFlow(flow, jwtSecret), OAUTH_FLOW_TTL_SECONDS));
    return c.redirect(authorizationUrl.toString(), 302);
  }
);

googleGatewayRouter.get(
  "/callback",
  rateLimiter({ max: 20, windowMs: 60 * 1000 }),
  async (c) => {
    const primaryDomain = getPrimaryDomain(c);
    const stateCookieValue = c.req.header("cookie")?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${STATE_COOKIE}=`))
      ?.slice(STATE_COOKIE.length + 1);
    const jwtSecret = requireSecret(c.env?.JWT_SECRET, "JWT_SECRET");
    const flow = stateCookieValue ? await openFlow(stateCookieValue, jwtSecret) : null;

    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Set-Cookie", clearStateCookie());

    const returnedState = c.req.query("state") || "";
    if (!flow || !timingSafeEqual(returnedState, flow.state)) {
      throw new AppError("Google sign-in expired or could not be verified. Please try again.", 400, "INVALID_OAUTH_STATE");
    }

    if (c.req.query("error")) {
      return c.redirect(appendLoginResult(flow.returnTo, "error"), 302);
    }
    const code = c.req.query("code");
    if (!code) throw new AppError("Google did not return an authorization code.", 400, "MISSING_OAUTH_CODE");

    const { clientId, clientSecret } = googleCredentials(c);
    const redirectUri = getRedirectUri(c);
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: flow.codeVerifier,
      }),
    });
    const tokenData = await tokenResponse.json() as { id_token?: string };
    if (!tokenResponse.ok || !tokenData.id_token) {
      throw new AppError("Google could not complete sign-in. Please try again.", 502, "GOOGLE_TOKEN_EXCHANGE_FAILED");
    }

    const googleUser = await verifyGoogleIdToken(tokenData.id_token, clientId, flow.nonce);
    if (flow.tenantSlug !== PLATFORM_ROOT_RETURN_SLUG) {
      if (!c.env?.DB) throw new AppError("Database not ready.", 500, "DB_NOT_INITIALIZED");
      const db = createDb(c.env.DB);
      const [tenant] = await db
        .select({ id: tenants.id, status: tenants.status })
        .from(tenants)
        .where(eq(tenants.subdomain, flow.tenantSlug))
        .limit(1);
      if (!tenant || tenant.status !== "ACTIVE") {
        throw new AppError("This storefront is no longer available for customer sign-in.", 403, "STORE_NOT_ACTIVE");
      }

      await resolveGoogleCustomerForTenant(db, tenant, googleUser);
    }
    const ssoToken = await createCustomerSsoToken(googleUser, jwtSecret, CUSTOMER_SESSION_TTL_SECONDS);

    c.header(
      "Set-Cookie",
      customerSessionCookie(ssoToken, primaryDomain, CUSTOMER_SESSION_TTL_SECONDS),
      { append: true }
    );
    return c.redirect(appendLoginResult(flow.returnTo, "success"), 302);
  }
);
