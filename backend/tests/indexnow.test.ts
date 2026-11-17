import { describe, expect, it, vi } from "vitest";
import {
  INDEXNOW_KEY,
  buildStorefrontIndexNowUrls,
  categoryPath,
  itemPath,
  resolveIndexNowHost,
  submitToIndexNow,
} from "../src/services/indexnow.service";

describe("IndexNow service", () => {
  it("resolves host using customDomain first, falling back to subdomain.store254.co.ke", () => {
    expect(resolveIndexNowHost({ subdomain: "alicebabycare", customDomain: null })).toBe(
      "alicebabycare.store254.co.ke"
    );
    expect(resolveIndexNowHost({ subdomain: "alicebabycare", customDomain: "Shop.Alice.co.ke" })).toBe(
      "shop.alice.co.ke"
    );
  });

  it("deduplicates URLs and always includes the storefront homepage", () => {
    const urls = buildStorefrontIndexNowUrls(
      { subdomain: "fanice", customDomain: null },
      [itemPath("kitenge shirt"), itemPath("kitenge shirt"), categoryPath("shirts"), null, undefined]
    );
    expect(urls).toEqual([
      "https://fanice.store254.co.ke/",
      "https://fanice.store254.co.ke/item/kitenge%20shirt",
      "https://fanice.store254.co.ke/category/shirts",
    ]);
  });

  it("submits IndexNow payload only in production and never throws on network failure", async () => {
    const mockFetch = vi.fn(async () => new Response("", { status: 202 })) as unknown as typeof fetch;

    const skipped = await submitToIndexNow(
      { subdomain: "fanice" },
      ["https://fanice.store254.co.ke/"],
      { environment: "development", fetchImpl: mockFetch }
    );
    expect(skipped).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();

    const sent = await submitToIndexNow(
      { subdomain: "fanice" },
      ["https://fanice.store254.co.ke/", "https://fanice.store254.co.ke/item/shirt"],
      { environment: "production", fetchImpl: mockFetch }
    );
    expect(sent).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [endpoint, init] = (mockFetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("https://api.indexnow.org/indexnow");
    const parsed = JSON.parse(init.body as string);
    expect(parsed).toEqual({
      host: "fanice.store254.co.ke",
      key: INDEXNOW_KEY,
      keyLocation: `https://fanice.store254.co.ke/${INDEXNOW_KEY}.txt`,
      urlList: [
        "https://fanice.store254.co.ke/",
        "https://fanice.store254.co.ke/item/shirt",
      ],
    });

    const failingFetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const failed = await submitToIndexNow(
      { subdomain: "fanice" },
      ["https://fanice.store254.co.ke/"],
      { environment: "production", fetchImpl: failingFetch }
    );
    expect(failed).toBe(false);
  });
});
