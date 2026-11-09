import { describe, expect, it } from "vitest";
import { resolveTenantLookup } from "../src/middlewares/tenant.middleware";

describe("tenant host and API selector resolution", () => {
  it("resolves a shared API request from its validated tenant selector", () => {
    expect(resolveTenantLookup("api.store254.co.ke", "store254.co.ke", "alicebabycare")).toEqual({
      resolvedSubdomain: "alicebabycare",
      resolvedCustomDomain: null,
    });
  });

  it("rejects invalid or reserved selectors on the shared API host", () => {
    expect(resolveTenantLookup("api.store254.co.ke", "store254.co.ke", "api")).toEqual({
      resolvedSubdomain: null,
      resolvedCustomDomain: null,
    });
  });

  it("resolves an explicit tenant selector on the local development API host", () => {
    expect(resolveTenantLookup("127.0.0.1", "store254.co.ke", "alicebabycare")).toEqual({
      resolvedSubdomain: "alicebabycare",
      resolvedCustomDomain: null,
    });
  });

  it("does not infer a tenant from a local host without an explicit selector", () => {
    expect(resolveTenantLookup("localhost", "store254.co.ke", undefined)).toEqual({
      resolvedSubdomain: null,
      resolvedCustomDomain: null,
    });
  });

  it("keeps tenant subdomain resolution tied to Host, ignoring a conflicting selector", () => {
    expect(resolveTenantLookup("alicebabycare.store254.co.ke", "store254.co.ke", "another-store")).toEqual({
      resolvedSubdomain: "alicebabycare",
      resolvedCustomDomain: null,
    });
  });

  it("continues to resolve custom domains from Host", () => {
    expect(resolveTenantLookup("shop.example.com", "store254.co.ke", "alicebabycare")).toEqual({
      resolvedSubdomain: null,
      resolvedCustomDomain: "shop.example.com",
    });
  });

  it("resolves an internal worker service binding request with explicit selector", () => {
    expect(resolveTenantLookup("api.internal", "store254.co.ke", "alicebabycare")).toEqual({
      resolvedSubdomain: "alicebabycare",
      resolvedCustomDomain: null,
    });
  });

  it("does not treat internal worker API host as a custom domain when selector is absent", () => {
    expect(resolveTenantLookup("api.internal", "store254.co.ke", undefined)).toEqual({
      resolvedSubdomain: null,
      resolvedCustomDomain: null,
    });
  });

  it("resolves local development *.localhost subdomains automatically", () => {
    expect(resolveTenantLookup("alicebabycare.localhost", "store254.co.ke", undefined)).toEqual({
      resolvedSubdomain: "alicebabycare",
      resolvedCustomDomain: null,
    });
  });
});
