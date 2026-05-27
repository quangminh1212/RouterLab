import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1beta/models/[...path] GET", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns Gemini-compatible model detail for visible combo", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(async () => [
        { name: "gemini-pro", showInModelsEndpoint: true },
      ]),
      getSettings: vi.fn(async () => ({ hiddenModels: [] })),
    }));

    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn() }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), error: vi.fn() },
    }));

    const { GET } = await import("@/app/api/v1beta/models/[...path]/route");
    const response = await GET(new Request("http://localhost/api/v1beta/models/gemini-pro"), {
      params: Promise.resolve({ path: ["gemini-pro"] }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      name: "models/gemini-pro",
      displayName: "gemini-pro",
      supportedGenerationMethods: ["generateContent"],
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 404 for hidden or unknown models", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(async () => [
        { name: "hidden-model", showInModelsEndpoint: true },
      ]),
      getSettings: vi.fn(async () => ({ hiddenModels: ["hidden-model"] })),
    }));

    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn() }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), error: vi.fn() },
    }));

    const { GET } = await import("@/app/api/v1beta/models/[...path]/route");
    const response = await GET(new Request("http://localhost/api/v1beta/models/hidden-model"), {
      params: Promise.resolve({ path: ["hidden-model"] }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.message).toMatch(/Model not found/i);
  });

  it("supports provider-scoped model paths", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(async () => [
        { name: "openai/gpt-4.1", showInModelsEndpoint: true },
      ]),
      getSettings: vi.fn(async () => ({ hiddenModels: [] })),
    }));

    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn() }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("@/lib/logger", () => ({
      logger: { info: vi.fn(), error: vi.fn() },
    }));

    const { GET } = await import("@/app/api/v1beta/models/[...path]/route");
    const response = await GET(new Request("http://localhost/api/v1beta/models/openai/gpt-4.1"), {
      params: Promise.resolve({ path: ["openai", "gpt-4.1"] }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe("models/openai/gpt-4.1");
  });
});
