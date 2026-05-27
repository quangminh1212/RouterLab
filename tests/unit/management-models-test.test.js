import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management model test API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies model test for localhost", async () => {
    const internalPost = vi.fn(async () => Response.json({ ok: true, latencyMs: 12, error: null, status: 200 }));
    vi.doMock("@/app/api/models/test/route", () => ({
      POST: internalPost,
    }));

    const { POST } = await import("@/app/api/management/models/test/route");
    const request = new Request("http://localhost/api/management/models/test", {
      method: "POST",
      headers: { host: "localhost" },
      body: JSON.stringify({ model: "gpt-4.1" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(internalPost).toHaveBeenCalledWith(request);
  });

  it("rejects remote requests", async () => {
    const internalPost = vi.fn();
    vi.doMock("@/app/api/models/test/route", () => ({
      POST: internalPost,
    }));

    const { POST } = await import("@/app/api/management/models/test/route");
    const response = await POST(new Request("http://example.com/api/management/models/test", {
      method: "POST",
      headers: { host: "example.com" },
      body: JSON.stringify({ model: "gpt-4.1" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
    expect(internalPost).not.toHaveBeenCalled();
  });
});
