import { describe, it, expect } from "vitest";
import { classifyCategoryIcon } from "../src/catalog/category-classifier";

describe("Store254 Bulletproof Category Icon Classifier", () => {
  it("classifies diverse trades, Kenyan businesses, retail, and services accurately", () => {
    const cases: Array<{ name: string; description?: string; expected: string }> = [
      { name: "Plumbing & Pipe Fittings", expected: "wrench" },
      { name: "Electrical & Wiring", expected: "plug" },
      { name: "Solar Panels & Inverters", expected: "sun" },
      { name: "Hardware & Mabati", expected: "hard-hat" },
      { name: "Carpentry & Woodwork", expected: "hammer" },
      { name: "Painting & Gypsum", expected: "paint-roller" },
      { name: "Steel Gates & Welding", expected: "flame" },
      { name: "CCTV & Biometrics", expected: "shield-check" },
      { name: "Fumigation & Carpet Cleaning", expected: "spray-can" },
      { name: "Auto Spare Parts & Car Wash", expected: "car" },
      { name: "Boda Dispatch & Courier", expected: "truck" },
      { name: "Baby Shop & Diapers", expected: "baby" },
      { name: "Chemist & Pharmacy", expected: "pill" },
      { name: "Dental & Medical Clinic", expected: "stethoscope" },
      { name: "Kinyozi & Grooming", expected: "scissors" },
      { name: "Braids, Wigs & Hair Salon", expected: "sparkles" },
      { name: "Nails, Manicure & Skincare", expected: "flower-2" },
      { name: "Arabian Oud & Perfumes", expected: "droplets" },
      { name: "Birthday Cakes & Bakery", expected: "cake-slice" },
      { name: "Nyama Choma & Grills", expected: "utensils" },
      { name: "Fresh Produce & Mama Mboga", expected: "shopping-basket" },
      { name: "Butchery & Beef", expected: "beef" },
      { name: "Wines and Spirits", expected: "wine" },
      { name: "iPhone & Smartphone Repair", expected: "smartphone" },
      { name: "Laptops & Office Printers", expected: "laptop" },
      { name: "Web Design & Cloud Software", expected: "code" },
      { name: "Furnished Airbnb & Bedsitters", expected: "home" },
      { name: "Plots for Sale & Commercial Land", expected: "map-pin" },
      { name: "Sofas & Orthopedic Mattresses", expected: "armchair" },
      { name: "M-Pesa Agency & Tax Filing", expected: "landmark" },
      { name: "Advocates & Conveyancing", expected: "scale" },
      { name: "Banner Printing & Branding", expected: "megaphone" },
      { name: "Stationery & Textbooks", expected: "book-open" },
      { name: "Wedding Tents & Events", expected: "calendar" },
      { name: "Agrovet & Animal Feeds", expected: "sprout" },
      { name: "Pet Food & Vet Supplies", expected: "paw-print" },
      { name: "Wholesale & Bulk Cartons", expected: "boxes" },
      { name: "Gift Hampers & Flowers", expected: "gift" },
      { name: "Mtumba Dresses & Kitenge", expected: "shirt" },
      { name: "Sneakers & Official Shoes", expected: "footprints" },
      { name: "Gold Rings & Luxury Watches", expected: "gem" },
    ];

    for (const testCase of cases) {
      const result = classifyCategoryIcon({
        name: testCase.name,
        description: testCase.description,
      });
      expect(result.icon, `Category "${testCase.name}"`).toBe(testCase.expected);
    }
  });

  it("handles common spelling typos cleanly via fuzzy matching", () => {
    expect(classifyCategoryIcon({ name: "Plubming Services" }).icon).toBe("wrench");
    expect(classifyCategoryIcon({ name: "Pharacy & Drugs" }).icon).toBe("pill");
    expect(classifyCategoryIcon({ name: "Jewlery & Rings" }).icon).toBe("gem");
    expect(classifyCategoryIcon({ name: "Furnitre & Sofas" }).icon).toBe("armchair");
  });

  it("uses description, parent category, and store business context when name is vague", () => {
    const parentInherited = classifyCategoryIcon({
      name: "VIP Package",
      parentName: "Bridal Hair Salon",
      businessType: "SERVICE",
    });
    expect(parentInherited.icon).toBe("sparkles");

    const contextFallback = classifyCategoryIcon({
      name: "Signature Collection",
      businessType: "SERVICE",
      storeName: "Kamau Consulting",
    });
    expect(contextFallback.icon).toBe("briefcase");
    expect(contextFallback.source).toBe("context-fallback");

    const universalFallback = classifyCategoryIcon({
      name: "Miscellaneous Items",
    });
    expect(universalFallback.icon).toBe("package");
    expect(universalFallback.candidates).toContain("tag");
  });

  it("frontend shared classifier validates against Lucide registry and steps down fallback chain", async () => {
    // Load the browser module in globalThis for unit testing
    await import("../../frontend/scripts/shared/category-icon-classifier.js" as any);
    const classifier = (globalThis as any).Store254CategoryClassifier;
    expect(classifier).toBeDefined();

    // Simulate missing primary icon in a Lucide build -> automatically picks fallbackIcon ("settings")
    (globalThis as any).lucide = {
      icons: {
        Settings: {},
        Tag: {},
        Package: {},
      },
    };
    const resolved = classifier.resolveIcon({ name: "Plumbing Services", icon: "non-existent-icon" });
    expect(resolved).toBe("settings");

    delete (globalThis as any).lucide;
  });
});
