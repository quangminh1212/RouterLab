import { beforeEach, describe, expect, it, vi } from "vitest";

const comboFixtures = [
  { name: "openclaw", models: ["kr/claude-haiku-4.5"] },
  { name: "hidden-combo", models: ["gemini/gemini-2.5-flash"], showInModelsEndpoint: false },
];

async function mockModelDeps() {
  vi.doMock("@/lib/localDb", () => ({
    getCombos: vi.fn().mockResolvedValue(comboFixtures),
    getSettings: vi.fn().mockResolvedValue({ hiddenModels: [] }),
  }));

  vi.doMock("@/models", () => ({
    getModelAliases: vi.fn().mockResolvedValue({}),
    setModelAlias: vi.fn(),
  }));
}

describe("model endpoints return combos only", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("GET /api/models returns visible combos only", async () => {
    await mockModelDeps();
    const { GET } = await import("@/app/api/models/route");
    const response = await GET();
    const data = await response.json();

    expect(data.models).toHaveLength(1);
    expect(data.models[0].fullModel).toBe("openclaw");
    expect(data.models[0].provider).toBe("combo");
  });

  it("GET /api/v1/models returns visible combos only", async () => {
    await mockModelDeps();
    const { GET } = await import("@/app/api/v1/models/route");
    const response = await GET();
    const data = await response.json();

    expect(data.object).toBe("list");
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe("openclaw");
    expect(data.data[0].owned_by).toBe("combo");
  });

  it("GET /api/v1beta/models returns visible combos only", async () => {
    await mockModelDeps();
    const { GET } = await import("@/app/api/v1beta/models/route");
    const response = await GET();
    const data = await response.json();

    expect(data.models).toHaveLength(1);
    expect(data.models[0].name).toBe("models/openclaw");
  });
});
