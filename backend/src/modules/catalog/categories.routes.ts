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
import { classifyCategoryIcon } from "../../catalog/category-classifier";

export const categoriesRouter = new Hono<AppEnv>();

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().optional(),
  parentId: z.string().min(1).nullable().optional(),
  description: z.string().max(500).optional(),
  icon: z.string().max(255).nullable().optional(),
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

  c.header("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
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
    let parentName: string | null = null;
    if (body.parentId) {
      const [parent] = await db
        .select({ id: categories.id, parentId: categories.parentId, name: categories.name })
        .from(categories)
        .where(and(eq(categories.id, body.parentId), eq(categories.tenantId, tenant.id)))
        .limit(1);

      if (!parent) {
        throw new AppError("Specified parent category does not exist.", 404, "PARENT_NOT_FOUND");
      }
      if (parent.parentId) {
        throw new AppError("Categories can only be nested one level below a top-level category.", 400, "CATEGORY_DEPTH_EXCEEDED");
      }
      parentName = parent.name;
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

    const explicitIcon = body.icon?.trim();
    const resolvedIcon =
      explicitIcon ||
      classifyCategoryIcon({
        name: body.name,
        slug,
        description: body.description,
        parentName,
        businessType: tenant.businessType,
        storeName: tenant.name,
      }).icon;

    const categoryId = generateUUID();

    await db.insert(categories).values({
      id: categoryId,
      tenantId: tenant.id,
      parentId: body.parentId || null,
      name: body.name,
      slug,
      description: body.description || null,
      icon: resolvedIcon,
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

// Update category details or move it beneath a different parent.
categoriesRouter.put(
  "/:id",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  zValidator("json", createCategorySchema),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { id } = c.req.param();
    const body = c.req.valid("json");
    const db = createDb(c.env.DB);
    const [existing] = await db.select().from(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenant.id))).limit(1);
    if (!existing) throw new AppError("Category not found.", 404, "NOT_FOUND");

    let parentName: string | null = null;
    if (body.parentId) {
      let ancestorId: string | null = body.parentId;
      while (ancestorId) {
        if (ancestorId === id) throw new AppError("A category cannot be nested beneath itself or one of its descendants.", 400, "CATEGORY_CYCLE");
        const [ancestor] = await db.select({ id: categories.id, parentId: categories.parentId }).from(categories)
          .where(and(eq(categories.id, ancestorId), eq(categories.tenantId, tenant.id))).limit(1);
        if (!ancestor) throw new AppError("Specified parent category does not exist.", 404, "PARENT_NOT_FOUND");
        ancestorId = ancestor.parentId;
      }

      const [parent] = await db.select({ parentId: categories.parentId, name: categories.name }).from(categories)
        .where(and(eq(categories.id, body.parentId), eq(categories.tenantId, tenant.id))).limit(1);
      if (parent?.parentId) {
        throw new AppError("Categories can only be nested one level below a top-level category.", 400, "CATEGORY_DEPTH_EXCEEDED");
      }
      parentName = parent?.name || null;

      const [child] = await db.select({ id: categories.id }).from(categories)
        .where(and(eq(categories.parentId, id), eq(categories.tenantId, tenant.id))).limit(1);
      if (child) {
        throw new AppError("A category with subcategories must stay at the top level.", 400, "CATEGORY_DEPTH_EXCEEDED");
      }
    }

    const slug = body.slug ? slugify(body.slug) : slugify(body.name);
    const [slugConflict] = await db.select({ id: categories.id }).from(categories)
      .where(and(eq(categories.tenantId, tenant.id), eq(categories.slug, slug))).limit(1);
    if (slugConflict && slugConflict.id !== id) {
      throw new AppError(`A category with slug "${slug}" already exists in your store.`, 409, "SLUG_EXISTS");
    }

    const explicitIcon = typeof body.icon === "string" ? body.icon.trim() : undefined;
    const resolvedIcon =
      explicitIcon ||
      (body.icon === null || body.icon === "" || !existing.icon
        ? classifyCategoryIcon({
            name: body.name,
            slug,
            description: body.description,
            parentName,
            businessType: tenant.businessType,
            storeName: tenant.name,
          }).icon
        : existing.icon);

    await db.update(categories).set({
      name: body.name,
      slug,
      parentId: body.parentId || null,
      description: body.description || null,
      icon: resolvedIcon,
      displayOrder: body.displayOrder,
    }).where(and(eq(categories.id, id), eq(categories.tenantId, tenant.id)));
    const [updated] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return c.json({ success: true, message: "Category updated successfully.", data: updated });
  }
);

// Delete Category (Store Owners & Admins only)
categoriesRouter.delete(
  "/:id",
  authMiddleware(true),
  requireRole(["OWNER", "ADMIN"]),
  async (c) => {
    const tenant = c.get("tenant")!;
    const { id } = c.req.param();
    const db = createDb(c.env.DB);

    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenant.id)))
      .limit(1);

    if (!existing) {
      throw new AppError("Category not found.", 404, "NOT_FOUND");
    }

    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, tenant.id)));

    return c.json({ success: true, message: "Category deleted successfully." });
  }
);
