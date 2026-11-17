import type { Context, MiddlewareHandler } from "hono";
import type { AppEnv } from "../types/context";
import { SECURITY_LIMITS } from "../config/constants";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export type RateLimitBindingName =
  | "API_RATE_LIMITER"
  | "AUTH_RATE_LIMITER"
  | "AUTH_STRICT_RATE_LIMITER"
  | "SENSITIVE_RATE_LIMITER";

// In-memory isolate cache for fast edge rate limiting
const memoryRateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically to avoid memory growth
let lastCleanup = Date.now();
function cleanupStaleRecords(): void {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;

  for (const [key, record] of memoryRateLimitMap.entries()) {
    if (record.resetAt <= now) {
      memoryRateLimitMap.delete(key);
    }
  }
}

export interface RateLimitOptions {
  max?: number;
  windowMs?: number;
  binding?: RateLimitBindingName;
  accountKeyFields?: string[];
  keyGenerator?: (c: Context<AppEnv>) => string;
}

export function selectRateLimiterBinding(
  env: AppEnv["Bindings"] | undefined,
  max: number,
  windowMs = SECURITY_LIMITS.DEFAULT_RATE_LIMIT_WINDOW_MS,
  explicitBinding?: RateLimitBindingName
): RateLimit | undefined {
  if (!env) return undefined;
  if (explicitBinding) return env[explicitBinding];

  // Native Cloudflare RateLimit simple bindings enforce fixed 60s windows.
  // Scale multi-minute windows down to their effective per-minute rate so
  // strict endpoints (e.g. 15 per 15m) map to AUTH_STRICT_RATE_LIMITER.
  const effectivePerMinute = windowMs > 60_000 ? max / (windowMs / 60_000) : max;
  if (max <= 5 || effectivePerMinute <= 5) return env.AUTH_STRICT_RATE_LIMITER;
  if (max <= 10 || effectivePerMinute <= 10) return env.AUTH_RATE_LIMITER;
  if (max <= 20 || effectivePerMinute <= 20) return env.SENSITIVE_RATE_LIMITER;
  return env.API_RATE_LIMITER;
}

function isAuthAccountRoute(method: string, normalizedPath: string): boolean {
  if (method !== "POST") return false;
  return (
    normalizedPath.endsWith("/login") ||
    normalizedPath.endsWith("/verify-email") ||
    normalizedPath.endsWith("/resend-verification") ||
    normalizedPath.endsWith("/forgot-password") ||
    normalizedPath.endsWith("/reset-password")
  );
}

async function extractAccountIdentifierHash(
  c: Context<AppEnv>,
  fields: string[]
): Promise<string | null> {
  const contentType = c.req.header("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  try {
    const parsed = (await c.req.raw.clone().json()) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    for (const field of fields) {
      const raw = parsed[field];
      if (typeof raw === "string") {
        const normalized = raw.trim().toLowerCase();
        if (normalized) {
          const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(normalized)
          );
          return Array.from(new Uint8Array(digest))
            .slice(0, 8)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

function consumeMemoryBucket(key: string, windowMs: number, now: number): RateLimitRecord {
  let record = memoryRateLimitMap.get(key);
  if (!record || record.resetAt <= now) {
    record = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryRateLimitMap.set(key, record);
  } else {
    record.count++;
  }
  return record;
}

/**
 * Enterprise Rate Limiting Middleware
 * Uses CF-Connecting-IP, tenant context, and per-account identifier keying on auth routes.
 */
export function rateLimiter(options: RateLimitOptions = {}): MiddlewareHandler<AppEnv> {
  const max = options.max ?? SECURITY_LIMITS.DEFAULT_RATE_LIMIT_MAX;
  const windowMs = options.windowMs ?? SECURITY_LIMITS.DEFAULT_RATE_LIMIT_WINDOW_MS;

  return async (c, next) => {
    cleanupStaleRecords();

    const isDev = c.env?.ENVIRONMENT === "development";
    const cfConnectingIp = c.req.header("cf-connecting-ip")?.trim();
    const clientIp =
      cfConnectingIp ||
      (isDev ? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() : undefined) ||
      (isDev ? "127.0.0.1" : "unknown-client");

    const customKey = options.keyGenerator ? options.keyGenerator(c) : "";
    const normalizedPath = c.req.routePath || c.req.path;
    const scopeSuffix = customKey ? `${normalizedPath}:${customKey}` : normalizedPath;
    const ipKey = `${clientIp}:${c.req.method}:${scopeSuffix}:${max}:${windowMs}`;

    const explicitAccountFields = options.accountKeyFields;
    const accountFields =
      explicitAccountFields ??
      (isAuthAccountRoute(c.req.method.toUpperCase(), normalizedPath)
        ? ["email", "username"]
        : undefined);
    const accountMax = explicitAccountFields ? max : Math.max(max * 2, 10);
    const accountHash =
      accountFields && accountFields.length > 0
        ? await extractAccountIdentifierHash(c, accountFields)
        : null;
    const tenantScope = c.get("tenant")?.id || c.req.header("x-tenant-slug") || "platform";
    const accountKey = accountHash
      ? `acct:${c.req.method}:${normalizedPath}:${tenantScope}:${accountHash}:${accountMax}:${windowMs}`
      : null;

    const distributedLimiter = selectRateLimiterBinding(
      c.env,
      max,
      windowMs,
      options.binding
    );
    if (distributedLimiter) {
      const ipOutcome = await distributedLimiter.limit({ key: ipKey });
      if (!ipOutcome.success) {
        c.header("Retry-After", "60");
        return c.json(
          {
            success: false,
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: "Too many requests. Please slow down and try again later.",
              retryAfterSeconds: 60,
            },
          },
          429
        );
      }
      if (accountKey) {
        const accountOutcome = await distributedLimiter.limit({ key: accountKey });
        if (!accountOutcome.success) {
          c.header("Retry-After", "60");
          return c.json(
            {
              success: false,
              error: {
                code: "RATE_LIMIT_EXCEEDED",
                message: "Too many attempts for this account. Please try again later.",
                retryAfterSeconds: 60,
              },
            },
            429
          );
        }
      }
    }

    const now = Date.now();
    const ipRecord = consumeMemoryBucket(ipKey, windowMs, now);
    const accountRecord = accountKey ? consumeMemoryBucket(accountKey, windowMs, now) : null;

    const ipExceeded = ipRecord.count > max;
    const accountExceeded = Boolean(accountRecord && accountRecord.count > accountMax);
    const effectiveResetAt =
      accountExceeded && accountRecord ? accountRecord.resetAt : ipRecord.resetAt;

    const remaining = Math.max(0, max - ipRecord.count);
    const resetSeconds = Math.max(1, Math.ceil((effectiveResetAt - now) / 1000));

    c.header("RateLimit-Limit", max.toString());
    c.header("RateLimit-Remaining", remaining.toString());
    c.header("RateLimit-Reset", resetSeconds.toString());

    if (ipExceeded || accountExceeded) {
      c.header("Retry-After", resetSeconds.toString());
      return c.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please slow down and try again later.",
            retryAfterSeconds: resetSeconds,
          },
        },
        429
      );
    }

    await next();
  };
}
