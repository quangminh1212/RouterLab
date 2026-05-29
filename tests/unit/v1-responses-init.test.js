import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/responses initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("initializes translators only once for concurrent requests", async () => {
    const initTranslators = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });
    const handleChat = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ object: "response", id: "resp_1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));

    const { POST } = await import("@/app/api/v1/responses/route");
    const request = new Request("http://localhost/api/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openclaw", input: "hi" }),
    });

    await Promise.all([POST(request.clone()), POST(request.clone()), POST(request.clone())]);

    expect(initTranslators).toHaveBeenCalledTimes(1);
    expect(handleChat).toHaveBeenCalledTimes(3);
  });
});
