import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";
import { items } from "./items";

export const copyrightReports = sqliteTable(
  "copyright_reports",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    storeSubdomain: text("store_subdomain"),
    itemId: text("item_id").references(() => items.id, { onDelete: "set null" }),
    itemTitle: text("item_title"),
    reportedImageUrl: text("reported_image_url").notNull(),
    targetType: text("target_type", {
      enum: ["ITEM_IMAGE", "STORE_LOGO", "STORE_BANNER", "OTHER"],
    })
      .notNull()
      .default("ITEM_IMAGE"),
    pageUrl: text("page_url"),
    reporterName: text("reporter_name").notNull(),
    reporterEmail: text("reporter_email").notNull(),
    originalWorkUrl: text("original_work_url"),
    reason: text("reason").notNull(),
    goodFaithConfirmed: integer("good_faith_confirmed", { mode: "boolean" })
      .notNull()
      .default(true),
    status: text("status", { enum: ["OPEN", "TAKEN_DOWN", "DISMISSED"] })
      .notNull()
      .default("OPEN"),
    resolutionNotes: text("resolution_notes"),
    resolvedBy: text("resolved_by"),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    statusCreatedIdx: index("copyright_reports_status_created_idx").on(table.status, table.createdAt),
    tenantIdx: index("copyright_reports_tenant_idx").on(table.tenantId),
    itemIdx: index("copyright_reports_item_idx").on(table.itemId),
  })
);

export type CopyrightReport = typeof copyrightReports.$inferSelect;
export type NewCopyrightReport = typeof copyrightReports.$inferInsert;
