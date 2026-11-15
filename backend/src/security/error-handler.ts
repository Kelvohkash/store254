import type { ErrorHandler, NotFoundHandler } from "hono";
import type { AppEnv } from "../types/context";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Global Enterprise Error Handler
 * Ensures no sensitive database stack traces or internal secrets leak to the client
 */
export const globalErrorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get("requestId") || "unknown";
  const isDev = c.env?.ENVIRONMENT === "development";

  // Handled application errors
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
        requestId,
      },
      err.statusCode as any
    );
  }

  // Surface Cloudflare D1 free-tier quota limits clearly instead of opaque 500s
  const errMsg = `${err instanceof Error ? err.message : String(err ?? "")} ${(err as { cause?: { message?: string } })?.cause?.message ?? ""}`;
  if (/exceeded D1's free tier|daily row (?:read|write) limit/i.test(errMsg)) {
    console.warn(`[D1 QUOTA EXCEEDED] [Request: ${requestId}]`, errMsg.trim());
    return c.json(
      {
        success: false,
        error: {
          code: "D1_QUOTA_EXCEEDED",
          message:
            "Cloudflare D1 free-tier daily limit has been reached (resets at 00:00 UTC). Upgrade the D1 plan or retry after reset.",
        },
        requestId,
      },
      503
    );
  }

  // Unhandled internal server error
  console.error(`[CRITICAL ERROR] [Request: ${requestId}]`, err);

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: isDev ? err.message : "An unexpected internal error occurred. Please contact support.",
        stack: isDev ? err.stack : undefined,
      },
      requestId,
    },
    500
  );
};

/**
 * 404 Not Found Handler
 */
export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => {
  const requestId = c.get("requestId") || "unknown";
  return c.json(
    {
      success: false,
      error: {
        code: "RESOURCE_NOT_FOUND",
        message: `The requested endpoint ${c.req.method} ${c.req.path} does not exist.`,
      },
      requestId,
    },
    404
  );
};
