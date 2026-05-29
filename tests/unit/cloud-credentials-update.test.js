import { beforeEach, describe, expect, it, vi } from "vitest";

describe("cloud credentials update API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("updates trimmed credential fields for active provider", async () => {
    const updateProviderConnection = vi.fn().mockResolvedValue(true);
    vi.doMock("@/models", () => ({
      parseBearerToken: vi.fn(() => "valid"),
      validateApiKey: vi.fn().mockResolvedValue(true),
      getProviderConnections: vi.fn().mockResolvedValue([{ id: "conn-1", provider: "openai", isActive: true }]),
      updateProviderConnection,
    }));

    const { PUT } = await import("@/app/api/cloud/credentials/update/route");
    const response = await PUT(new Request("http://localhost/api/cloud/credentials/update", {
      method: "PUT",
      headers: { Authorization: "Bearer valid" },
      body: JSON.stringify({
        provider: " openai ",
        credentials: {
          accessToken: " token-1 ",
          refreshToken: " refresh-1 ",
          expiresIn: "3600",
        },
      }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateProviderConnection).toHaveBeenCalledTimes(1);
    const [, updateData] = updateProviderConnection.mock.calls[0];
    expect(updateData.accessToken).toBe("token-1");
    expect(updateData.refreshToken).toBe("refresh-1");
    expect(typeof updateData.expiresAt).toBe("string");
  });

  it("rejects invalid credentials payload shapes", async () => {
    vi.doMock("@/models", () => ({
      parseBearerToken: vi.fn(() => "valid"),
      validateApiKey: vi.fn().mockResolvedValue(true),
      getProviderConnections: vi.fn(),
      updateProviderConnection: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/cloud/credentials/update/route");
    const response = await PUT(new Request("http://localhost/api/cloud/credentials/update", {
      method: "PUT",
      headers: { Authorization: "Bearer valid" },
      body: JSON.stringify({ provider: "openai", credentials: ["bad"] }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toMatch(/provider and credentials required/i);
  });

  it("rejects requests without valid credential fields", async () => {
    vi.doMock("@/models", () => ({
      parseBearerToken: vi.fn(() => "valid"),
      validateApiKey: vi.fn().mockResolvedValue(true),
      getProviderConnections: vi.fn().mockResolvedValue([{ id: "conn-1", provider: "openai", isActive: true }]),
      updateProviderConnection: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/cloud/credentials/update/route");
    const response = await PUT(new Request("http://localhost/api/cloud/credentials/update", {
      method: "PUT",
      headers: { Authorization: "Bearer valid" },
      body: JSON.stringify({ provider: "openai", credentials: { expiresIn: 0 } }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toMatch(/no valid credential fields/i);
  });
  it("rejects providers containing control characters", async () => {
    vi.doMock("@/models", () => ({
      parseBearerToken: vi.fn(() => "valid"),
      validateApiKey: vi.fn().mockResolvedValue(true),
      getProviderConnections: vi.fn(),
      updateProviderConnection: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/cloud/credentials/update/route");
    const response = await PUT(new Request("http://localhost/api/cloud/credentials/update", {
      method: "PUT",
      headers: { Authorization: "Bearer valid" },
      body: JSON.stringify({ provider: "openai\nadmin", credentials: { accessToken: "token" } }),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.message).toMatch(/invalid provider/i);
  });

});
