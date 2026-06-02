import { beforeEach, describe, expect, it, vi } from "vitest";

describe("keys route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/keys rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getApiKeys: vi.fn(), createApiKey: vi.fn(), getApiKeySpentCost: vi.fn() }));
    vi.doMock("@/shared/utils/machineId", () => ({ getConsistentMachineId: vi.fn() }));
    const { POST } = await import("@/app/api/keys/route");
    const response = await POST(new Request("http://localhost/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/keys forwards custom apiKey", async () => {
    const createApiKey = vi.fn().mockResolvedValue({
      key: "demo-ABCdef123456",
      name: "Custom",
      id: "k1",
      machineId: "machine-1",
      costLimit: null,
      allowedModels: null,
      rpmLimit: null,
    });
    vi.doMock("@/lib/localDb", () => ({ getApiKeys: vi.fn(), createApiKey, getApiKeySpentCost: vi.fn() }));
    vi.doMock("@/shared/utils/machineId", () => ({ getConsistentMachineId: vi.fn().mockResolvedValue("machine-1") }));
    const { POST } = await import("@/app/api/keys/route");
    const response = await POST(new Request("http://localhost/api/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Custom", apiKey: " demo-ABCdef123456 " }),
    }));

    expect(createApiKey).toHaveBeenCalledWith("Custom", "machine-1", null, null, null, "demo-ABCdef123456");
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ key: "demo-ABCdef123456", id: "k1" });
  });

  it("PUT /api/keys/[id] rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ deleteApiKey: vi.fn(), getApiKeyById: vi.fn(), updateApiKey: vi.fn() }));
    const { PUT } = await import("@/app/api/keys/[id]/route");
    const response = await PUT(new Request("http://localhost/api/keys/1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
