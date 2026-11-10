import { describe, expect, it } from "vitest";
import { createItemSchema } from "../src/modules/catalog/items.routes";

describe("product photo limits and media paths", () => {
  const image = (index: number) => `/api/media/tenant-1/product-${index}.jpg`;

  it("accepts up to five product photos with valid R2 media paths", () => {
    const result = createItemSchema.safeParse({
      title: "Test product",
      basePrice: 100,
      images: Array.from({ length: 5 }, (_, index) => image(index + 1)),
    });

    expect(result.success).toBe(true);
  });

  it("accepts uploaded R2 media paths and variants", () => {
    const result = createItemSchema.safeParse({
      title: "Uploaded product",
      basePrice: 2500,
      images: ["/api/media/tenant-1/photo-1.webp"],
      variants: [
        { title: "Large", price: 2800, stockQuantity: 10, options: { size: "L" } },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts empty images array", () => {
    const result = createItemSchema.safeParse({
      title: "No photo product",
      basePrice: 1000,
      images: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects http and https image URLs on new writes", () => {
    const result = createItemSchema.safeParse({
      title: "External URL product",
      basePrice: 500,
      images: ["https://example.com/product-1.jpg"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects data: URI images on new writes", () => {
    const result = createItemSchema.safeParse({
      title: "Base64 product",
      basePrice: 500,
      images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA"],
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than five product photos", () => {
    const result = createItemSchema.safeParse({
      title: "Test product",
      basePrice: 100,
      images: Array.from({ length: 6 }, (_, index) => image(index + 1)),
    });

    expect(result.success).toBe(false);
  });

  it("verifies media path belongs to the caller tenant", async () => {
    const { isTenantMediaPath } = await import("../src/modules/catalog/items.routes");
    expect(isTenantMediaPath("/api/media/tenant-1/photo.jpg", "tenant-1")).toBe(true);
    expect(isTenantMediaPath("/api/media/tenant-2/photo.jpg", "tenant-1")).toBe(false);
    expect(isTenantMediaPath("https://example.com/photo.jpg", "tenant-1")).toBe(false);
    expect(isTenantMediaPath("/api/media/tenant-1/", "tenant-1")).toBe(false);
  });
});
