import { describe, expect, it } from "vitest";
import { createItemSchema } from "../src/modules/catalog/items.routes";

describe("product photo limits and media paths", () => {
  const image = (index: number) => `https://example.com/product-${index}.jpg`;

  it("accepts up to five product photos", () => {
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

  it("rejects more than five product photos", () => {
    const result = createItemSchema.safeParse({
      title: "Test product",
      basePrice: 100,
      images: Array.from({ length: 6 }, (_, index) => image(index + 1)),
    });

    expect(result.success).toBe(false);
  });
});
