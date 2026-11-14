import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { AppError } from "../../security/error-handler";
import {
  searchMarketplaceWithRipple,
  suggestMarketplaceTerms,
} from "./search.service";

export const searchRouter = new Hono<AppEnv>();

const optionalNum = z.preprocess((val) => {
  if (val === undefined || val === null || val === "") return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());

const optionalInt = z.preprocess((val) => {
  if (val === undefined || val === null || val === "") return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.number().int().optional());

const productSearchQuerySchema = z.object({
  q: z.string().max(160).optional(),
  locationId: z.string().max(100).optional(),
  countyId: z.string().max(64).optional(),
  lat: optionalNum,
  lng: optionalNum,
  itemType: z.enum(["PHYSICAL", "SERVICE", "DIGITAL"]).optional(),
  minPrice: optionalInt,
  maxPrice: optionalInt,
  inStockOnly: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
  sort: z
    .enum(["smart", "nearest", "relevance", "price_asc", "price_desc"])
    .optional()
    .default("smart"),
  minResults: optionalInt,
  expand: z.enum(["auto", "full"]).optional().default("auto"),
  limit: optionalInt,
});

/**
 * GET /api/platform/search/products
 * Progressive ripple geospatial search + international FTS5/synonym/fuzzy ranking.
 */
searchRouter.get(
  "/products",
  zValidator("query", productSearchQuerySchema),
  async (c) => {
    if (!c.env?.DB) {
      throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
    }

    const q = c.req.valid("query");
    const db = createDb(c.env.DB);
    const data = await searchMarketplaceWithRipple(db, q);
    return c.json({ success: true, ...data });
  }
);

/**
 * GET /api/platform/search/suggest?q=...
 * Fast live autocomplete suggestions across published marketplace items and stores.
 */
searchRouter.get("/suggest", async (c) => {
  if (!c.env?.DB) {
    throw new AppError("Database binding not initialized.", 500, "DB_NOT_INITIALIZED");
  }

  const q = c.req.query("q") || "";
  const rawLimit = Number(c.req.query("limit") || 8);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 15) : 8;
  const db = createDb(c.env.DB);

  const data = await suggestMarketplaceTerms(db, q, limit);
  return c.json({ success: true, ...data });
});
