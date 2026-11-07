import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types/context";
import { generateUUID } from "../security/crypto";

/**
 * Assigns or propagates a unique correlation ID for every request
 */
export function requestIdMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incomingId = c.req.header("x-request-id");
    // Validate incoming ID format or generate a fresh UUID v4
    const requestId =
      incomingId && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingId) ? incomingId : generateUUID();

    c.set("requestId", requestId);
    c.header("X-Request-ID", requestId);

    await next();
  };
}
