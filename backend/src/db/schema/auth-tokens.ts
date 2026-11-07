import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const passwordResetOtps = sqliteTable(
  "password_reset_otps",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    tenantId: text("tenant_id"), // Optional: null for platform-wide/owner, or scoped to store
    otpHash: text("otp_hash").notNull(), // Hashed 6-digit OTP to prevent database leak exposure
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    isUsed: integer("is_used", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    emailUsedExpiryIdx: index("otp_email_used_expiry_idx").on(
      table.email,
      table.isUsed,
      table.expiresAt
    ),
  })
);

export type PasswordResetOtp = typeof passwordResetOtps.$inferSelect;
export type NewPasswordResetOtp = typeof passwordResetOtps.$inferInsert;
