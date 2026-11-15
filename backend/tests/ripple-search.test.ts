import { describe, expect, it } from "vitest";
import {
  RIPPLE_RING_DEFINITIONS,
  damerauLevenshtein,
  parseInternationalQuery,
  stemToken,
} from "../src/modules/platform/search.service";
import {
  PLATFORM_ROOT_RETURN_SLUG,
  parseTenantReturnTo,
} from "../src/modules/auth/google-gateway.routes";
import {
  findStaticNeighborsForLocation,
  getStaticLocationStats,
  searchStaticTowns,
} from "../src/modules/platform/kenya-static-data";

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

  it("allows Google SSO return URLs on both platform root and active tenant subdomains", () => {
    const rootRes = parseTenantReturnTo("https://store254.co.ke/", "store254.co.ke");
    expect(rootRes?.tenantSlug).toBe(PLATFORM_ROOT_RETURN_SLUG);

    const wwwRes = parseTenantReturnTo("https://www.store254.co.ke/?tab=shop", "store254.co.ke");
    expect(wwwRes?.tenantSlug).toBe(PLATFORM_ROOT_RETURN_SLUG);

    const shopRes = parseTenantReturnTo("https://kilimani.store254.co.ke/", "store254.co.ke");
    expect(shopRes?.tenantSlug).toBe("kilimani");

    expect(parseTenantReturnTo("https://evil.com/", "store254.co.ke")).toBeNull();
    expect(parseTenantReturnTo("http://store254.co.ke/", "store254.co.ke")).toBeNull();
  });

  it("connects nearby towns and shopping centres across ward/county borders without connecting to wards", () => {
    const stats = getStaticLocationStats();
    expect(stats.locations).toBeGreaterThan(23000);

    const kenol = searchStaticTowns({ countyId: "county-021", q: "Kenol", limit: 5 })
      .find((loc) => loc.name.toLowerCase() === "kenol");
    expect(kenol).toBeDefined();

    const kenolNeighbors = findStaticNeighborsForLocation(kenol!.id, 8);
    expect(kenolNeighbors.length).toBe(8);
    expect(kenolNeighbors.some((n) => /kabati/i.test(n.name))).toBe(true);
    expect(kenolNeighbors.some((n) => /saba saba/i.test(n.name))).toBe(true);
    expect(kenolNeighbors.some((n) => /karugia/i.test(n.name))).toBe(true);
    expect(kenolNeighbors.some((n) => /makuyu/i.test(n.name))).toBe(true);
    expect(kenolNeighbors.some((n) => n.constituencyId !== kenol!.constituencyId)).toBe(true);
    expect(kenolNeighbors.every((n) => !n.id.startsWith("loc-ward-") && !/\bward$/i.test(n.name))).toBe(true);

    const kabati = searchStaticTowns({ q: "Kabati", limit: 1 })[0];
    expect(kabati).toBeDefined();
    expect(kabati!.name).toBe("Kabati");
    expect(kabati!.countyName).toContain("Murang");
    const kabatiNeighbors = findStaticNeighborsForLocation(kabati!.id, 8);
    expect(kabatiNeighbors.some((n) => /^kenol$/i.test(n.name))).toBe(true);
    expect(kabatiNeighbors.some((n) => /^thika$/i.test(n.name))).toBe(true);
    expect(kabatiNeighbors.some((n) => /makenji/i.test(n.name))).toBe(true);

    const thika = searchStaticTowns({ q: "Thika", limit: 1 })[0];
    expect(thika).toBeDefined();
    const thikaNeighbors = findStaticNeighborsForLocation(thika!.id, 8);
    expect(thikaNeighbors.some((n) => /makenji/i.test(n.name))).toBe(true);
    expect(thikaNeighbors.some((n) => /^kabati$/i.test(n.name))).toBe(true);
    expect(thikaNeighbors.some((n) => /^kenol$/i.test(n.name))).toBe(true);

    const makenji = searchStaticTowns({ countyId: "county-021", q: "Makenji", limit: 5 })
      .find((loc) => /makenji/i.test(loc.name));
    expect(makenji).toBeDefined();
    expect(makenji!.kind).toBe("SHOPPING_CENTRE");

    const makenjiNeighbors = findStaticNeighborsForLocation(makenji!.id, 8);
    expect(makenjiNeighbors.some((n) => n.countyId !== makenji!.countyId)).toBe(true);
    expect(makenjiNeighbors.every((n) => !n.id.startsWith("loc-ward-") && !/\bward$/i.test(n.name))).toBe(true);
  });
});
