import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/models/suggested", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies suggested models payload with CORS headers", async () => {
    vi.doMock("@/app/api/providers/suggested-models/route", () => ({
      GET: vi.fn(async () => Response.json({
        data: [{ id: "openai/gpt-4.1", name: "GPT-4.1", contextLength: 1048576 }],
      }, { status: 200 })),
    }));

    const { GET } = await import("@/app/api/v1/models/suggested/route");
    const request = new Request("http://localhost/api/v1/models/suggested?url=https://api.example.com/models&type=openrouter-free");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([{ id: "openai/gpt-4.1", name: "GPT-4.1", contextLength: 1048576 }]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("preserves backend validation errors", async () => {
    vi.doMock("@/app/api/providers/suggested-models/route", () => ({
      GET: vi.fn(async () => Response.json({ error: "Missing url or type" }, { status: 400 })),
    }));

    const { GET } = await import("@/app/api/v1/models/suggested/route");
    const response = await GET(new Request("http://localhost/api/v1/models/suggested"));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/missing url or type/i);
  });

  it("handles CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/v1/models/suggested/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });
});
