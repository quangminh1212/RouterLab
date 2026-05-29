import { beforeEach, describe, expect, it, vi } from "vitest";

describe("settings/translator/sync json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("PATCH /api/settings rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
    vi.doMock("@/lib/network/outboundProxy", () => ({ applyOutboundProxyEnv: vi.fn() }));
    vi.doMock("open-sse/services/combo.js", () => ({ resetComboRotation: vi.fn() }));

    const { PATCH } = await import("@/app/api/settings/route");
    const response = await PATCH(new Request("http://localhost/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/translator/send rejects invalid json", async () => {
    vi.doMock("@/lib/localDb.js", () => ({ getProviderConnections: vi.fn() }));
    vi.doMock("open-sse/index.js", () => ({ getExecutor: vi.fn(), refreshTokenByProvider: vi.fn() }));

    const { POST } = await import("@/app/api/translator/send/route");
    const response = await POST(new Request("http://localhost/api/translator/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Invalid JSON body" });
  });

  it("POST /api/translator/save rejects invalid json", async () => {
    const { POST } = await import("@/app/api/translator/save/route");
    const response = await POST(new Request("http://localhost/api/translator/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Invalid JSON body" });
  });

  it("POST /api/translator/translate rejects invalid json", async () => {
    vi.doMock("open-sse/services/provider.js", () => ({ detectFormat: vi.fn(), getTargetFormat: vi.fn() }));
    vi.doMock("open-sse/translator/index.js", () => ({ translateRequest: vi.fn() }));
    vi.doMock("open-sse/translator/formats.js", () => ({ FORMATS: { OPENAI: "openai" } }));
    vi.doMock("open-sse/services/model.js", () => ({ parseModel: vi.fn() }));
    vi.doMock("@/lib/localDb.js", () => ({ getProviderConnections: vi.fn() }));
    vi.doMock("open-sse/executors/index.js", () => ({ getExecutor: vi.fn() }));

    const { POST } = await import("@/app/api/translator/translate/route");
    const response = await POST(new Request("http://localhost/api/translator/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: "Invalid JSON body" });
  });

  it("POST /api/sync/cloud rejects non-object json", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getApiKeys: vi.fn(),
      getProviderConnections: vi.fn(),
      getSettings: vi.fn(),
      getProviderNodes: vi.fn(),
      getCombos: vi.fn(),
    }));
    vi.doMock("@/shared/utils/machineId", () => ({ getConsistentMachineId: vi.fn() }));

    const { POST } = await import("@/app/api/sync/cloud/route");
    const response = await POST(new Request("http://localhost/api/sync/cloud", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([1, 2, 3]),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
