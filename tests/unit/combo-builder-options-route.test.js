import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/combos/builder/options", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns providers, combo kinds, and existing combos", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockResolvedValue([
        { id: "c1", name: "smart", kind: "llm", strategy: "fallback", models: ["gpt-4.1"] },
      ]),
    }));

    const { GET } = await import("@/app/api/combos/builder/options/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.providers)).toBe(true);
    expect(data.providers.length).toBeGreaterThan(0);
    expect(data.comboKinds).toContain("llm");
    expect(data.existingCombos).toEqual([
      { id: "c1", name: "smart", kind: "llm", strategy: "fallback", models: ["gpt-4.1"] },
    ]);
  });
});
