import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/constants/pricing.js", () => ({
  getDefaultPricing: vi.fn(() => ({ demo: { basic: { input: 1, output: 2 } } })),
}));

describe("pricing compatibility routes", () => {
  it("GET /api/pricing/defaults returns default pricing", async () => {
    const { GET } = await import("@/app/api/pricing/defaults/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ demo: { basic: { input: 1, output: 2 } } });
  });

  it("GET /api/pricing/models merges built-in, custom, and pricing-only models", async () => {
    vi.doMock("@/lib/localDb.js", () => ({
      getCustomModels: vi.fn(async () => [
        { providerAlias: "openrouter", id: "custom-model", name: "Custom Model" },
      ]),
      getPricing: vi.fn(async () => ({
        openrouter: { "pricing-only": { input: 1, output: 2 } },
      })),
    }));
    vi.doMock("@/shared/constants/providers.js", () => ({
      AI_PROVIDERS: { openrouter: { name: "OpenRouter" } },
    }));
    vi.doMock("open-sse/config/providerModels.js", () => ({
      PROVIDER_ID_TO_ALIAS: { openrouter: "openrouter" },
      getModelsByProviderId: vi.fn(() => [
        { id: "builtin-model", name: "Built In" },
      ]),
    }));

    const { GET } = await import("@/app/api/pricing/models/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.openrouter).toMatchObject({
      id: "openrouter",
      alias: "openrouter",
      name: "OpenRouter",
      modelCount: 3,
    });
    expect(data.openrouter.models).toEqual([
      { id: "builtin-model", name: "Built In", custom: false },
      { id: "custom-model", name: "Custom Model", custom: true },
      { id: "pricing-only", name: "pricing-only", custom: true },
    ]);
  });
});
