import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/responses error normalization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("normalizes non-json upstream error into standard error payload", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({
      handleChat: vi.fn().mockResolvedValue(new Response("gateway exploded", {
        status: 502,
        headers: { "content-type": "text/plain" },
      })),
    }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/responses/route");
    const response = await POST(new Request("http://localhost/api/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openclaw", input: "hi" }),
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "gateway exploded",
        type: "upstream_error",
      },
    });
  });

  it("normalizes invalid json success payload into standard error payload", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({
      handleChat: vi.fn().mockResolvedValue(new Response("not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      })),
    }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/responses/route");
    const response = await POST(new Request("http://localhost/api/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openclaw", input: "hi" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Invalid upstream responses payload",
        type: "invalid_response",
      },
    });
  });
});
