import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/models", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns visible combos and combo-backed aliases with CORS headers", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(async () => [
        { name: "visible-combo", showInModelsEndpoint: true },
        { name: "hidden-combo", showInModelsEndpoint: true },
        { name: "private-combo", showInModelsEndpoint: false },
      ]),
      getModelAliases: vi.fn(async () => ({
        smart: "visible-combo",
        "visible-combo": "hidden-combo",
        hiddenAlias: "hidden-combo",
        privateAlias: "private-combo",
        danglingAlias: "missing-combo",
      })),
      getSettings: vi.fn(async () => ({ hiddenModels: ["hidden-combo"] })),
    }));
    vi.doMock("@/app/api/models/route", () => ({ PUT: vi.fn() }));

    const { GET } = await import("@/app/api/v1/models/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.map((model) => model.id)).toEqual(["smart", "visible-combo"]);
    expect(data.data.find((model) => model.id === "visible-combo").owned_by).toBe("combo");
    expect(data.data[0]).toMatchObject({ root: "visible-combo", parent: "visible-combo", owned_by: "alias" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("also exposes TamMao upstream model ids for chained routers", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getCombos: vi.fn(async () => [
        { name: "gpt-5.5", showInModelsEndpoint: true, models: ["tammao/gpt-5.5"] },
        { name: "hidden-tammao", showInModelsEndpoint: false, models: ["tammao/hidden"] },
        { name: "other", showInModelsEndpoint: true, models: ["openai/gpt-4o"] },
      ]),
      getModelAliases: vi.fn(async () => ({})),
      getSettings: vi.fn(async () => ({ hiddenModels: [] })),
    }));
    vi.doMock("@/app/api/models/route", () => ({ PUT: vi.fn() }));

    const { GET } = await import("@/app/api/v1/models/route");
    const response = await GET();
    const data = await response.json();

    expect(data.data.map((model) => model.id)).toEqual(["gpt-5.5", "other", "tammao/gpt-5.5"]);
    expect(data.data.find((model) => model.id === "tammao/gpt-5.5")).toMatchObject({
      owned_by: "tammao",
      root: "gpt-5.5",
      parent: "gpt-5.5",
    });
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
