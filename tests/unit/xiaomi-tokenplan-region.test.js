import { beforeEach, describe, expect, it, vi } from "vitest";

describe("xiaomi token plan region parity", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/providers stores xiaomi-tokenplan region and baseUrl", async () => {
    const createProviderConnection = vi.fn(async (payload) => ({ id: "conn-1", ...payload }));
    vi.doMock("@/models", () => ({
      getProviderConnections: vi.fn(async () => []),
      createProviderConnection,
      getProviderNodeById: vi.fn(),
      getProviderNodes: vi.fn(),
      getProxyPoolById: vi.fn(async () => null),
    }));
    vi.doMock("@/shared/constants/config", () => ({ APIKEY_PROVIDERS: { "xiaomi-tokenplan": true } }));
    vi.doMock("@/shared/constants/providers", async () => {
      const actual = await vi.importActual("@/shared/constants/providers");
      return {
        ...actual,
        FREE_TIER_PROVIDERS: { "xiaomi-tokenplan": actual.FREE_TIER_PROVIDERS["xiaomi-tokenplan"] },
        WEB_COOKIE_PROVIDERS: {},
        isOpenAICompatibleProvider: vi.fn(() => false),
        isAnthropicCompatibleProvider: vi.fn(() => false),
        isCustomEmbeddingProvider: vi.fn(() => false),
      };
    });

    const { POST } = await import("@/app/api/providers/route");
    const response = await POST(new Request("http://localhost/api/providers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "xiaomi-tokenplan",
        apiKey: "tp-test",
        name: "Xiaomi Token Plan CN",
        providerSpecificData: { region: "cn" },
      }),
    }));

    expect(response.status).toBe(201);
    expect(createProviderConnection).toHaveBeenCalledOnce();
    expect(createProviderConnection.mock.calls[0][0].providerSpecificData).toMatchObject({
      region: "cn",
      baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    });
  });

  it("POST /api/providers/validate uses region-specific xiaomi-tokenplan endpoint", async () => {
    const fetchMock = vi.fn(async (url) => ({ ok: String(url).includes("token-plan-cn.xiaomimimo.com"), status: 200 }));
    global.fetch = fetchMock;

    const { POST } = await import("@/app/api/providers/validate/route");
    const response = await POST(new Request("http://localhost/api/providers/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "xiaomi-tokenplan",
        apiKey: "tp-test",
        providerSpecificData: { region: "cn" },
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.valid).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toBe("https://token-plan-cn.xiaomimimo.com/v1/models");
  });
});
