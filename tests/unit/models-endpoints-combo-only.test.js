import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/localDb", () => ({
  getCombos: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock("@/models", () => ({
  getModelAliases: vi.fn(),
  setModelAlias: vi.fn(),
}));

vi.mock("@/lib/disabledModelsDb", () => ({
  getDisabledModels: vi.fn(),
}));

const { getCombos, getSettings } = await import("@/lib/localDb");
const { getModelAliases } = await import("@/models");
const { getDisabledModels } = await import("@/lib/disabledModelsDb");

const comboFixtures = [
  { name: "openclaw", models: ["kr/claude-haiku-4.5"] },
  { name: "hidden-combo", models: ["gemini/gemini-2.5-flash"], showInModelsEndpoint: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  getCombos.mockResolvedValue(comboFixtures);
  getSettings.mockResolvedValue({ hiddenModels: [] });
  getModelAliases.mockResolvedValue({});
  getDisabledModels.mockResolvedValue({});
});

describe("model endpoints return combos only", () => {
  it("GET /api/models returns visible combos only", async () => {
    const { GET } = await import("@/app/api/models/route");
    const response = await GET();
    const data = await response.json();

    expect(data.models).toHaveLength(1);
    expect(data.models[0].fullModel).toBe("openclaw");
    expect(data.models[0].provider).toBe("combo");
  });

  it("GET /api/v1/models returns visible combos only", async () => {
    const { GET } = await import("@/app/api/v1/models/route");
    const response = await GET();
    const data = await response.json();

    expect(data.object).toBe("list");
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe("openclaw");
    expect(data.data[0].owned_by).toBe("combo");
  });

  it("GET /api/v1beta/models returns visible combos only", async () => {
    const { GET } = await import("@/app/api/v1beta/models/route");
    const response = await GET();
    const data = await response.json();

    expect(data.models).toHaveLength(1);
    expect(data.models[0].name).toBe("models/openclaw");
  });
});
