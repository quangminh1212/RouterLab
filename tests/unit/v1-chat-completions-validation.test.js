import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/chat/completions input normalization", () => {
  const originalEnv = {
    OPENCLAW_CAPTURE_PROXY: process.env.OPENCLAW_CAPTURE_PROXY,
    OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL: process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL,
    OPENCLAW_CAPTURE_PROXY_TOKENS: process.env.OPENCLAW_CAPTURE_PROXY_TOKENS,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.OPENCLAW_CAPTURE_PROXY = "true";
    process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL = "https://example.com/v1/chat/completions";
    process.env.OPENCLAW_CAPTURE_PROXY_TOKENS = "token-1";
    global.fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
  });

  afterEach(() => {
    process.env.OPENCLAW_CAPTURE_PROXY = originalEnv.OPENCLAW_CAPTURE_PROXY;
    process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL = originalEnv.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL;
    process.env.OPENCLAW_CAPTURE_PROXY_TOKENS = originalEnv.OPENCLAW_CAPTURE_PROXY_TOKENS;
  });

  it("normalizes invalid numeric fields before forwarding", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openclaw",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 0,
        max_completion_tokens: -1,
        temperature: 9,
        top_p: -1,
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.max_tokens).toBeUndefined();
    expect(forwardedBody.max_completion_tokens).toBeUndefined();
    expect(forwardedBody.temperature).toBeUndefined();
    expect(forwardedBody.top_p).toBeUndefined();
  });

  it("keeps valid numeric fields before forwarding", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openclaw",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: "2048",
        max_completion_tokens: "4096",
        temperature: 1.1,
        top_p: 0.8,
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.max_tokens).toBe(2048);
    expect(forwardedBody.max_completion_tokens).toBe(4096);
    expect(forwardedBody.temperature).toBe(1.1);
    expect(forwardedBody.top_p).toBe(0.8);
  });

  it("sanitizes malformed message entries before forwarding", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openclaw",
        messages: [
          null,
          "bad",
          { role: " user ", content: "hi" },
          { role: "", content: "missing role" },
          { role: "assistant", content: "ok" },
        ],
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "ok" },
    ]);
  });


  it("sanitizes model, user, and message roles before forwarding", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: " openclaw ",
        user: " user-1 ",
        messages: [
          { role: "user\nadmin", content: "bad" },
          { role: " assistant ", content: "ok" },
        ],
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.model).toBe("openclaw");
    expect(forwardedBody.user).toBe("user-1");
    expect(forwardedBody.messages).toEqual([{ role: "assistant", content: "ok" }]);
  });

  it("drops model and user containing control characters", async () => {
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "openclaw\nadmin",
        user: "user\nadmin",
        messages: [{ role: "user", content: "hi" }],
      }),
    }));

    const [, init] = global.fetch.mock.calls[0];
    const forwardedBody = JSON.parse(init.body);
    expect(forwardedBody.model).toBeUndefined();
    expect(forwardedBody.user).toBeUndefined();
  });

  it("retries malformed HTTP 200 proxy responses as stream", async () => {
    process.env.OPENCLAW_CAPTURE_PROXY = "false";
    const handleChat = vi.fn()
      .mockResolvedValueOnce(new Response("API Error: API returned an empty or malformed response (HTTP 200) - check for a proxy or gateway intercepting the request", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }))
      .mockResolvedValueOnce(new Response([
        'data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1,"model":"openclaw","choices":[{"index":0,"delta":{"content":"Xin ch?o"},"finish_reason":null}]}',
        'data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1,"model":"openclaw","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
        "data: [DONE]",
        "",
      ].join("\n"), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    const response = await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openclaw", messages: [{ role: "user", content: "hi" }] }),
    }));

    expect(handleChat).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(await handleChat.mock.calls[1][0].clone().text());
    expect(retryBody.stream).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      object: "chat.completion",
      choices: [{ message: { role: "assistant", content: "Xin ch?o" } }],
    });
  });

  it("normalizes loose Responses API JSON with SSE done suffix", async () => {
    process.env.OPENCLAW_CAPTURE_PROXY = "false";
    const handleChat = vi.fn().mockResolvedValue(new Response([
      JSON.stringify({
        id: "resp_tammao_1",
        object: "response",
        created_at: 1780135409,
        status: "completed",
        model: "tammao/gpt-5.5",
        output: [{
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "RESPONSES_OK", annotations: [] }],
        }],
        usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
      }),
      "data: [DONE]",
      "",
    ].join("\n"), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.doMock("@/sse/handlers/chat.js", () => ({ handleChat }));
    vi.doMock("open-sse/translator/index.js", () => ({ initTranslators: vi.fn().mockResolvedValue(true) }));
    vi.doMock("@/lib/runtimeGuard", () => ({ withRouteGuard: (_name, handler) => handler }));
    vi.doMock("@/models", () => ({ parseBearerToken: vi.fn(() => "token-1") }));

    const { POST } = await import("@/app/api/v1/chat/completions/route");
    const response = await POST(new Request("http://localhost/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "tammao/gpt-5.5", messages: [{ role: "user", content: "hi" }] }),
    }));

    await expect(response.json()).resolves.toMatchObject({
      object: "chat.completion",
      model: "tammao/gpt-5.5",
      choices: [{ message: { role: "assistant", content: "RESPONSES_OK" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });
  });

});
