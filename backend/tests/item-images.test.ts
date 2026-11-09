import { describe, expect, it } from "vitest";
import { createItemSchema } from "../src/modules/catalog/items.routes";

describe("product photo limits", () => {
  const image = (index: number) => `https://example.com/product-${index}.jpg`;

  it("accepts up to five product photos", () => {
    const result = createItemSchema.safeParse({
      title: "Test product",
      basePrice: 100,
      images: Array.from({ length: 5 }, (_, index) => image(index + 1)),
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
