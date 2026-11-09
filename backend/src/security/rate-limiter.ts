import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types/context";
import { SECURITY_LIMITS } from "../config/constants";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

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
  keyGenerator?: (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => string;
}

function cloudflareLimiter(c: Parameters<MiddlewareHandler<AppEnv>>[0], max: number) {
  // Native Cloudflare counters are shared across Worker instances in a colo.
  // Keep the isolate-local counter as an additional per-isolate backstop.
  if (max <= 5) return c.env?.AUTH_STRICT_RATE_LIMITER;
  if (max <= 10) return c.env?.AUTH_RATE_LIMITER;
  if (max <= 20) return c.env?.SENSITIVE_RATE_LIMITER;
  return c.env?.API_RATE_LIMITER;
}

/**
 * Enterprise Rate Limiting Middleware
 * Uses CF-Connecting-IP and tenant context
 */
export function rateLimiter(options: RateLimitOptions = {}): MiddlewareHandler<AppEnv> {
  const max = options.max ?? SECURITY_LIMITS.DEFAULT_RATE_LIMIT_MAX;
  const windowMs = options.windowMs ?? SECURITY_LIMITS.DEFAULT_RATE_LIMIT_WINDOW_MS;

  return async (c, next) => {
    cleanupStaleRecords();

    // Determine client identifier (Cloudflare Connecting IP, fallback to x-forwarded-for)
    const clientIp =
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      "127.0.0.1";

    const customKey = options.keyGenerator ? options.keyGenerator(c) : "";
    const normalizedPath = c.req.routePath || c.req.path;
    const key = `${clientIp}:${c.req.method}:${customKey || normalizedPath}:${max}:${windowMs}`;

    const distributedLimiter = cloudflareLimiter(c, max);
    if (distributedLimiter) {
      const outcome = await distributedLimiter.limit({ key });
      if (!outcome.success) {
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
    }

    const now = Date.now();
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

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    c.header("RateLimit-Limit", max.toString());
    c.header("RateLimit-Remaining", remaining.toString());
    c.header("RateLimit-Reset", resetSeconds.toString());

    if (record.count > max) {
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
