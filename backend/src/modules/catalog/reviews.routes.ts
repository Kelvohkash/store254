import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, desc, inArray, or, sql } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { reviews } from "../../db/schema/reviews";
import { items } from "../../db/schema/items";
import { orders, orderItems } from "../../db/schema/orders";
import { users } from "../../db/schema/users";
import { authMiddleware, requirePermission } from "../../middlewares/auth.middleware";
import { generateUUID } from "../../security/crypto";
import { AppError } from "../../security/error-handler";
import { rateLimiter } from "../../security/rate-limiter";

export const reviewsRouter = new Hono<AppEnv>();

const createReviewSchema = z.object({
  customerName: z.string().min(2, "Name must be at least 2 characters").max(80),
  customerEmail: z.string().email().optional(),
  orderNumber: z.string().max(40).optional(),
  rating: z.number().int().min(1, "Rating must be between 1 and 5").max(5),
  comment: z.string().max(1000, "Review comment cannot exceed 1000 characters").optional(),
});

// GET /api/items/:itemId/reviews
reviewsRouter.get("/:itemId/reviews", async (c) => {
  const tenant = c.get("tenant")!;
  const itemId = c.req.param("itemId");

  if (!c.env?.DB) throw new AppError("Database not ready", 500);
  const db = createDb(c.env.DB);

  // Verify item exists in this store
  const [item] = await db
    .select({ id: items.id, title: items.title })
    .from(items)
    .where(and(eq(items.tenantId, tenant.id), eq(items.id, itemId)))
    .limit(1);

  if (!item) {
    throw new AppError("Item not found.", 404, "ITEM_NOT_FOUND");
  }

  // Fetch reviews
  const reviewList = await db
    .select({
      id: reviews.id,
      customerName: reviews.customerName,
      rating: reviews.rating,
      comment: reviews.comment,
      isVerifiedBuyer: reviews.isVerifiedBuyer,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.tenantId, tenant.id), eq(reviews.itemId, itemId)))
    .orderBy(desc(reviews.createdAt));

  const totalReviews = reviewList.length;
  const avgRating =
    totalReviews > 0
      ? Number((reviewList.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
      : 5.0;

  const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviewList.forEach((r) => {
    if (ratingCounts[r.rating] !== undefined) {
      ratingCounts[r.rating]++;
    }
  });

  return c.json({
    success: true,
    data: {
      item: { id: item.id, title: item.title },
      averageRating: avgRating,
      totalReviews,
      ratingDistribution: ratingCounts,
      reviews: reviewList,
    },
  });
});

// POST /api/items/:itemId/reviews
reviewsRouter.post(
  "/:itemId/reviews",
  rateLimiter({ max: 5, windowMs: 60 * 1000 }),
  authMiddleware(false), // Optional customer auth
  zValidator("json", createReviewSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const user = c.get("user");
    const itemId = c.req.param("itemId");
    const { customerName, rating, comment } = c.req.valid("json");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    // Verify item exists
    const [item] = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.tenantId, tenant.id), eq(items.id, itemId)))
      .limit(1);

    if (!item) {
      throw new AppError("Item not found.", 404, "ITEM_NOT_FOUND");
    }

    // Only authenticated callers with a verified email and a PAID/COMPLETED order
    // matching their user ID or verified email can earn isVerifiedBuyer = true.
    let isVerified = false;
    if (user?.id) {
      const [verifiedUser] = await db
        .select({
          id: users.id,
          email: users.email,
          emailVerifiedAt: users.emailVerifiedAt,
          status: users.status,
        })
        .from(users)
        .where(and(eq(users.id, user.id), eq(users.tenantId, tenant.id)))
        .limit(1);

      if (verifiedUser && verifiedUser.emailVerifiedAt != null && verifiedUser.status === "ACTIVE") {
        const normalizedVerifiedEmail = verifiedUser.email.trim().toLowerCase();
        const pastOrders = await db
          .select({ id: orders.id })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .where(
            and(
              eq(orders.tenantId, tenant.id),
              eq(orderItems.itemId, itemId),
              inArray(orders.status, ["COMPLETED", "PAID"]),
              or(
                eq(orders.customerId, verifiedUser.id),
                sql`lower(${orders.customerEmail}) = ${normalizedVerifiedEmail}`
              )
            )
          )
          .limit(1);

        if (pastOrders.length > 0) {
          isVerified = true;
        }
      }
    }

    const reviewId = generateUUID();
    const newReview = {
      id: reviewId,
      tenantId: tenant.id,
      itemId,
      customerId: user?.id || null,
      customerName: user?.email ? (customerName || user.email.split("@")[0]) : customerName,
      rating,
      comment: comment?.trim() || null,
      isVerifiedBuyer: isVerified,
    };

    await db.insert(reviews).values(newReview);

    // Do not expose isVerifiedBuyer in responses to unauthenticated callers (prevents oracle)
    const responseData = user?.id
      ? newReview
      : {
          id: newReview.id,
          tenantId: newReview.tenantId,
          itemId: newReview.itemId,
          customerId: null,
          customerName: newReview.customerName,
          rating: newReview.rating,
          comment: newReview.comment,
        };

    return c.json(
      {
        success: true,
        message: "Review submitted successfully! Thank you for your feedback.",
        data: responseData,
      },
      201
    );
  }
);

// DELETE /api/items/:itemId/reviews/:reviewId (Merchant Moderation)
reviewsRouter.delete(
  "/:itemId/reviews/:reviewId",
  authMiddleware(true),
  requirePermission("manage_products", "manage_orders"),
  async (c) => {
    const tenant = c.get("tenant")!;
    const itemId = c.req.param("itemId");
    const reviewId = c.req.param("reviewId");

    if (!c.env?.DB) throw new AppError("Database not ready", 500);
    const db = createDb(c.env.DB);

    await db
      .delete(reviews)
      .where(
        and(
          eq(reviews.id, reviewId),
          eq(reviews.itemId, itemId),
          eq(reviews.tenantId, tenant.id)
        )
      );

    return c.json({
      success: true,
      message: "Review removed.",
    });
  }
);
