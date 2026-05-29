import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/completions auth forwarding", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("uses request origin for internal chat completions proxy", async () => {
    global.fetch.mockResolvedValue(new Response(JSON.stringify({
      id: "chat-1",
      model: "openclaw",
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "") }));

    const { POST } = await import("@/app/api/v1/completions/route");
    await POST(new Request("http://127.0.0.1:1312/api/v1/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "hello" }),
    }));

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:1312/v1/chat/completions");
  });
  it("forwards normalized Bearer token to chat completions", async () => {
    global.fetch.mockResolvedValue(new Response(JSON.stringify({
      id: "chat-1",
      model: "openclaw",
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/completions/route");
    const response = await POST(new Request("http://localhost/api/v1/completions", {
      method: "POST",
      headers: { authorization: "Bearer token-1" },
      body: JSON.stringify({ prompt: "hello" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.object).toBe("text_completion");
    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer token-1");
  });

  it("does not forward invalid authorization headers", async () => {
    global.fetch.mockResolvedValue(new Response(JSON.stringify({
      id: "chat-1",
      model: "openclaw",
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "") }));

    const { POST } = await import("@/app/api/v1/completions/route");
    await POST(new Request("http://localhost/api/v1/completions", {
      method: "POST",
      headers: { authorization: "Basic abc" },
      body: JSON.stringify({ prompt: "hello" }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });
});

