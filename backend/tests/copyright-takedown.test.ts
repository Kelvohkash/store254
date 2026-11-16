import { describe, expect, it } from "vitest";
import app from "../src/index";
import {
  extractMediaReference,
  matchesReportedImage,
} from "../src/services/copyright-takedown.service";

describe("Copyright Takedown Service & Routes", () => {
  const mockEnv = {
    PRIMARY_DOMAIN: "store254.co.ke",
    ENVIRONMENT: "development" as const,
  };

  it("extracts tenantId and R2 key from relative and absolute /api/media/ URLs", () => {
    const rel = extractMediaReference("/api/media/tenant-123/photo.webp?v=1");
    expect(rel).toEqual({
      normalizedMediaPath: "/api/media/tenant-123/photo.webp",
      r2Key: "tenant-123/photo.webp",
      tenantIdFromUrl: "tenant-123",
    });

    const abs = extractMediaReference("https://shop.store254.co.ke/api/media/tenant-123/photo.webp");
    expect(abs).toEqual(rel);

    expect(extractMediaReference("/api/media/../secret/file.webp").r2Key).toBeNull();
    expect(extractMediaReference("https://example.com/pic.jpg").r2Key).toBeNull();
  });

  it("matches reported images regardless of host prefix", () => {
    const target = "https://store254.co.ke/api/media/tenant-1/item.webp";
    const ref = extractMediaReference(target);
    expect(matchesReportedImage("/api/media/tenant-1/item.webp", target, ref)).toBe(true);
    expect(matchesReportedImage("https://alice.store254.co.ke/api/media/tenant-1/item.webp", target, ref)).toBe(true);
    expect(matchesReportedImage("/api/media/tenant-1/other.webp", target, ref)).toBe(false);
  });

  it("validates copyright report payload and requires good-faith confirmation", async () => {
    const res = await app.request(
      "https://store254.co.ke/api/platform/copyright-reports",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterName: "Jane Doe",
          reporterEmail: "jane@example.com",
          reportedImageUrl: "/api/media/t1/img.webp",
          reason: "This is my original studio photo taken in Nairobi.",
          goodFaithConfirmed: false,
        }),
      },
      mockEnv as any
    );
    expect(res.status).toBe(400);
  });

  it("requires Super Admin authentication on takedown endpoints", async () => {
    const listRes = await app.request(
      "https://store254.co.ke/api/platform/admin/copyright-reports",
      {
        headers: { Origin: "https://store254.co.ke" },
      },
      mockEnv as any
    );
    expect(listRes.status).toBe(401);

    const takedownRes = await app.request(
      "https://store254.co.ke/api/platform/admin/media/takedown",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://store254.co.ke",
        },
        body: JSON.stringify({ reportedImageUrl: "/api/media/t1/img.webp" }),
      },
      mockEnv as any
    );
    expect(takedownRes.status).toBe(401);
  });
});
