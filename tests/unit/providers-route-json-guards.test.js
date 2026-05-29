import { beforeEach, describe, expect, it, vi } from "vitest";

describe("providers route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/providers rejects invalid json", async () => {
    vi.doMock("@/models", () => ({
      getProviderConnections: vi.fn(),
      createProviderConnection: vi.fn(),
      getProviderNodeById: vi.fn(),
      getProviderNodes: vi.fn(),
      getProxyPoolById: vi.fn(),
    }));
    vi.doMock("@/shared/constants/config", () => ({ APIKEY_PROVIDERS: {} }));
    vi.doMock("@/shared/constants/providers", () => ({
      FREE_TIER_PROVIDERS: {},
      WEB_COOKIE_PROVIDERS: {},
      isOpenAICompatibleProvider: vi.fn(() => false),
      isAnthropicCompatibleProvider: vi.fn(() => false),
      isCustomEmbeddingProvider: vi.fn(() => false),
    }));

    const { POST } = await import("@/app/api/providers/route");
    const response = await POST(new Request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PUT /api/providers/[id] rejects invalid json", async () => {
    vi.doMock("@/models", () => ({
      getProviderConnectionById: vi.fn(),
      updateProviderConnection: vi.fn(),
      deleteProviderConnection: vi.fn(),
      getProxyPoolById: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/providers/[id]/route");
    const response = await PUT(
      new Request("http://localhost/api/providers/123", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
      { params: Promise.resolve({ id: "123" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
