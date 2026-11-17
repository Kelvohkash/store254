import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import type { createDb } from "../db";
import { users } from "../db/schema/users";
import { tenants } from "../db/schema/tenants";
import {
  kenyaConstituencies,
  kenyaCounties,
  kenyaLocations,
} from "../db/schema/kenya-locations";

type StoreDb = ReturnType<typeof createDb>;

export interface UserStoreSummary {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  businessType: string;
  status: "ACTIVE" | "PENDING" | "SUSPENDED";
  role: "OWNER" | "ADMIN" | "STAFF";
  locationLabel: string | null;
  countyName: string | null;
  constituencyName: string | null;
  townName: string | null;
  physicalAddress: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
}

const STATUS_PRIORITY: Record<string, number> = {
  ACTIVE: 0,
  PENDING: 1,
  SUSPENDED: 2,
};

const ROLE_PRIORITY: Record<string, number> = {
  OWNER: 0,
  ADMIN: 1,
  STAFF: 2,
};

export async function findMerchantStoresByEmail(
  db: StoreDb,
  email: string | undefined | null,
  options?: { emailVerified?: boolean }
): Promise<{ stores: UserStoreSummary[]; activeStore: UserStoreSummary | null }> {
  if (options?.emailVerified === false) {
    return { stores: [], activeStore: null };
  }

  const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
  if (!normalizedEmail) {
    return { stores: [], activeStore: null };
  }

  const rows = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      subdomain: tenants.subdomain,
      customDomain: tenants.customDomain,
      businessType: tenants.businessType,
      status: tenants.status,
      settings: tenants.settings,
      locationLabel: tenants.locationLabel,
      countyName: kenyaCounties.name,
      constituencyName: kenyaConstituencies.name,
      townName: kenyaLocations.name,
      role: users.role,
    })
    .from(users)
    .innerJoin(tenants, eq(users.tenantId, tenants.id))
    .leftJoin(kenyaCounties, eq(tenants.countyId, kenyaCounties.id))
    .leftJoin(kenyaConstituencies, eq(tenants.constituencyId, kenyaConstituencies.id))
    .leftJoin(kenyaLocations, eq(tenants.locationId, kenyaLocations.id))
    .where(
      and(
        sql`lower(${users.email}) = ${normalizedEmail}`,
        inArray(users.role, ["OWNER", "ADMIN", "STAFF"]),
        eq(users.status, "ACTIVE"),
        isNotNull(users.emailVerifiedAt)
      )
    );

  // Deduplicate by tenantId keeping the highest-privilege role
  const byTenant = new Map<string, UserStoreSummary>();
  for (const row of rows) {
    const rawSettings = (row.settings && typeof row.settings === "object"
      ? row.settings
      : {}) as Record<string, unknown>;
    const summary: UserStoreSummary = {
      id: row.tenantId,
      name: row.tenantName,
      subdomain: row.subdomain,
      customDomain: row.customDomain || null,
      businessType: row.businessType,
      status: row.status as UserStoreSummary["status"],
      role: row.role as UserStoreSummary["role"],
      locationLabel: row.locationLabel || null,
      countyName: row.countyName || null,
      constituencyName: row.constituencyName || null,
      townName: row.townName || null,
      physicalAddress:
        typeof rawSettings.physicalAddress === "string" && rawSettings.physicalAddress.trim()
          ? rawSettings.physicalAddress.trim()
          : null,
      contactPhone:
        typeof rawSettings.contactPhone === "string" && rawSettings.contactPhone.trim()
          ? rawSettings.contactPhone.trim()
          : null,
      logoUrl:
        typeof rawSettings.logoUrl === "string" && rawSettings.logoUrl.trim()
          ? rawSettings.logoUrl.trim()
          : null,
    };
    const existing = byTenant.get(row.tenantId);
    if (
      !existing ||
      (ROLE_PRIORITY[summary.role] ?? 9) < (ROLE_PRIORITY[existing.role] ?? 9)
    ) {
      byTenant.set(row.tenantId, summary);
    }
  }

  const stores = Array.from(byTenant.values()).sort((a, b) => {
    const statusDiff = (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return (ROLE_PRIORITY[a.role] ?? 9) - (ROLE_PRIORITY[b.role] ?? 9);
  });

  const activeStore = stores.find((s) => s.status === "ACTIVE") || null;
  return { stores, activeStore };
}
