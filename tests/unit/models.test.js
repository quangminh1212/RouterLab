import { beforeEach, describe, expect, it, vi } from "vitest";

const comboFixtures = [
  { name: "openclaw", models: ["kr/claude-haiku-4.5"] },
  { name: "hidden-combo", models: ["gemini/gemini-2.5-flash"], showInModelsEndpoint: false },
];

async function mockModelDeps(hiddenModels = []) {
  vi.doMock("@/lib/localDb", () => ({
    getCombos: vi.fn().mockResolvedValue(comboFixtures),
    getModelAliases: vi.fn().mockResolvedValue({}),
    getSettings: vi.fn().mockResolvedValue({ hiddenModels }),
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

  it("GET /api/v1beta/models returns visible combos and aliases", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockResolvedValue(comboFixtures),
      getModelAliases: vi.fn().mockResolvedValue({ smart: "openclaw" }),
      getSettings: vi.fn().mockResolvedValue({ hiddenModels: [] }),
    }));

    const { GET } = await import("@/app/api/v1beta/models/route");
    const response = await GET();
    const data = await response.json();

    expect(data.models).toHaveLength(2);
    expect(data.models.map((model) => model.name)).toEqual(["models/openclaw", "models/smart"]);
  });

  it("filters hidden models from public model endpoints", async () => {
    await mockModelDeps(["openclaw"]);

    const [{ GET: getV1 }, { GET: getV1Beta }, { GET: getInfo }] = await Promise.all([
      import("@/app/api/v1/models/route"),
      import("@/app/api/v1beta/models/route"),
      import("@/app/api/v1/models/info/route"),
    ]);

    const v1Data = await (await getV1()).json();
    const v1betaData = await (await getV1Beta()).json();
    const infoData = await (await getInfo()).json();

    expect(v1Data.data).toEqual([]);
    expect(v1betaData.models).toEqual([]);
    expect(infoData.data).toEqual([]);
  });
});
