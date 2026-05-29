import { beforeEach, describe, expect, it, vi } from "vitest";

describe("media/search/web route guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("/v1/images/generations rejects invalid json", async () => {
    vi.doMock("@/sse/handlers/imageGeneration.js", () => ({ handleImageGeneration: vi.fn() }));
    const { POST } = await import("@/app/api/v1/images/generations/route");
    const response = await POST(new Request("http://localhost/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
  });

  it("/v1/video/generations rejects invalid json", async () => {
    vi.doMock("@/sse/handlers/imageGeneration.js", () => ({ handleImageGeneration: vi.fn() }));
    const { POST } = await import("@/app/api/v1/video/generations/route");
    const response = await POST(new Request("http://localhost/v1/video/generations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
  });

  it("/v1/web/fetch trims url before forwarding", async () => {
    const handleFetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
    vi.doMock("@/sse/handlers/fetch.js", () => ({ handleFetch }));
    const { POST } = await import("@/app/api/v1/web/fetch/route");
    await POST(new Request("http://localhost/v1/web/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "  https://example.com  " }),
    }));
    await expect(handleFetch.mock.calls[0][0].json()).resolves.toEqual({ url: "https://example.com" });
  });

  it("/v1/search trims query before forwarding", async () => {
    const handleSearch = vi.fn().mockResolvedValue(Response.json({ data: [] }));
    vi.doMock("@/sse/handlers/search.js", () => ({ handleSearch }));
    const { POST } = await import("@/app/api/v1/search/route");
    await POST(new Request("http://localhost/v1/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "  hello world  " }),
    }));
    await expect(handleSearch.mock.calls[0][0].json()).resolves.toEqual({ query: "hello world" });
  });
});
