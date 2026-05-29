import { beforeEach, describe, expect, it, vi } from "vitest";

describe("provider validation json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/provider-nodes/validate rejects invalid json", async () => {
    const { POST } = await import("@/app/api/provider-nodes/validate/route");
    const response = await POST(new Request("http://localhost/api/provider-nodes/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/providers/validate rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getProviderConnections: vi.fn(), updateProviderConnection: vi.fn() }));
    vi.doMock("@/shared/constants/providers", () => ({
      COMPATIBLE_OPENAI_PROVIDERS: {},
      COMPATIBLE_ANTHROPIC_PROVIDERS: {},
      FREE_TIER_PROVIDERS: {},
      WEB_COOKIE_PROVIDERS: {},
      APIKEY_PROVIDERS: {},
      isOpenAICompatibleProvider: vi.fn(() => false),
      isAnthropicCompatibleProvider: vi.fn(() => false),
    }));
    vi.doMock("@/shared/constants/config", () => ({ APIKEY_PROVIDERS: {} }));
    const { POST } = await import("@/app/api/providers/validate/route");
    const response = await POST(new Request("http://localhost/api/providers/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/providers/test-batch rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getProviderConnections: vi.fn() }));
    vi.doMock("@/lib/providerTester", () => ({ testSingleConnection: vi.fn(), fetchCompatibleModels: vi.fn() }));
    vi.doMock("@/shared/constants/providers", () => ({
      isCompatibleProvider: vi.fn(() => false),
      getAuthGroup: vi.fn(() => "apikey"),
    }));
    const { POST } = await import("@/app/api/providers/test-batch/route");
    const response = await POST(new Request("http://localhost/api/providers/test-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
