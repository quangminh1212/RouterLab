import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/responses input normalization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("normalizes model, user, and numeric fields before forwarding", async () => {
    const handleChat = vi.fn().mockResolvedValue(Response.json({ object: "response", id: "resp_1" }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/responses/route");
    await POST(new Request("http://localhost/api/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "  openclaw  ",
        user: "  tester  ",
        max_output_tokens: "256",
        temperature: "1.5",
        top_p: "0.9",
        input: "hi",
      }),
    }));

    const forwardedRequest = handleChat.mock.calls[0][0];
    await expect(forwardedRequest.json()).resolves.toMatchObject({
      model: "openclaw",
      user: "tester",
      max_output_tokens: 256,
      temperature: 1.5,
      top_p: 0.9,
      input: "hi",
    });
  });

  it("rejects invalid json body with standard error payload", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/responses/route");
    const response = await POST(new Request("http://localhost/api/v1/responses", {
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
});
