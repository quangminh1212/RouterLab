import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1beta/models root", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns visible Gemini-compatible models with CORS headers", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(async () => [
        { name: "gemini-pro", showInModelsEndpoint: true },
        { name: "hidden-pro", showInModelsEndpoint: true },
      ]),
      getModelAliases: vi.fn(async () => ({})),
      getSettings: vi.fn(async () => ({ hiddenModels: ["hidden-pro"] })),
    }));

    const { GET } = await import("@/app/api/v1beta/models/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.models).toHaveLength(1);
    expect(data.models[0].name).toBe("models/gemini-pro");
    expect(data.models[0].supportedGenerationMethods).toEqual(["generateContent", "countTokens"]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns error payload with CORS headers", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(async () => {
        throw new Error("boom");
      }),
      getModelAliases: vi.fn(async () => ({})),
      getSettings: vi.fn(async () => ({ hiddenModels: [] })),
    }));

    const { GET } = await import("@/app/api/v1beta/models/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.message).toBe("boom");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("handles CORS preflight", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(),
      getModelAliases: vi.fn(),
      getSettings: vi.fn(),
    }));

    const { OPTIONS } = await import("@/app/api/v1beta/models/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });
});
