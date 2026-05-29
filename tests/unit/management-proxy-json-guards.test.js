import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management/proxy json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("PUT /api/management/model-mappings rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
    const { PUT } = await import("@/app/api/management/model-mappings/route");
    const response = await PUT(new Request("http://localhost/api/management/model-mappings", {
      method: "PUT",
      headers: { host: "localhost", "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PATCH /api/management/model-mappings rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
    const { PATCH } = await import("@/app/api/management/model-mappings/route");
    const response = await PATCH(new Request("http://localhost/api/management/model-mappings", {
      method: "PATCH",
      headers: { host: "localhost", "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/proxy-pools/vercel-deploy rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ createProxyPool: vi.fn() }));
    const { POST } = await import("@/app/api/proxy-pools/vercel-deploy/route");
    const response = await POST(new Request("http://localhost/api/proxy-pools/vercel-deploy", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
