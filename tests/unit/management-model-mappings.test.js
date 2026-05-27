import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management model mappings API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("GET returns mappings and force toggle", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getSettings: vi.fn().mockResolvedValue({
        forcedModelMappings: { "gpt-5": "openai/gpt-5-mini" },
        forceModelMappings: true,
      }),
      updateSettings: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/model-mappings/route");
    const response = await GET(new Request("http://localhost/api/management/model-mappings", { headers: { host: "localhost" } }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mappings).toEqual({ "gpt-5": "openai/gpt-5-mini" });
    expect(data.forceEnabled).toBe(true);
  });

  it("PUT updates mappings and force toggle", async () => {
    const updateSettings = vi.fn().mockImplementation(async (payload) => ({
      forcedModelMappings: payload.forcedModelMappings,
      forceModelMappings: payload.forceModelMappings,
    }));

    vi.doMock("@/lib/localDb", () => ({
      getSettings: vi.fn(),
      updateSettings,
    }));

    const { PUT } = await import("@/app/api/management/model-mappings/route");
    const response = await PUT(new Request("http://localhost/api/management/model-mappings", {
      method: "PUT",
      headers: { "content-type": "application/json", host: "localhost" },
      body: JSON.stringify({
        mappings: { "gpt-5": "openai/gpt-5-mini" },
        forceEnabled: true,
      }),
    }));
    const data = await response.json();

    expect(updateSettings).toHaveBeenCalledWith({
      forcedModelMappings: { "gpt-5": "openai/gpt-5-mini" },
      forceModelMappings: true,
    });
    expect(data.forceEnabled).toBe(true);
  });
});
