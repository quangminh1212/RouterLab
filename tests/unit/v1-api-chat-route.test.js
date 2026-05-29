import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/api/chat", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("initializes translators only once for concurrent requests", async () => {
    const initTranslators = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });
    const handleChat = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const transformToOllama = vi.fn((response) => response);

    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators }));
    vi.doMock("open-sse/utils/ollamaTransform.js", () => ({ transformToOllama }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/api/chat/route");
    const request = new Request("http://localhost/api/v1/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "llama3.2", messages: [{ role: "user", content: "hi" }] }),
    });

    await Promise.all([POST(request.clone()), POST(request.clone()), POST(request.clone())]);

    expect(initTranslators).toHaveBeenCalledTimes(1);
    expect(handleChat).toHaveBeenCalledTimes(3);
    expect(transformToOllama).toHaveBeenCalledTimes(3);
  });

  it("returns standard error payload for invalid json", async () => {
    const transformToOllama = vi.fn((response) => response);
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("open-sse/utils/ollamaTransform.js", () => ({ transformToOllama }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/api/chat/route");
    const response = await POST(new Request("http://localhost/api/v1/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Invalid JSON body",
        type: "invalid_request_error",
      },
    });
    expect(transformToOllama).not.toHaveBeenCalled();
  });

  it("normalizes model and numeric options before forwarding", async () => {
    const handleChat = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    const transformToOllama = vi.fn((response) => response);
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("open-sse/utils/ollamaTransform.js", () => ({ transformToOllama }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/api/chat/route");
    await POST(new Request("http://localhost/api/v1/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "  llama3.2  ",
        options: { num_predict: "256", temperature: "1.3" },
        messages: [{ role: "user", content: "hi" }],
      }),
    }));

    const forwardedBody = await handleChat.mock.calls[0][0].json();
    expect(forwardedBody).toMatchObject({
      model: "llama3.2",
      options: { num_predict: 256, temperature: 1.3 },
      messages: [{ role: "user", content: "hi" }],
    });
  });
});
