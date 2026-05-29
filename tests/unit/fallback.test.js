import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getOpenAICompatibleType } from "open-sse/services/provider.js";

const originalFetch = global.fetch;

vi.mock("@/models", () => ({
  getProviderNodeById: vi.fn(async () => ({
    id: "openai-compatible-tammao",
    baseUrl: "https://api.cungcapai.io.vn/v1",
    providerSpecificData: { machineId: "tm-machine-id" },
  })),
  getProviderConnectionById: vi.fn(async () => ({
    id: "conn-tammao",
    provider: "openai-compatible-tammao",
    apiKey: "tm-key",
    providerSpecificData: { baseUrl: "https://api.cungcapai.io.vn/v1", machineId: "tm-machine-id" },
  })),
}));

describe("TamMao fallback", () => {
  it("forces chat api for TamMao-compatible responses nodes", () => {
    expect(getOpenAICompatibleType("openai-compatible-responses-tammao", {
      apiType: "responses",
      baseUrl: "https://api.cungcapai.io.vn/v1",
      prefix: "tammao",
      nodeName: "TamMao",
    })).toBe("chat");

    expect(getOpenAICompatibleType("openai-compatible-responses-generic", {
      apiType: "responses",
      baseUrl: "https://example.com/v1",
    })).toBe("responses");
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("validate route falls back to /responses when /models times out", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "resp_1" }) });
    global.fetch = fetchMock;

    const { POST } = await import("@/app/api/providers/validate/route");
    const request = new Request("http://localhost/api/providers/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "openai-compatible-tammao", apiKey: "tm-key" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.valid).toBe(true);
    expect(payload.warning).toContain("fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/responses");
  });

  it("models route returns fallback catalog when /models times out", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "resp_1" }) });
    global.fetch = fetchMock;

    const { GET } = await import("@/app/api/providers/[id]/models/route");
    const response = await GET(new Request("http://localhost/api/providers/conn-tammao/models"), {
      params: Promise.resolve({ id: "conn-tammao" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(payload.models)).toBe(true);
    expect(payload.models[0].id).toBe("gpt-5.5");
    expect(payload.warning).toContain("fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/responses");
  });
});