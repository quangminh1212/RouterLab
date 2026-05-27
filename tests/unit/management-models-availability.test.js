import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management model availability API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies availability listing for localhost", async () => {
    const internalGet = vi.fn(async () => Response.json({ models: [{ provider: "openai", model: "gpt-4.1", status: "cooldown" }], unavailableCount: 1 }));
    vi.doMock("@/app/api/models/availability/route", () => ({
      GET: internalGet,
      POST: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/availability/route");
    const request = new Request("http://localhost/api/management/models/availability", { headers: { host: "localhost" } });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.unavailableCount).toBe(1);
    expect(data.models[0]).toMatchObject({ provider: "openai", model: "gpt-4.1", status: "cooldown" });
    expect(internalGet).toHaveBeenCalledWith(request);
  });

  it("proxies cooldown clearing for localhost", async () => {
    const internalPost = vi.fn(async () => Response.json({ ok: true }));
    vi.doMock("@/app/api/models/availability/route", () => ({
      GET: vi.fn(),
      POST: internalPost,
    }));

    const { POST } = await import("@/app/api/management/models/availability/route");
    const request = new Request("http://127.0.0.1/api/management/models/availability", {
      method: "POST",
      headers: { host: "127.0.0.1" },
      body: JSON.stringify({ action: "clearCooldown", provider: "openai", model: "gpt-4.1" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(internalPost).toHaveBeenCalledWith(request);
  });

  it("rejects remote requests", async () => {
    vi.doMock("@/app/api/models/availability/route", () => ({
      GET: vi.fn(),
      POST: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/availability/route");
    const response = await GET(new Request("http://example.com/api/management/models/availability", { headers: { host: "example.com" } }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });
});
