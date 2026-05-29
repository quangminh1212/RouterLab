import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1beta/models/[...path] POST hardening", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns standard error payload for invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getCombos: vi.fn(), getSettings: vi.fn() }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

    const { POST } = await import("@/app/api/v1beta/models/[...path]/route");
    const response = await POST(new Request("http://localhost/api/v1beta/models/gemini-pro:generateContent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }), { params: Promise.resolve({ path: ["gemini-pro:generateContent"] }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Invalid JSON body",
        type: "invalid_request_error",
      },
    });
  });

  it("initializes translators only once for concurrent posts", async () => {
    const initTranslators = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });
    const handleChat = vi.fn().mockResolvedValue(Response.json({
      candidates: [{ content: { parts: [{ text: "ok" }] } }],
    }));

    vi.doMock("@/lib/localDb", () => ({ getCombos: vi.fn(), getSettings: vi.fn() }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators }));
    vi.doMock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

    const { POST } = await import("@/app/api/v1beta/models/[...path]/route");
    const request = new Request("http://localhost/api/v1beta/models/gemini-pro:countTokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "hello" }] }] }),
    });
    const params = { params: Promise.resolve({ path: ["gemini-pro:countTokens"] }) };

    await Promise.all([POST(request.clone(), params), POST(request.clone(), params), POST(request.clone(), params)]);

    expect(initTranslators).toHaveBeenCalledTimes(1);
  });
});
