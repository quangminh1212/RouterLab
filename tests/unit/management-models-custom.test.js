import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management custom models API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies custom model listing for localhost", async () => {
    const internalGet = vi.fn(async () => Response.json({ models: [{ providerAlias: "openai", id: "my-model", type: "llm" }] }));
    vi.doMock("@/app/api/models/custom/route", () => ({
      GET: internalGet,
      POST: vi.fn(),
      DELETE: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/custom/route");
    const request = new Request("http://localhost/api/management/models/custom", { headers: { host: "localhost" } });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.models).toEqual([{ providerAlias: "openai", id: "my-model", type: "llm" }]);
    expect(internalGet).toHaveBeenCalledWith(request);
  });

  it("proxies custom model creation for localhost", async () => {
    const internalPost = vi.fn(async () => Response.json({ success: true, added: { providerAlias: "openai", id: "my-model", type: "llm" } }));
    vi.doMock("@/app/api/models/custom/route", () => ({
      GET: vi.fn(),
      POST: internalPost,
      DELETE: vi.fn(),
    }));

    const { POST } = await import("@/app/api/management/models/custom/route");
    const request = new Request("http://127.0.0.1/api/management/models/custom", {
      method: "POST",
      headers: { host: "127.0.0.1" },
      body: JSON.stringify({ providerAlias: "openai", id: "my-model", type: "llm" }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(internalPost).toHaveBeenCalledWith(request);
  });

  it("rejects remote requests", async () => {
    vi.doMock("@/app/api/models/custom/route", () => ({
      GET: vi.fn(),
      POST: vi.fn(),
      DELETE: vi.fn(),
    }));

    const { DELETE } = await import("@/app/api/management/models/custom/route");
    const response = await DELETE(new Request("http://example.com/api/management/models/custom?providerAlias=openai&id=my-model", { headers: { host: "example.com" } }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });
});
