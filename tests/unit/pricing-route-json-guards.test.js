import { beforeEach, describe, expect, it, vi } from "vitest";

describe("pricing route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("PATCH /api/pricing rejects invalid json", async () => {
    vi.doMock("@/lib/localDb.js", () => ({ getPricing: vi.fn(), updatePricing: vi.fn(), resetPricing: vi.fn(), resetAllPricing: vi.fn() }));
    vi.doMock("@/shared/constants/pricing.js", () => ({ getDefaultPricing: vi.fn() }));
    const { PATCH } = await import("@/app/api/pricing/route");
    const response = await PATCH(new Request("http://localhost/api/pricing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid pricing data format" });
  });
});
