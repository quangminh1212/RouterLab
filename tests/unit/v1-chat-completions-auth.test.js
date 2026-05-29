import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/chat/completions auth forwarding", () => {
  const originalEnv = {
    OPENCLAW_CAPTURE_PROXY: process.env.OPENCLAW_CAPTURE_PROXY,
    OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL: process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OPENCLAW_CAPTURE_PROXY = "true";
    process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL = "https://example.com/v1/chat/completions";
    global.fetch = vi.fn().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
  });

  afterEach(() => {
    process.env.OPENCLAW_CAPTURE_PROXY = originalEnv.OPENCLAW_CAPTURE_PROXY;
    process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL = originalEnv.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL;
  });

  it("does not forward invalid authorization headers to capture proxy", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: "Basic abc",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "openclaw", messages: [{ role: "user", content: "hi" }] }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.get("authorization")).toBeNull();
  });

  it("forwards normalized bearer authorization to capture proxy", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: "Bearer token-1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "openclaw", messages: [{ role: "user", content: "hi" }] }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.get("authorization")).toBe("Bearer token-1");
  });
  it("does not forward cookie, proxy-authorization, origin, or referer headers", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: "Bearer token-1",
        cookie: "sid=abc",
        "proxy-authorization": "Basic secret",
        origin: "https://evil.example",
        referer: "https://evil.example/page",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model: "openclaw", messages: [{ role: "user", content: "hi" }] }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers.get("authorization")).toBe("Bearer token-1");
    expect(init.headers.get("cookie")).toBeNull();
    expect(init.headers.get("proxy-authorization")).toBeNull();
    expect(init.headers.get("origin")).toBeNull();
    expect(init.headers.get("referer")).toBeNull();
  });

});
