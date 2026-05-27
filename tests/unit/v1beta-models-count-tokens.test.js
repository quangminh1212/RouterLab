import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1beta/models/[...path] POST :countTokens", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns Gemini-style token count for plain model path", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(),
      getSettings: vi.fn(),
    }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn() }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

    const { POST } = await import("@/app/api/v1beta/models/[...path]/route");
    const response = await POST(new Request("http://localhost/api/v1beta/models/gemini-pro:countTokens", {
      method: "POST",
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "hello world" }] }],
      }),
    }), {
      params: Promise.resolve({ path: ["gemini-pro:countTokens"] }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalTokens).toBe(3);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("supports provider-scoped model path for countTokens", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(),
      getSettings: vi.fn(),
    }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn() }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

    const { POST } = await import("@/app/api/v1beta/models/[...path]/route");
    const response = await POST(new Request("http://localhost/api/v1beta/models/openai/gpt-4.1:countTokens", {
      method: "POST",
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "abcd" }, { text: "efgh" }] }],
      }),
    }), {
      params: Promise.resolve({ path: ["openai", "gpt-4.1:countTokens"] }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalTokens).toBe(3);
  });

  it("returns zero tokens for empty contents", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(),
      getSettings: vi.fn(),
    }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn() }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

    const { POST } = await import("@/app/api/v1beta/models/[...path]/route");
    const response = await POST(new Request("http://localhost/api/v1beta/models/gemini-pro:countTokens", {
      method: "POST",
      body: JSON.stringify({}),
    }), {
      params: Promise.resolve({ path: ["gemini-pro:countTokens"] }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalTokens).toBe(0);
  });
});
