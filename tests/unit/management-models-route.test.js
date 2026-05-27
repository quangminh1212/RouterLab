import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management models API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies models listing for localhost", async () => {
    const internalGet = vi.fn(async () => Response.json({ models: [{ provider: "combo", model: "balanced", alias: "balanced" }] }));
    vi.doMock("@/app/api/models/route", () => ({
      GET: internalGet,
      PUT: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/route");
    const request = new Request("http://localhost/api/management/models", { headers: { host: "localhost" } });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.models).toEqual([{ provider: "combo", model: "balanced", alias: "balanced" }]);
    expect(internalGet).toHaveBeenCalledWith(request);
  });

  it("proxies alias updates for localhost", async () => {
    const internalPut = vi.fn(async () => Response.json({ success: true, model: "balanced", alias: "smart" }));
    vi.doMock("@/app/api/models/route", () => ({
      GET: vi.fn(),
      PUT: internalPut,
    }));

    const { PUT } = await import("@/app/api/management/models/route");
    const request = new Request("http://127.0.0.1/api/management/models", {
      method: "PUT",
      headers: { host: "127.0.0.1" },
      body: JSON.stringify({ model: "balanced", alias: "smart" }),
    });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(internalPut).toHaveBeenCalledWith(request);
  });

  it("rejects remote requests", async () => {
    const internalGet = vi.fn();
    vi.doMock("@/app/api/models/route", () => ({
      GET: internalGet,
      PUT: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/route");
    const response = await GET(new Request("http://example.com/api/management/models", { headers: { host: "example.com" } }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
    expect(internalGet).not.toHaveBeenCalled();
  });
});
