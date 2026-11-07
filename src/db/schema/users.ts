import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { tenants } from "./tenants";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name"),
    phone: text("phone"),
    role: text("role", { enum: ["OWNER", "ADMIN", "STAFF", "CUSTOMER"] })
      .notNull()
      .default("CUSTOMER"),
    status: text("status", { enum: ["ACTIVE", "SUSPENDED"] })
      .notNull()
      .default("ACTIVE"),
    lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // Scoped email uniqueness per tenant
    tenantEmailIdx: uniqueIndex("users_tenant_email_idx").on(table.tenantId, table.email),
    tenantRoleIdx: index("users_tenant_role_idx").on(table.tenantId, table.role),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
