import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/responses/compact", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("initializes translators only once for concurrent compact requests", async () => {
    const initTranslators = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });
    const handleChat = vi.fn().mockResolvedValue(Response.json({ ok: true }));

    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/responses/compact/route");
    const request = new Request("http://localhost/api/v1/responses/compact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openclaw", input: "hi" }),
    });

    await Promise.all([POST(request.clone()), POST(request.clone()), POST(request.clone())]);

    expect(initTranslators).toHaveBeenCalledTimes(1);
    expect(handleChat).toHaveBeenCalledTimes(3);
  });

  it("returns a standard error payload for invalid json", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/responses/compact/route");
    const response = await POST(new Request("http://localhost/api/v1/responses/compact", {
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

  it("forwards a cloned request with compact marker and normalized fields", async () => {
    const handleChat = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/responses/compact/route");
    await POST(new Request("http://localhost/api/v1/responses/compact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "  openclaw  ", user: "  tester  ", input: "hi" }),
    }));

    const forwardedRequest = handleChat.mock.calls[0][0];
    await expect(forwardedRequest.json()).resolves.toMatchObject({
      model: "openclaw",
      user: "tester",
      input: "hi",
      _compact: true,
    });
  });
});
