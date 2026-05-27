import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/models/[kind]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("filters visible models by requested capability", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockResolvedValue([
        { name: "combo/chat", kind: "chat", models: ["chat-a"], showInModelsEndpoint: true },
        { name: "combo/image", kind: "image", models: ["img-a"], showInModelsEndpoint: true },
        { name: "combo/hidden", kind: "chat", models: ["hidden"], showInModelsEndpoint: true },
      ]),
      getSettings: vi.fn().mockResolvedValue({ hiddenModels: ["combo/hidden"] }),
    }));

    vi.doMock("open-sse/config/models.js", () => ({
      getModelInfo: vi.fn((modelId) => modelId === "combo/image"
        ? { type: ["image"], contextWindow: 4096 }
        : { type: ["chat"], contextWindow: 8192 }),
    }));

    const { GET } = await import("@/app/api/v1/models/[kind]/route");
    const response = await GET(new Request("http://localhost/api/v1/models/image"), {
      params: Promise.resolve({ kind: "image" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.capability).toBe("image");
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe("combo/image");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("supports reasoning alias for chat-capable models", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockResolvedValue([
        { name: "combo/chat", kind: "chat", models: ["chat-a"], showInModelsEndpoint: true },
      ]),
      getSettings: vi.fn().mockResolvedValue({ hiddenModels: [] }),
    }));

    vi.doMock("open-sse/config/models.js", () => ({
      getModelInfo: vi.fn(() => ({ type: ["chat"], contextWindow: 8192 })),
    }));

    const { GET } = await import("@/app/api/v1/models/[kind]/route");
    const response = await GET(new Request("http://localhost/api/v1/models/reasoning"), {
      params: Promise.resolve({ kind: "reasoning" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].supports.reasoning).toBe(true);
  });

  it("rejects unsupported capabilities and handles preflight", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(),
      getSettings: vi.fn(),
    }));
    vi.doMock("open-sse/config/models.js", () => ({
      getModelInfo: vi.fn(),
    }));

    const { GET, OPTIONS } = await import("@/app/api/v1/models/[kind]/route");
    const badResponse = await GET(new Request("http://localhost/api/v1/models/unknown"), {
      params: Promise.resolve({ kind: "unknown" }),
    });
    const badData = await badResponse.json();
    const optionsResponse = await OPTIONS();

    expect(badResponse.status).toBe(400);
    expect(badData.error.message).toMatch(/Unsupported model capability/i);
    expect(optionsResponse.headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });
});
