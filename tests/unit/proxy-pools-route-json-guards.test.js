import { beforeEach, describe, expect, it, vi } from "vitest";

describe("proxy pools route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/proxy-pools rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ createProxyPool: vi.fn(), getProviderConnections: vi.fn(), getProxyPools: vi.fn() }));
    const { POST } = await import("@/app/api/proxy-pools/route");
    const response = await POST(new Request("http://localhost/api/proxy-pools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PUT /api/proxy-pools/[id] rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ deleteProxyPool: vi.fn(), getProviderConnections: vi.fn(), getProxyPoolById: vi.fn(async () => ({ id: "1" })), updateProxyPool: vi.fn() }));
    const { PUT } = await import("@/app/api/proxy-pools/[id]/route");
    const response = await PUT(new Request("http://localhost/api/proxy-pools/1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
