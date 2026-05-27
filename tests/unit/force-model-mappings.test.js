import { beforeEach, describe, expect, it, vi } from "vitest";

describe("force model mappings", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("rewrites explicit provider/model when force mode is enabled", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getModelAliases: vi.fn().mockResolvedValue({}),
      getComboByName: vi.fn().mockResolvedValue(null),
      getProviderNodes: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue({
        forcedModelMappings: { "openai/gpt-5": "gemini/gemini-2.5-pro" },
        forceModelMappings: true,
      }),
    }));

    const { getModelInfo } = await import("@/sse/services/model");
    await expect(getModelInfo("openai/gpt-5")).resolves.toEqual({
      provider: "gemini",
      model: "gemini-2.5-pro",
    });
  });

  it("does not rewrite explicit provider/model when force mode is disabled", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getModelAliases: vi.fn().mockResolvedValue({}),
      getComboByName: vi.fn().mockResolvedValue(null),
      getProviderNodes: vi.fn().mockResolvedValue([]),
      getSettings: vi.fn().mockResolvedValue({
        forcedModelMappings: { "openai/gpt-5": "gemini/gemini-2.5-pro" },
        forceModelMappings: false,
      }),
    }));

    const { getModelInfo } = await import("@/sse/services/model");
    await expect(getModelInfo("openai/gpt-5")).resolves.toEqual({
      provider: "openai",
      model: "gpt-5",
    });
  });
});
