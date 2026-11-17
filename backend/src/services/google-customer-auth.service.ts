import { and, eq, sql } from "drizzle-orm";
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

  const normalizedEmail = googleUser.email.toLowerCase().trim();
  const now = new Date();

  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), sql`lower(${users.email}) = ${normalizedEmail}`))
    .limit(1);

  if (existing) {
    if (existing.status === "SUSPENDED") {
      throw new AppError("Your account has been deactivated. Please contact support.", 403, "ACCOUNT_INACTIVE");
    }

    if (existing.googleId && existing.googleId !== googleUser.sub) {
      throw new AppError(
        "This email is already linked to a different Google account.",
        403,
        "GOOGLE_ACCOUNT_MISMATCH"
      );
    }

    const isLinkingGoogle = !existing.googleId;
    const isUnverified = !existing.emailVerifiedAt || existing.status === "PENDING_VERIFICATION";
    // Prevent pre-account takeover: clear any pre-registered password and rotate tokenVersion when linking Google
    const shouldClearPassword =
      isLinkingGoogle && (isUnverified || existing.role === "CUSTOMER");

    const updates: Record<string, unknown> = {
      lastLoginAt: now,
      updatedAt: now,
    };

    if (isLinkingGoogle) {
      updates.googleId = googleUser.sub;
    }
    if (isUnverified) {
      updates.emailVerifiedAt = now;
      updates.status = "ACTIVE";
    }
    if (shouldClearPassword) {
      updates.passwordHash = `oauth$google$${googleUser.sub}`;
      updates.tokenVersion = sql`${users.tokenVersion} + 1`;
    }
    if (!existing.fullName && googleUser.name) {
      updates.fullName = googleUser.name;
    }
    if (!existing.avatarUrl && googleUser.picture) {
      updates.avatarUrl = googleUser.picture;
    }

    await db
      .update(users)
      .set(updates)
      .where(and(eq(users.id, existing.id), eq(users.tenantId, tenant.id)));

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
    email: normalizedEmail,
    passwordHash: `oauth$google$${googleUser.sub}`,
    fullName: googleUser.name,
    avatarUrl: googleUser.picture || null,
    googleId: googleUser.sub,
    role: "CUSTOMER",
    status: "ACTIVE",
    emailVerifiedAt: now,
    tokenVersion: 0,
    lastLoginAt: now,
  });

  return {
    id: userId,
    tenantId: tenant.id,
    email: normalizedEmail,
    role: "CUSTOMER",
  };
}
