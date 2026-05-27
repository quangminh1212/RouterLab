import { beforeEach, describe, expect, it, vi } from "vitest";

describe("/api/v1/models/custom", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("proxies custom model listing with CORS headers", async () => {
    vi.doMock("@/app/api/models/custom/route", () => ({
      GET: vi.fn(async () => Response.json({ models: [{ providerAlias: "openai", id: "my-model", type: "llm" }] }, { status: 200 })),
      POST: vi.fn(),
      DELETE: vi.fn(),
    }));

    const { GET } = await import("@/app/api/v1/models/custom/route");
    const response = await GET(new Request("http://localhost/api/v1/models/custom"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.models).toEqual([{ providerAlias: "openai", id: "my-model", type: "llm" }]);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("proxies custom model creation with CORS headers", async () => {
    vi.doMock("@/app/api/models/custom/route", () => ({
      GET: vi.fn(),
      POST: vi.fn(async () => Response.json({ success: true, added: { providerAlias: "openai", id: "my-model", type: "llm" } }, { status: 200 })),
      DELETE: vi.fn(),
    }));

    const { POST } = await import("@/app/api/v1/models/custom/route");
    const response = await POST(new Request("http://localhost/api/v1/models/custom", {
      method: "POST",
      body: JSON.stringify({ providerAlias: "openai", id: "my-model", type: "llm" }),
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/POST/);
  });

  it("proxies custom model deletion and handles preflight", async () => {
    vi.doMock("@/app/api/models/custom/route", () => ({
      GET: vi.fn(),
      POST: vi.fn(),
      DELETE: vi.fn(async () => Response.json({ success: true }, { status: 200 })),
    }));

    const { DELETE, OPTIONS } = await import("@/app/api/v1/models/custom/route");
    const deleteResponse = await DELETE(new Request("http://localhost/api/v1/models/custom?providerAlias=openai&id=my-model", { method: "DELETE" }));
    const deleteData = await deleteResponse.json();
    const optionsResponse = await OPTIONS();

    expect(deleteResponse.status).toBe(200);
    expect(deleteData.success).toBe(true);
    expect(optionsResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
