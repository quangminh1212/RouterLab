import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management model alias API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies alias listing for localhost", async () => {
    const internalGet = vi.fn(async () => Response.json({ aliases: { sonnet: "anthropic/claude-sonnet-4.5" } }));
    vi.doMock("@/app/api/models/alias/route", () => ({
      GET: internalGet,
      PUT: vi.fn(),
      DELETE: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/alias/route");
    const request = new Request("http://localhost/api/management/models/alias", { headers: { host: "localhost" } });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aliases).toEqual({ sonnet: "anthropic/claude-sonnet-4.5" });
    expect(internalGet).toHaveBeenCalledWith(request);
  });

  it("proxies alias updates for localhost", async () => {
    const internalPut = vi.fn(async () => Response.json({ success: true, model: "anthropic/claude-sonnet-4.5", alias: "sonnet" }));
    vi.doMock("@/app/api/models/alias/route", () => ({
      GET: vi.fn(),
      PUT: internalPut,
      DELETE: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/management/models/alias/route");
    const request = new Request("http://127.0.0.1/api/management/models/alias", {
      method: "PUT",
      headers: { host: "127.0.0.1" },
      body: JSON.stringify({ model: "anthropic/claude-sonnet-4.5", alias: "sonnet" }),
    });
    const response = await PUT(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(internalPut).toHaveBeenCalledWith(request);
  });

  it("rejects remote requests", async () => {
    vi.doMock("@/app/api/models/alias/route", () => ({
      GET: vi.fn(),
      PUT: vi.fn(),
      DELETE: vi.fn(),
    }));

    const { DELETE } = await import("@/app/api/management/models/alias/route");
    const response = await DELETE(new Request("http://example.com/api/management/models/alias?alias=sonnet", { headers: { host: "example.com" } }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });
});
