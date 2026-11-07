import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { promotions } from "../../db/schema/offers";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { generateUUID } from "../../security/crypto";
import { AppError } from "../../security/error-handler";

export const offersRouter = new Hono<AppEnv>();

const createPromotionSchema = z.object({
  title: z.string().min(2).max(120),
  code: z.string().max(30).optional(), // Coupon code (e.g. "WELCOME10"), optional
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]).default("PERCENTAGE"),
  discountValue: z.number().int().positive(),
  minOrderAmount: z.number().int().min(0).default(0),
  maxDiscountAmount: z.number().int().positive().optional(),
  appliesTo: z.enum(["ALL", "SPECIFIC_CATEGORIES", "SPECIFIC_ITEMS"]).default("ALL"),
  targetIds: z.array(z.string()).default([]),
  usageLimit: z.number().int().positive().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
});

const validateCouponSchema = z.object({
  code: z.string().min(1),
  orderAmount: z.number().int().positive(),
  itemIds: z.array(z.string()).default([]),
});

// List Active Promotions for Storefront
offersRouter.get("/", async (c) => {
  const tenant = c.get("tenant")!;
  const db = createDb(c.env.DB);
  const now = new Date();

  const list = await db
    .select({
      id: promotions.id,
      title: promotions.title,
      code: promotions.code,
      discountType: promotions.discountType,
      discountValue: promotions.discountValue,
      minOrderAmount: promotions.minOrderAmount,
      maxDiscountAmount: promotions.maxDiscountAmount,
      appliesTo: promotions.appliesTo,
      startsAt: promotions.startsAt,
      endsAt: promotions.endsAt,
    })
    .from(promotions)
    .where(and(eq(promotions.tenantId, tenant.id), eq(promotions.isActive, true)));

  // Filter current active date range
  const activeOffers = list.filter((p) => {
    if (p.startsAt > now) return false;
    if (p.endsAt && p.endsAt < now) return false;
    return true;
  });

  return c.json({
    success: true,
    data: activeOffers,
  });
});

// Validate Coupon Code & Calculate Discount
offersRouter.post("/validate-coupon", zValidator("json", validateCouponSchema), async (c) => {
  const tenant = c.get("tenant")!;
  const { code, orderAmount } = c.req.valid("json");
  const normalizedCode = code.trim().toUpperCase();
  const db = createDb(c.env.DB);
  const now = new Date();

  const [promo] = await db
    .select()
    .from(promotions)
    .where(and(eq(promotions.tenantId, tenant.id), eq(promotions.code, normalizedCode)))
    .limit(1);

  if (!promo || !promo.isActive) {
    throw new AppError("Invalid or inactive coupon code.", 404, "COUPON_NOT_FOUND");
  }

  if (promo.startsAt > now) {
    throw new AppError("This promotion has not started yet.", 400, "PROMOTION_NOT_STARTED");
  }

  if (promo.endsAt && promo.endsAt < now) {
    throw new AppError("This coupon code has expired.", 400, "COUPON_EXPIRED");
  }

  if (promo.usageLimit && promo.usageCount >= promo.usageLimit) {
    throw new AppError("This coupon code has reached its maximum usage limit.", 400, "USAGE_LIMIT_REACHED");
  }

  if (orderAmount < promo.minOrderAmount) {
    throw new AppError(
      `Minimum order amount of ${promo.minOrderAmount} ${tenant.currency || "KES"} required to apply this coupon.`,
      400,
      "MIN_AMOUNT_NOT_MET"
    );
  }

  // Calculate discount
  let discountAmount = 0;
  if (promo.discountType === "PERCENTAGE") {
    discountAmount = Math.round((orderAmount * promo.discountValue) / 100);
    if (promo.maxDiscountAmount && discountAmount > promo.maxDiscountAmount) {
      discountAmount = promo.maxDiscountAmount;
    }
  } else if (promo.discountType === "FIXED_AMOUNT") {
    discountAmount = Math.min(orderAmount, promo.discountValue);
  }

  const finalAmount = Math.max(0, orderAmount - discountAmount);

  return c.json({
    success: true,
    data: {
      couponCode: promo.code,
      title: promo.title,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      originalAmount: orderAmount,
      discountAmount,
      finalAmount,
    },
  });
});

// Create Promotion / Offer (Owners & Admins only)
offersRouter.post(
  "/",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", createPromotionSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    const code = body.code ? body.code.trim().toUpperCase() : null;

    if (code) {
      const [existing] = await db
        .select({ id: promotions.id })
        .from(promotions)
        .where(and(eq(promotions.tenantId, tenant.id), eq(promotions.code, code)))
        .limit(1);

      if (existing) {
        throw new AppError(`Coupon code "${code}" already exists for this store.`, 409, "COUPON_EXISTS");
      }
    }

    const promotionId = generateUUID();

    await db.insert(promotions).values({
      id: promotionId,
      tenantId: tenant.id,
      title: body.title,
      code,
      discountType: body.discountType,
      discountValue: body.discountValue,
      minOrderAmount: body.minOrderAmount,
      maxDiscountAmount: body.maxDiscountAmount || null,
      appliesTo: body.appliesTo,
      targetIds: body.targetIds,
      usageLimit: body.usageLimit || null,
      usageCount: 0,
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      isActive: true,
    });

    const [created] = await db
      .select()
      .from(promotions)
      .where(eq(promotions.id, promotionId))
      .limit(1);

    return c.json(
      {
        success: true,
        message: "Promotion offer created successfully.",
        data: created,
      },
      201
    );
  }
);
