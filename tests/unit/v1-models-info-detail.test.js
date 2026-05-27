import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/models/info/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns metadata for a visible combo model", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockResolvedValue([
        { name: "xlabrouter/openclaw", kind: "chat", models: ["openclaw"], showInModelsEndpoint: true },
      ]),
      getSettings: vi.fn().mockResolvedValue({ hiddenModels: [] }),
    }));

    vi.doMock("open-sse/config/models.js", () => ({
      getModelInfo: vi.fn(() => ({ type: ["chat", "image"], contextWindow: 123456 })),
    }));

    const { GET } = await import("@/app/api/v1/models/info/[id]/route");
    const response = await GET(new Request("http://localhost/api/v1/models/info/xlabrouter%2Fopenclaw"), {
      params: Promise.resolve({ id: "xlabrouter%2Fopenclaw" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      id: "xlabrouter/openclaw",
      type: ["chat", "image"],
      supports: {
        reasoning: true,
        image: true,
        embedding: false,
        audio: false,
        video: false,
      },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 404 for hidden or unknown models", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn().mockResolvedValue([
        { name: "hidden/model", kind: "chat", models: ["hidden"], showInModelsEndpoint: true },
      ]),
      getSettings: vi.fn().mockResolvedValue({ hiddenModels: ["hidden/model"] }),
    }));

    vi.doMock("open-sse/config/models.js", () => ({
      getModelInfo: vi.fn(() => ({ type: ["chat"], contextWindow: 123456 })),
    }));

    const { GET } = await import("@/app/api/v1/models/info/[id]/route");
    const response = await GET(new Request("http://localhost/api/v1/models/info/hidden%2Fmodel"), {
      params: Promise.resolve({ id: "hidden%2Fmodel" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.message).toMatch(/Model not found/i);
  });

  it("handles preflight", async () => {
    const { OPTIONS } = await import("@/app/api/v1/models/info/[id]/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });
});
