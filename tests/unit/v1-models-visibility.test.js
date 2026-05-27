import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/models/visibility", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies hidden models listing with CORS headers", async () => {
    vi.doMock("@/app/api/models/visibility/route", () => ({
      GET: vi.fn(async () => Response.json({ hiddenModels: ["gpt-4.1"], count: 1 }, { status: 200 })),
      PATCH: vi.fn(),
    }));

    const { GET } = await import("@/app/api/v1/models/visibility/route");
    const response = await GET(new Request("http://localhost/api/v1/models/visibility"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.hiddenModels).toEqual(["gpt-4.1"]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("proxies visibility updates with CORS headers", async () => {
    vi.doMock("@/app/api/models/visibility/route", () => ({
      GET: vi.fn(),
      PATCH: vi.fn(async () => Response.json({ success: true, modelId: "gpt-4.1", visible: false, hiddenCount: 1 }, { status: 200 })),
    }));

    const { PATCH } = await import("@/app/api/v1/models/visibility/route");
    const response = await PATCH(new Request("http://localhost/api/v1/models/visibility", {
      method: "PATCH",
      body: JSON.stringify({ modelId: "gpt-4.1", visible: false }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/PATCH/);
  });

  it("handles CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/v1/models/visibility/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
