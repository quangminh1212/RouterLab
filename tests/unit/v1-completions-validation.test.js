import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/completions input normalization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "chat-1",
      model: "openclaw",
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("falls back invalid numeric inputs to safe defaults", async () => {
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "") }));

    const { POST } = await import("@/app/api/v1/completions/route");
    await POST(new Request("http://localhost/api/v1/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "hello",
        max_tokens: 0,
        temperature: 9,
        top_p: -1,
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.max_tokens).toBe(1024);
    expect(forwardedBody.temperature).toBeUndefined();
    expect(forwardedBody.top_p).toBeUndefined();
  });

  it("keeps valid numeric inputs", async () => {
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "") }));

    const { POST } = await import("@/app/api/v1/completions/route");
    await POST(new Request("http://localhost/api/v1/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "hello",
        max_tokens: "2048",
        temperature: 1.2,
        top_p: 0.7,
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.max_tokens).toBe(2048);
    expect(forwardedBody.temperature).toBe(1.2);
    expect(forwardedBody.top_p).toBe(0.7);
  });

  it("sanitizes model and user fields before forwarding", async () => {
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "") }));

    const { POST } = await import("@/app/api/v1/completions/route");
    await POST(new Request("http://localhost/api/v1/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: " openclaw ",
        user: " user-1 ",
        prompt: ["hello", "world"],
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.model).toBe("openclaw");
    expect(forwardedBody.user).toBe("user-1");
    expect(forwardedBody.messages).toEqual([{ role: "user", content: "hello\nworld" }]);
  });

  it("drops invalid model and user fields with control chars", async () => {
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "") }));

    const { POST } = await import("@/app/api/v1/completions/route");
    await POST(new Request("http://localhost/api/v1/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openclaw\nadmin",
        user: "user\nadmin",
        prompt: "hello",
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.model).toBe("openclaw");
    expect(forwardedBody.user).toBeUndefined();
  });

});
