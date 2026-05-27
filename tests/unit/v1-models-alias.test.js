import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/models/alias", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies alias listing with CORS headers", async () => {
    vi.doMock("@/app/api/models/alias/route", () => ({
      GET: vi.fn(async () => Response.json({ aliases: { sonnet: "anthropic/claude-sonnet-4.5" } }, { status: 200 })),
      PUT: vi.fn(),
      DELETE: vi.fn(),
    }));

    const { GET } = await import("@/app/api/v1/models/alias/route");
    const response = await GET(new Request("http://localhost/api/v1/models/alias"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.aliases).toEqual({ sonnet: "anthropic/claude-sonnet-4.5" });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("proxies alias updates with CORS headers", async () => {
    vi.doMock("@/app/api/models/alias/route", () => ({
      GET: vi.fn(),
      PUT: vi.fn(async () => Response.json({ success: true, model: "anthropic/claude-sonnet-4.5", alias: "sonnet" }, { status: 200 })),
      DELETE: vi.fn(),
    }));

    const { PUT } = await import("@/app/api/v1/models/alias/route");
    const response = await PUT(new Request("http://localhost/api/v1/models/alias", {
      method: "PUT",
      body: JSON.stringify({ model: "anthropic/claude-sonnet-4.5", alias: "sonnet" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/PUT/);
  });

  it("proxies alias deletion and handles preflight", async () => {
    vi.doMock("@/app/api/models/alias/route", () => ({
      GET: vi.fn(),
      PUT: vi.fn(),
      DELETE: vi.fn(async () => Response.json({ success: true }, { status: 200 })),
    }));

    const { DELETE, OPTIONS } = await import("@/app/api/v1/models/alias/route");
    const deleteResponse = await DELETE(new Request("http://localhost/api/v1/models/alias?alias=sonnet", { method: "DELETE" }));
    const deleteData = await deleteResponse.json();
    const optionsResponse = await OPTIONS();

    expect(deleteResponse.status).toBe(200);
    expect(deleteData.success).toBe(true);
    expect(optionsResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
