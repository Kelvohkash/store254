import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, asc } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { attributeDefinitions } from "../../db/schema/attributes";
import { categories } from "../../db/schema/categories";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { generateUUID } from "../../security/crypto";
import { slugify } from "../../security/sanitize";
import { AppError } from "../../security/error-handler";

export const attributesRouter = new Hono<AppEnv>();

const createAttributeSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(), // Nullable: global attribute
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  type: z.enum(["TEXT", "NUMBER", "SELECT", "MULTISELECT", "BOOLEAN", "RANGE"]).default("TEXT"),
  options: z.array(z.string()).default([]), // For SELECT/MULTISELECT types, e.g. ["Samsung", "Sony", "LG"]
  unit: z.string().max(20).optional(), // e.g. "inches", "GB", "hours", "kg"
  isFilterable: z.boolean().default(true),
  isRequired: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
});

// List attributes (supports category filter)
attributesRouter.get("/", async (c) => {
  const tenant = c.get("tenant")!;
  const categoryId = c.req.query("categoryId");
  const db = createDb(c.env.DB);

  let query = db
    .select()
    .from(attributeDefinitions)
    .where(eq(attributeDefinitions.tenantId, tenant.id))
    .orderBy(asc(attributeDefinitions.displayOrder), asc(attributeDefinitions.name));

  const list = await query;

  // Filter attributes for this category: return both global (null categoryId) and category-specific
  const filtered = categoryId
    ? list.filter((attr) => !attr.categoryId || attr.categoryId === categoryId)
    : list;

  return c.json({
    success: true,
    data: filtered,
  });
});

// Create Dynamic Attribute (Owners & Admins only)
attributesRouter.post(
  "/",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", createAttributeSchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    const normalizedCode = slugify(body.code).replace(/-/g, "_");

    // If categoryId is specified, check that it exists
    if (body.categoryId) {
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, body.categoryId), eq(categories.tenantId, tenant.id)))
        .limit(1);

      if (!category) {
        throw new AppError("Specified category does not exist.", 404, "CATEGORY_NOT_FOUND");
      }
    }

    const attributeId = generateUUID();

    await db.insert(attributeDefinitions).values({
      id: attributeId,
      tenantId: tenant.id,
      categoryId: body.categoryId || null,
      code: normalizedCode,
      name: body.name,
      type: body.type,
      options: body.options,
      unit: body.unit || null,
      isFilterable: body.isFilterable,
      isRequired: body.isRequired,
      displayOrder: body.displayOrder,
    });

    const [created] = await db
      .select()
      .from(attributeDefinitions)
      .where(eq(attributeDefinitions.id, attributeId))
      .limit(1);

    return c.json(
      {
        success: true,
        message: "Dynamic attribute definition created successfully.",
        data: created,
      },
      201
    );
  }
);
