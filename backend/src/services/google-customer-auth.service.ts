import { and, eq } from "drizzle-orm";
import type { createDb } from "../db";
import { users } from "../db/schema/users";
import type { GoogleTokenPayload } from "../security/google-auth";
import { generateUUID } from "../security/crypto";
import { AppError } from "../security/error-handler";
import type { TenantContext, UserContext } from "../types/context";

type StoreDb = ReturnType<typeof createDb>;

export async function resolveGoogleCustomerForTenant(
  db: StoreDb,
  tenant: Pick<TenantContext, "id" | "status">,
  googleUser: GoogleTokenPayload
): Promise<UserContext> {
  if (tenant.status !== "ACTIVE") {
    throw new AppError("This store is not currently accepting customer sign-ins.", 403, "STORE_NOT_ACTIVE");
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.email, googleUser.email)))
    .limit(1);

  if (existing) {
    if (existing.status !== "ACTIVE") {
      throw new AppError("Your account has been deactivated. Please contact support.", 403, "ACCOUNT_INACTIVE");
    }
    if (existing.role !== "CUSTOMER") {
      throw new AppError("This Google account is not a customer account for this store.", 403, "CUSTOMER_ACCOUNT_REQUIRED");
    }

    if (
      existing.googleId !== googleUser.sub ||
      (!existing.fullName && googleUser.name) ||
      (!existing.avatarUrl && googleUser.picture)
    ) {
      await db
        .update(users)
        .set({
          googleId: googleUser.sub,
          fullName: existing.fullName || googleUser.name,
          avatarUrl: googleUser.picture || existing.avatarUrl,
        })
        .where(and(eq(users.id, existing.id), eq(users.tenantId, tenant.id)));
    }
    return {
      id: existing.id,
      tenantId: tenant.id,
      email: existing.email,
      role: "CUSTOMER",
    };
  }

  const userId = generateUUID();
  await db.insert(users).values({
    id: userId,
    tenantId: tenant.id,
    email: googleUser.email,
    passwordHash: `oauth$google$${googleUser.sub}`,
    fullName: googleUser.name,
    avatarUrl: googleUser.picture || null,
    googleId: googleUser.sub,
    role: "CUSTOMER",
    status: "ACTIVE",
    lastLoginAt: new Date(),
  });

  return {
    id: userId,
    tenantId: tenant.id,
    email: googleUser.email,
    role: "CUSTOMER",
  };
}
