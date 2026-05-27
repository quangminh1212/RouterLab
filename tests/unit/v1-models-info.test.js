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
        models: ["openclaw"],
      },
    ]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns server error payload when combo loading fails", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockRejectedValue(new Error("db down")),
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
