import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management model visibility API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies hidden models listing for localhost", async () => {
    const internalGet = vi.fn(async () => Response.json({ hiddenModels: ["gpt-4.1"], count: 1 }));
    vi.doMock("@/app/api/models/visibility/route", () => ({
      GET: internalGet,
      PATCH: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/visibility/route");
    const request = new Request("http://localhost/api/management/models/visibility", { headers: { host: "localhost" } });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ hiddenModels: ["gpt-4.1"], count: 1 });
    expect(internalGet).toHaveBeenCalledWith(request);
  });

  it("proxies visibility updates for localhost", async () => {
    const internalPatch = vi.fn(async () => Response.json({ success: true, modelId: "gpt-4.1", visible: false, hiddenCount: 1 }));
    vi.doMock("@/app/api/models/visibility/route", () => ({
      GET: vi.fn(),
      PATCH: internalPatch,
    }));

    const { PATCH } = await import("@/app/api/management/models/visibility/route");
    const request = new Request("http://127.0.0.1/api/management/models/visibility", {
      method: "PATCH",
      headers: { host: "127.0.0.1" },
      body: JSON.stringify({ modelId: "gpt-4.1", visible: false }),
    });
    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(internalPatch).toHaveBeenCalledWith(request);
  });

  it("rejects remote requests", async () => {
    vi.doMock("@/app/api/models/visibility/route", () => ({
      GET: vi.fn(),
      PATCH: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/models/visibility/route");
    const response = await GET(new Request("http://example.com/api/management/models/visibility", { headers: { host: "example.com" } }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });
});
