import { beforeEach, describe, expect, it, vi } from "vitest";

describe("cloud route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("PUT /api/cloud/models/alias returns standard error for invalid json", async () => {
    vi.doMock("@/models", () => ({
      validateApiKey: vi.fn().mockResolvedValue(true),
      getModelAliases: vi.fn(),
      setModelAlias: vi.fn(),
      parseBearerToken: vi.fn().mockReturnValue("key"),
    }));

    const { PUT } = await import("@/app/api/cloud/models/alias/route");
    const response = await PUT(new Request("http://localhost/api/cloud/models/alias", {
      method: "PUT",
      headers: { authorization: "Bearer key", "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Invalid JSON body", type: "invalid_request_error" },
    });
  });

  it("POST /api/cloud/model/resolve returns standard error for invalid json", async () => {
    vi.doMock("@/models", () => ({
      validateApiKey: vi.fn(),
      getModelAliases: vi.fn(),
      parseBearerToken: vi.fn().mockReturnValue("key"),
    }));

    const { POST } = await import("@/app/api/cloud/model/resolve/route");
    const response = await POST(new Request("http://localhost/api/cloud/model/resolve", {
      method: "POST",
      headers: { authorization: "Bearer key", "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Invalid JSON body", type: "invalid_request_error" },
    });
  });

  it("PUT /api/cloud/credentials/update returns standard error for invalid json", async () => {
    vi.doMock("@/models", () => ({
      validateApiKey: vi.fn(),
      getProviderConnections: vi.fn(),
      updateProviderConnection: vi.fn(),
      parseBearerToken: vi.fn().mockReturnValue("key"),
    }));

    const { PUT } = await import("@/app/api/cloud/credentials/update/route");
    const response = await PUT(new Request("http://localhost/api/cloud/credentials/update", {
      method: "PUT",
      headers: { authorization: "Bearer key", "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Invalid JSON body", type: "invalid_request_error" },
    });
  });
});
