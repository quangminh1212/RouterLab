import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/models/test", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies model test requests with CORS headers", async () => {
    vi.doMock("@/app/api/models/test/route", () => ({
      POST: vi.fn(async () => Response.json({ ok: true, latencyMs: 10, error: null, status: 200 }, { status: 200 })),
    }));

    const { POST } = await import("@/app/api/v1/models/test/route");
    const response = await POST(new Request("http://localhost/api/v1/models/test", {
      method: "POST",
      body: JSON.stringify({ model: "gpt-4.1" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("preserves error payloads with CORS headers", async () => {
    vi.doMock("@/app/api/models/test/route", () => ({
      POST: vi.fn(async () => Response.json({ ok: false, error: "Model required" }, { status: 400 })),
    }));

    const { POST } = await import("@/app/api/v1/models/test/route");
    const response = await POST(new Request("http://localhost/api/v1/models/test", {
      method: "POST",
      body: JSON.stringify({}),
    }));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/POST/);
  });

  it("handles CORS preflight", async () => {
    const { OPTIONS } = await import("@/app/api/v1/models/test/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
