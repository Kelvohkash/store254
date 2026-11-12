import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id"),
    action: text("action").notNull(), // e.g. "TENANT_REGISTERED", "ITEM_CREATED"
    ipAddress: text("ip_address"),
    details: text("details", { mode: "json" })
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantActionIdx: index("audit_tenant_action_idx").on(table.tenantId, table.action),
  })
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
