import { describe, expect, it } from "vitest";
import {
  isTenantMediaPath,
  validateTenantMediaUrl,
  updateStoreProfileSchema,
} from "../src/modules/tenant/tenant.routes";
import { isTenantMediaPath as isItemTenantMediaPath } from "../src/modules/catalog/items.routes";

describe("tenant branding media validation (logoUrl and bannerUrl)", () => {
  const tenantId = "tenant-alice-baby-care";
  const foreignTenantId = "tenant-bob-electronics";

  it("allows unchanged legacy external HTTPS URLs for logo and banner", () => {
    const legacyUrl = "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=600";
    expect(validateTenantMediaUrl(legacyUrl, legacyUrl, tenantId)).toBe(true);
  });

  it("allows unchanged legacy data: URIs", () => {
    const legacyDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    expect(validateTenantMediaUrl(legacyDataUri, legacyDataUri, tenantId)).toBe(true);
  });

  it("rejects new external HTTPS URLs when changed", () => {
    const currentUrl = "https://images.unsplash.com/old-logo.jpg";
    const newExternalUrl = "https://evil.com/new-logo.png";
    expect(validateTenantMediaUrl(newExternalUrl, currentUrl, tenantId)).toBe(false);
  });

  it("rejects new data: URIs when changed", () => {
    const currentUrl = "/api/media/tenant-alice-baby-care/old-logo.webp";
    const newDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA";
    expect(validateTenantMediaUrl(newDataUri, currentUrl, tenantId)).toBe(false);
  });

  it("rejects media paths belonging to a different tenant", () => {
    const foreignMediaPath = `/api/media/${foreignTenantId}/logo.webp`;
    expect(validateTenantMediaUrl(foreignMediaPath, "", tenantId)).toBe(false);
    expect(isTenantMediaPath(foreignMediaPath, tenantId)).toBe(false);
    expect(isItemTenantMediaPath(foreignMediaPath, tenantId)).toBe(false);
  });

  it("accepts valid uploaded media paths belonging to caller's tenant", () => {
    const validMediaPath = `/api/media/${tenantId}/store-logo-123.webp`;
    expect(validateTenantMediaUrl(validMediaPath, "", tenantId)).toBe(true);
    expect(isTenantMediaPath(validMediaPath, tenantId)).toBe(true);
    expect(isItemTenantMediaPath(validMediaPath, tenantId)).toBe(true);
  });

  it("allows clearing logoUrl or bannerUrl with empty string or null", () => {
    const currentUrl = `/api/media/${tenantId}/store-logo.webp`;
    expect(validateTenantMediaUrl("", currentUrl, tenantId)).toBe(true);
    expect(validateTenantMediaUrl(null, currentUrl, tenantId)).toBe(true);
    expect(validateTenantMediaUrl(undefined, currentUrl, tenantId)).toBe(true);
  });

  it("updateStoreProfileSchema accepts legacy and media URLs without schema rejection", () => {
    const legacyParsed = updateStoreProfileSchema.safeParse({
      name: "Alice Baby Care",
      settings: {
        logoUrl: "https://images.unsplash.com/photo-1544717305",
        bannerUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA",
      },
    });
    expect(legacyParsed.success).toBe(true);

    const mediaParsed = updateStoreProfileSchema.safeParse({
      name: "Alice Baby Care",
      settings: {
        logoUrl: `/api/media/${tenantId}/logo.webp`,
        bannerUrl: `/api/media/${tenantId}/banner.webp`,
      },
    });
    expect(mediaParsed.success).toBe(true);

    const clearParsed = updateStoreProfileSchema.safeParse({
      settings: {
        logoUrl: "",
        bannerUrl: null,
      },
    });
    expect(clearParsed.success).toBe(true);
  });
});
