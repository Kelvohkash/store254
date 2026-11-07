import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and, asc } from "drizzle-orm";
import type { AppEnv } from "../../types/context";
import { createDb } from "../../db";
import { categories, type Category } from "../../db/schema/categories";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { generateUUID } from "../../security/crypto";
import { slugify } from "../../security/sanitize";
import { AppError } from "../../security/error-handler";

export const categoriesRouter = new Hono<AppEnv>();

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(255).optional(),
  displayOrder: z.number().int().default(0),
});

// Category Tree Node Interface
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

/**
 * Builds a hierarchical tree from a flat list of categories
 */
function buildCategoryTree(flatList: Category[]): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const cat of flatList) {
    map.set(cat.id, { ...cat, children: [] });
  }

  for (const cat of flatList) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// Get Hierarchical Category Tree for Storefront
categoriesRouter.get("/", async (c) => {
  const tenant = c.get("tenant")!;
  const db = createDb(c.env.DB);

  const flatCategories = await db
    .select()
    .from(categories)
    .where(and(eq(categories.tenantId, tenant.id), eq(categories.isActive, true)))
    .orderBy(asc(categories.displayOrder), asc(categories.name));

  const tree = buildCategoryTree(flatCategories);

  return c.json({
    success: true,
    data: tree,
  });
});

// Create Category / Subcategory (Store Owners & Admins only)
categoriesRouter.post(
  "/",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", createCategorySchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);

    const slug = body.slug ? slugify(body.slug) : slugify(body.name);

    // If parentId provided, verify it exists and belongs to this tenant
    if (body.parentId) {
      const [parent] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, body.parentId), eq(categories.tenantId, tenant.id)))
        .limit(1);

      if (!parent) {
        throw new AppError("Specified parent category does not exist.", 404, "PARENT_NOT_FOUND");
      }
    }

    // Verify slug uniqueness within tenant
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.tenantId, tenant.id), eq(categories.slug, slug)))
      .limit(1);

    if (existing) {
      throw new AppError(
        `A category with slug "${slug}" already exists in your store.`,
        409,
        "SLUG_EXISTS"
      );
    }

    const categoryId = generateUUID();

    await db.insert(categories).values({
      id: categoryId,
      tenantId: tenant.id,
      parentId: body.parentId || null,
      name: body.name,
      slug,
      description: body.description || null,
      icon: body.icon || null,
      displayOrder: body.displayOrder,
      isActive: true,
    });

    const [created] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    return c.json(
      {
        success: true,
        message: "Category created successfully.",
        data: created,
      },
      201
    );
  }
);
