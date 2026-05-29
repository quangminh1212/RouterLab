import { beforeEach, describe, expect, it, vi } from "vitest";

describe("cloud auth API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns sorted active connections and aliases for valid API key", async () => {
    vi.doMock("@/models", () => ({
      parseBearerToken: vi.fn(() => "valid"),
      validateApiKey: vi.fn().mockResolvedValue(true),
      getProviderConnections: vi.fn().mockResolvedValue([
        { provider: "openai", authType: "apikey", apiKey: "k1", isActive: true, priority: 2 },
        { provider: "anthropic", authType: "oauth", accessToken: "t1", isActive: true, priority: 1 },
        { provider: "openai", authType: "oauth", accessToken: "t2", isActive: true, priority: 3 },
      ]),
      getModelAliases: vi.fn().mockResolvedValue({ zebra: "z/model", alpha: "a/model" }),
    }));

    const { POST } = await import("@/app/api/cloud/auth/route");
    const response = await POST(new Request("http://localhost/api/cloud/auth", {
      method: "POST",
      headers: { Authorization: "Bearer valid" },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.connections.map((item) => `${item.provider}:${item.authType}`)).toEqual([
      "anthropic:oauth",
      "openai:apikey",
      "openai:oauth",
    ]);
    expect(Object.keys(data.modelAliases)).toEqual(["alpha", "zebra"]);
  });

  it("rejects missing API key", async () => {
    vi.doMock("@/models", () => ({
      parseBearerToken: vi.fn(() => ""),
      validateApiKey: vi.fn(),
      getProviderConnections: vi.fn(),
      getModelAliases: vi.fn(),
    }));

    const { POST } = await import("@/app/api/cloud/auth/route");
    const response = await POST(new Request("http://localhost/api/cloud/auth", { method: "POST" }));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.message).toMatch(/missing api key/i);
  });
});
