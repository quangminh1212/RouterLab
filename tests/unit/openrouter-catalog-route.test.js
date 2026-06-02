import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/models/openrouter-catalog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("returns local OpenRouter catalog by default", async () => {
    const { GET } = await import("@/app/api/models/openrouter-catalog/route");
    const response = await GET(new Request("http://localhost/api/models/openrouter-catalog"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.object).toBe("list");
    expect(data.meta.source).toBe("local");
    expect(data.data.map((model) => model.id)).toContain("openai/dall-e-3");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches fresh OpenRouter catalog when refresh=true", async () => {
    global.fetch.mockResolvedValue(Response.json({
      data: [{ id: "openrouter/model-a", name: "Model A" }],
    }));

    const { GET } = await import("@/app/api/models/openrouter-catalog/route");
    const response = await GET(new Request("http://localhost/api/models/openrouter-catalog?refresh=true"));
    const data = await response.json();

    expect(global.fetch).toHaveBeenCalledWith("https://openrouter.ai/api/v1/models", expect.objectContaining({ cache: "no-store" }));
    expect(data.meta).toEqual({ source: "fresh", count: 1 });
    expect(data.data).toEqual([{ id: "openrouter/model-a", name: "Model A" }]);
  });

  it("falls back to local catalog on refresh failure", async () => {
    global.fetch.mockRejectedValue(new Error("network down"));

    const { GET } = await import("@/app/api/models/openrouter-catalog/route");
    const response = await GET(new Request("http://localhost/api/models/openrouter-catalog?refresh=true"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta.source).toBe("error");
    expect(data.meta.error).toBe("network down");
    expect(data.data.length).toBeGreaterThan(0);
  });
});
