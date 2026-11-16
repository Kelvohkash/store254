import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { tenants } from "../db/schema/tenants";
import { items } from "../db/schema/items";
import { auditLogs } from "../db/schema/audit";
import { generateUUID } from "../security/crypto";

export interface MediaReference {
  normalizedMediaPath: string | null;
  r2Key: string | null;
  tenantIdFromUrl: string | null;
}

/**
 * Extracts canonical `/api/media/<tenantId>/<fileName>` metadata from either a
 * relative path or an absolute URL so takedowns match regardless of host.
 */
export function extractMediaReference(rawUrl: string): MediaReference {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) {
    return { normalizedMediaPath: null, r2Key: null, tenantIdFromUrl: null };
  }

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      pathname = trimmed;
    }
  } else {
    pathname = trimmed.split(/[?#]/)[0] || trimmed;
  }

  const match = pathname.match(/^\/api\/media\/([^/]+)\/([^/?#]+)$/);
  if (!match) {
    return { normalizedMediaPath: null, r2Key: null, tenantIdFromUrl: null };
  }

  const tenantIdFromUrl = decodeURIComponent(match[1]);
  const fileName = decodeURIComponent(match[2]);
  if (!tenantIdFromUrl || !fileName || tenantIdFromUrl.includes("..") || fileName.includes("..")) {
    return { normalizedMediaPath: null, r2Key: null, tenantIdFromUrl: null };
  }

  return {
    normalizedMediaPath: `/api/media/${match[1]}/${match[2]}`,
    r2Key: `${tenantIdFromUrl}/${fileName}`,
    tenantIdFromUrl,
  };
}

export function matchesReportedImage(
  candidateUrl: unknown,
  targetRawUrl: string,
  mediaRef: MediaReference
): boolean {
  if (typeof candidateUrl !== "string") return false;
  const candidateTrimmed = candidateUrl.trim();
  if (!candidateTrimmed) return false;

  const targetTrimmed = targetRawUrl.trim();
  if (candidateTrimmed === targetTrimmed) return true;

  if (mediaRef.normalizedMediaPath) {
    const candidateRef = extractMediaReference(candidateTrimmed);
    if (
      candidateRef.normalizedMediaPath &&
      candidateRef.normalizedMediaPath === mediaRef.normalizedMediaPath
    ) {
      return true;
    }
  }

  return false;
}

export interface TakedownResult {
  tenantId: string | null;
  itemsUpdated: number;
  settingsCleared: number;
  r2Deleted: boolean;
  r2Key: string | null;
  storeSuspended: boolean;
}

/**
 * Removes a copyrighted image from matching items and tenant branding settings,
 * purges the object from R2 storage when hosted on `/api/media/...`, optionally
 * suspends the offending storefront, and logs an audit entry.
 */
export async function executeImageTakedown(
  db: Database,
  mediaBucket: R2Bucket | undefined,
  options: {
    reportedImageUrl: string;
    tenantIdHint?: string | null;
    itemIdHint?: string | null;
    suspendStore?: boolean;
    reasonNote?: string | null;
    reportId?: string | null;
  }
): Promise<TakedownResult> {
  const mediaRef = extractMediaReference(options.reportedImageUrl);
  let targetTenantId = options.tenantIdHint || mediaRef.tenantIdFromUrl || null;

  if (!targetTenantId && options.itemIdHint) {
    const [hintedItem] = await db
      .select({ tenantId: items.tenantId })
      .from(items)
      .where(eq(items.id, options.itemIdHint))
      .limit(1);
    if (hintedItem?.tenantId) {
      targetTenantId = hintedItem.tenantId;
    }
  }

  let itemsUpdated = 0;
  let settingsCleared = 0;
  let storeSuspended = false;

  if (targetTenantId) {
    const tenantItems = await db
      .select({ id: items.id, images: items.images })
      .from(items)
      .where(eq(items.tenantId, targetTenantId));

    for (const row of tenantItems) {
      const currentImages = Array.isArray(row.images) ? row.images : [];
      const nextImages = currentImages.filter(
        (img) => !matchesReportedImage(img, options.reportedImageUrl, mediaRef)
      );
      if (nextImages.length !== currentImages.length) {
        await db
          .update(items)
          .set({ images: nextImages, updatedAt: new Date() })
          .where(eq(items.id, row.id));
        itemsUpdated += 1;
      }
    }

    const [tenantRow] = await db
      .select({ id: tenants.id, settings: tenants.settings })
      .from(tenants)
      .where(eq(tenants.id, targetTenantId))
      .limit(1);

    if (tenantRow) {
      const rawSettings =
        tenantRow.settings && typeof tenantRow.settings === "object"
          ? { ...tenantRow.settings }
          : {};
      const mediaKeys = ["logoUrl", "bannerUrl", "heroBannerUrl"] as const;
      for (const key of mediaKeys) {
        if (matchesReportedImage(rawSettings[key], options.reportedImageUrl, mediaRef)) {
          delete rawSettings[key];
          settingsCleared += 1;
        }
      }

      if (settingsCleared > 0 || options.suspendStore) {
        await db
          .update(tenants)
          .set({
            ...(settingsCleared > 0 ? { settings: rawSettings } : {}),
            ...(options.suspendStore ? { status: "SUSPENDED" as const } : {}),
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, targetTenantId));
        if (options.suspendStore) {
          storeSuspended = true;
        }
      }
    }
  } else if (options.itemIdHint) {
    const [singleItem] = await db
      .select({ id: items.id, tenantId: items.tenantId, images: items.images })
      .from(items)
      .where(eq(items.id, options.itemIdHint))
      .limit(1);
    if (singleItem) {
      const currentImages = Array.isArray(singleItem.images) ? singleItem.images : [];
      const nextImages = currentImages.filter(
        (img) => !matchesReportedImage(img, options.reportedImageUrl, mediaRef)
      );
      if (nextImages.length !== currentImages.length) {
        await db
          .update(items)
          .set({ images: nextImages, updatedAt: new Date() })
          .where(eq(items.id, singleItem.id));
        itemsUpdated += 1;
      }
      targetTenantId = singleItem.tenantId;
    }
  }

  let r2Deleted = false;
  if (mediaBucket && mediaRef.r2Key) {
    try {
      await mediaBucket.delete(mediaRef.r2Key);
      r2Deleted = true;
    } catch {
      r2Deleted = false;
    }
  }

  if (targetTenantId) {
    await db.insert(auditLogs).values({
      id: generateUUID(),
      tenantId: targetTenantId,
      userId: null,
      action: "COPYRIGHT_TAKEDOWN",
      details: {
        reportId: options.reportId || null,
        reportedImageUrl: options.reportedImageUrl,
        r2Key: mediaRef.r2Key,
        r2Deleted,
        itemsUpdated,
        settingsCleared,
        storeSuspended,
        reasonNote: options.reasonNote || null,
      },
    });
  }

  return {
    tenantId: targetTenantId,
    itemsUpdated,
    settingsCleared,
    r2Deleted,
    r2Key: mediaRef.r2Key,
    storeSuspended,
  };
}
