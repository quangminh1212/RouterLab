import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/models/disabled", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies disabled models payload with CORS headers", async () => {
    vi.doMock("@/app/api/models/disabled/route", () => ({
      GET: vi.fn(async () => Response.json({ disabled: { openai: ["gpt-4.1"] } }, { status: 200 })),
    }));

    const { GET } = await import("@/app/api/v1/models/disabled/route");
    const response = await GET(new Request("http://localhost/api/v1/models/disabled"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.disabled).toEqual({ openai: ["gpt-4.1"] });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("preserves providerAlias query behavior", async () => {
    vi.doMock("@/app/api/models/disabled/route", () => ({
      GET: vi.fn(async () => Response.json({ ids: ["gpt-4.1"] }, { status: 200 })),
    }));

    const { GET } = await import("@/app/api/v1/models/disabled/route");
    const response = await GET(new Request("http://localhost/api/v1/models/disabled?providerAlias=openai"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ids).toEqual(["gpt-4.1"]);
  });

  it("handles CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/v1/models/disabled/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });
});
