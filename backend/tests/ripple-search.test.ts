import { describe, expect, it } from "vitest";
import {
  RIPPLE_RING_DEFINITIONS,
  damerauLevenshtein,
  parseInternationalQuery,
  stemToken,
} from "../src/modules/platform/search.service";

describe("International Ripple Search Query Engine", () => {
  it("normalizes multi-term queries, removes stop words, and builds prefix/synonym FTS5 expressions", () => {
    const parsed = parseInternationalQuery("Buy Samsung 55-inch Smart TVs in Kabati");
    expect(parsed.tokens).toEqual(["samsung", "55", "inch", "smart", "tvs", "kabati"]);
    expect(parsed.strictFtsQuery).toContain("samsung*");
    expect(parsed.strictFtsQuery).toContain("television*");
    expect(parsed.strictFtsQuery).toContain("AND");
  });

  it("expands East African + international retail synonyms bidirectionally", () => {
    const kinyozi = parseInternationalQuery("kinyozi");
    expect(kinyozi.expandedGroups[0]).toContain("barber");

    const viatu = parseInternationalQuery("viatu");
    expect(viatu.expandedGroups[0]).toContain("sneaker");
    expect(viatu.expandedGroups[0]).toContain("shoe");

    const simu = parseInternationalQuery("simu");
    expect(simu.expandedGroups[0]).toContain("smartphone");
  });

  it("stems common English plurals cleanly", () => {
    expect(stemToken("shoes")).toBe("shoe");
    expect(stemToken("dresses")).toBe("dress");
    expect(stemToken("laptops")).toBe("laptop");
    expect(stemToken("tv")).toBe("tv");
  });

  it("computes Damerau-Levenshtein distance accurately for common shopper typos", () => {
    expect(damerauLevenshtein("ipohne", "iphone")).toBe(1);
    expect(damerauLevenshtein("samsng", "samsung")).toBe(1);
    expect(damerauLevenshtein("shooes", "shoes")).toBe(1);
    expect(damerauLevenshtein("kinyosi", "kinyozi")).toBe(1);
  });

  it("defines 6 progressive spatial ripple rings from Exact Centre to Nationwide Dispatch", () => {
    expect(RIPPLE_RING_DEFINITIONS.map((r) => r.ring)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(RIPPLE_RING_DEFINITIONS[1].name).toContain("8 Nearest");
    expect(RIPPLE_RING_DEFINITIONS[4].name).toContain("National Hubs");
    expect(RIPPLE_RING_DEFINITIONS[5].maxDistanceKm).toBeNull();
  });
});
