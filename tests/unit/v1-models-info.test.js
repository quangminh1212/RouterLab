import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/models/info", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns combo models with metadata", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockResolvedValue([
        { name: "xlabrouter/openclaw", kind: "chat", models: ["openclaw"], showInModelsEndpoint: true },
        { name: "hidden/combo", kind: "chat", models: ["hidden"], showInModelsEndpoint: false },
      ]),
      getModelAliases: vi.fn().mockResolvedValue({ smart: "xlabrouter/openclaw", "xlabrouter/openclaw": "hidden/combo" }),
      getSettings: vi.fn().mockResolvedValue({ hiddenModels: [] }),
    }));

    vi.doMock("open-sse/config/models.js", () => ({
      getModelInfo: vi.fn((modelId) => modelId === "xlabrouter/openclaw"
        ? { type: ["chat", "image"], contextWindow: 123456 }
        : { type: ["chat"], contextWindow: 200000 }),
    }));

    const { GET } = await import("@/app/api/v1/models/info/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.object).toBe("list");
    expect(data.data).toEqual([
      {
        id: "smart",
        name: "smart",
        provider: "alias",
        kind: "chat",
        type: ["chat", "image"],
        contextWindow: 123456,
        supports: {
          reasoning: true,
          image: true,
          embedding: false,
          audio: false,
          video: false,
        },
        root: "xlabrouter/openclaw",
        parent: "xlabrouter/openclaw",
        models: ["openclaw"],
      },
      {
        id: "xlabrouter/openclaw",
        name: "xlabrouter/openclaw",
        provider: "combo",
        kind: "chat",
        type: ["chat", "image"],
        contextWindow: 123456,
        supports: {
          reasoning: true,
          image: true,
          embedding: false,
          audio: false,
          video: false,
        },
        root: "xlabrouter/openclaw",
        parent: null,
        models: ["openclaw"],
      },
    ]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("includes TamMao passthrough model info for chained router imports", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockResolvedValue([
        { name: "gpt-5.5", kind: "chat", models: ["tammao/gpt-5.5"], showInModelsEndpoint: true },
      ]),
      getModelAliases: vi.fn().mockResolvedValue({}),
      getSettings: vi.fn().mockResolvedValue({ hiddenModels: [] }),
    }));

    vi.doMock("open-sse/config/models.js", () => ({
      getModelInfo: vi.fn(() => ({ type: ["chat"], contextWindow: 200000 })),
    }));

    const { GET } = await import("@/app/api/v1/models/info/route");
    const response = await GET();
    const data = await response.json();

    expect(data.data.map((model) => model.id)).toEqual(["gpt-5.5", "tammao/gpt-5.5"]);
    expect(data.data.find((model) => model.id === "tammao/gpt-5.5")).toMatchObject({
      provider: "tammao",
      root: "gpt-5.5",
      parent: "gpt-5.5",
      models: ["tammao/gpt-5.5"],
    });
  });

  it("returns server error payload when combo loading fails", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockRejectedValue(new Error("db down")),
      getSettings: vi.fn().mockResolvedValue({ hiddenModels: [] }),
    }));

    vi.doMock("open-sse/config/models.js", () => ({
      getModelInfo: vi.fn(() => ({ type: ["chat"], contextWindow: 200000 })),
    }));

    const { GET } = await import("@/app/api/v1/models/info/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
  });

  it("handles CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/v1/models/info/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });
});
