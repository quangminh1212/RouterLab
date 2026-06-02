import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/models/catalog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("groups v1 models by provider", async () => {
    vi.doMock("@/app/api/v1/models/route", () => ({
      GET: vi.fn().mockResolvedValue(Response.json({
        object: "list",
        data: [
          { id: "combo-a", owned_by: "combo", root: "Combo A" },
          { id: "alias-a", owned_by: "alias", root: "Combo A", custom: true, type: "chat" },
          { id: "mystery", owned_by: "", root: "Mystery" },
        ],
      }, { headers: { "X-Model-Catalog-Version": "test-version" } })),
    }));

    const { GET } = await import("@/app/api/models/catalog/route");
    const response = await GET(new Request("http://localhost/api/models/catalog"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.catalogVersion).toBe("test-version");
    expect(data.catalog.combo.models.map((model) => model.id)).toEqual(["combo-a"]);
    expect(data.catalog.alias.models[0]).toMatchObject({ id: "alias-a", custom: true, type: "chat" });
    expect(data.catalog.unknown.active).toBe(false);
  });

  it("passes through upstream errors", async () => {
    vi.doMock("@/app/api/v1/models/route", () => ({
      GET: vi.fn().mockResolvedValue(Response.json({ error: { message: "boom" } }, { status: 503 })),
    }));

    const { GET } = await import("@/app/api/models/catalog/route");
    const response = await GET(new Request("http://localhost/api/models/catalog"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: { message: "boom" } });
  });
});
