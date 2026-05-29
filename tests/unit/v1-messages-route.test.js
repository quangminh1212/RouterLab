import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/messages", () => {
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

    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/messages/route");
    const request = new Request("http://localhost/api/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "claude", messages: [{ role: "user", content: "hi" }] }),
    });

    await Promise.all([POST(request.clone()), POST(request.clone()), POST(request.clone())]);

    expect(initTranslators).toHaveBeenCalledTimes(1);
    expect(handleChat).toHaveBeenCalledTimes(3);
  });

  it("returns standard error payload for invalid json", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/messages/route");
    const response = await POST(new Request("http://localhost/api/v1/messages", {
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
  });

  it("normalizes model and numeric fields before forwarding", async () => {
    const handleChat = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/messages/route");
    await POST(new Request("http://localhost/api/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "  claude-3-5-sonnet  ",
        max_tokens: "512",
        temperature: "1.2",
        top_p: "0.8",
        metadata: "bad-metadata",
        messages: [{ role: "user", content: "hi" }],
      }),
    }));

    const forwardedRequest = handleChat.mock.calls[0][0];
    const forwardedBody = await forwardedRequest.json();
    expect(forwardedBody).toMatchObject({
      model: "claude-3-5-sonnet",
      max_tokens: 512,
      temperature: 1.2,
      top_p: 0.8,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(forwardedBody).not.toHaveProperty("metadata");
  });
});
