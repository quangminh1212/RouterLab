import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/models", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns visible OpenAI-compatible models with CORS headers", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(async () => [
        { name: "visible-combo", showInModelsEndpoint: true },
        { name: "hidden-combo", showInModelsEndpoint: true },
        { name: "private-combo", showInModelsEndpoint: false },
      ]),
      getSettings: vi.fn(async () => ({ hiddenModels: ["hidden-combo"] })),
    }));
    vi.doMock("@/app/api/models/route", () => ({ PUT: vi.fn() }));

    const { GET } = await import("@/app/api/v1/models/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.map((model) => model.id)).toEqual(["visible-combo"]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("proxies alias updates with CORS headers", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(),
      getSettings: vi.fn(),
    }));
    vi.doMock("@/app/api/models/route", () => ({
      PUT: vi.fn(async () => Response.json({ success: true, model: "visible-combo", alias: "smart" }, { status: 200 })),
    }));

    const { PUT } = await import("@/app/api/v1/models/route");
    const response = await PUT(new Request("http://localhost/api/v1/models", {
      method: "PUT",
      body: JSON.stringify({ model: "visible-combo", alias: "smart" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/PUT/);
  });

  it("handles CORS preflight with PUT enabled", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(),
      getSettings: vi.fn(),
    }));
    vi.doMock("@/app/api/models/route", () => ({ PUT: vi.fn() }));

    const { OPTIONS } = await import("@/app/api/v1/models/route");
    const response = await OPTIONS();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/PUT/);
  });
});
