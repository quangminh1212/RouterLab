import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/v1/models/availability", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies availability listing with CORS headers", async () => {
    vi.doMock("@/app/api/models/availability/route", () => ({
      GET: vi.fn(async () => Response.json({ models: [{ provider: "openai", model: "gpt-4.1", status: "cooldown" }], unavailableCount: 1 })),
      POST: vi.fn(),
    }));

    const { GET } = await import("@/app/api/v1/models/availability/route");
    const response = await GET(new Request("http://localhost/api/v1/models/availability"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.unavailableCount).toBe(1);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("proxies cooldown clear operations with CORS headers", async () => {
    vi.doMock("@/app/api/models/availability/route", () => ({
      GET: vi.fn(),
      POST: vi.fn(async () => Response.json({ ok: true })),
    }));

    const { POST } = await import("@/app/api/v1/models/availability/route");
    const response = await POST(new Request("http://localhost/api/v1/models/availability", {
      method: "POST",
      body: JSON.stringify({ action: "clearCooldown", provider: "openai", model: "gpt-4.1" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/POST/);
  });

  it("handles CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/v1/models/availability/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
