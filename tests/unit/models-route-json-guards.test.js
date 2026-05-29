import { beforeEach, describe, expect, it, vi } from "vitest";

describe("models route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("PUT /api/models rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ getModelAliases: vi.fn(), setModelAlias: vi.fn() }));
    vi.doMock("@/lib/localDb", () => ({ getCombos: vi.fn(), getSettings: vi.fn() }));
    const { PUT } = await import("@/app/api/models/route");
    const response = await PUT(new Request("http://localhost/api/models", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PUT /api/models/alias rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getModelAliases: vi.fn(), setModelAlias: vi.fn(), deleteModelAlias: vi.fn() }));
    const { PUT } = await import("@/app/api/models/alias/route");
    const response = await PUT(new Request("http://localhost/api/models/alias", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/models/custom rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ getCustomModels: vi.fn(), addCustomModel: vi.fn(), deleteCustomModel: vi.fn() }));
    const { POST } = await import("@/app/api/models/custom/route");
    const response = await POST(new Request("http://localhost/api/models/custom", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });


  it("POST /api/models/disabled rejects invalid json", async () => {
    vi.doMock("@/lib/disabledModelsDb", () => ({ getDisabledModels: vi.fn(), disableModels: vi.fn(), enableModels: vi.fn() }));
    const { POST } = await import("@/app/api/models/disabled/route");
    const response = await POST(new Request("http://localhost/api/models/disabled", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/models/availability rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getProviderConnections: vi.fn(), updateProviderConnection: vi.fn() }));
    const { POST } = await import("@/app/api/models/availability/route");
    const response = await POST(new Request("http://localhost/api/models/availability", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/models/test rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getApiKeys: vi.fn(), getProviderNodes: vi.fn() }));
    vi.doMock("@/sse/services/model", () => ({ getModelInfo: vi.fn() }));
    const { POST } = await import("@/app/api/models/test/route");
    const response = await POST(new Request("http://localhost/api/models/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
