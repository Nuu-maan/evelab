import { describe, expect, it } from "vitest";
import { platformProducts, sandboxCredentials } from "../src/lib/vercel-platform";

const byId = (env: Record<string, string>) => new Map(platformProducts(env).map((product) => [product.id, product]));

describe("sandboxCredentials", () => {
  it("prefers an explicit token with team and project, and accepts OIDC alone", () => {
    expect(sandboxCredentials({ VERCEL_TOKEN: "t", VERCEL_TEAM_ID: "team", VERCEL_PROJECT_ID: "prj" })).toEqual({
      token: "t",
      teamId: "team",
      projectId: "prj",
    });
    expect(sandboxCredentials({ VERCEL_OIDC_TOKEN: "oidc" })).toEqual({});
    expect(sandboxCredentials({ VERCEL_TOKEN: "t" })).toBeUndefined();
  });
});

describe("platformProducts", () => {
  it("reports nothing configured on a bare machine, with a fallback for each", () => {
    const products = platformProducts({});
    expect(products.every((product) => !product.configured && product.fallback.length > 0)).toBe(true);
  });

  it("turns on what the OIDC token of a linked project unlocks", () => {
    const products = byId({ VERCEL_OIDC_TOKEN: "oidc" });
    expect(products.get("sandbox")?.configured).toBe(true);
    expect(products.get("ai-gateway")?.configured).toBe(true);
    expect(products.get("connect")?.configured).toBe(true);
    expect(products.get("blob")?.configured).toBe(false);
  });
});
