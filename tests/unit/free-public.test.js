import { describe, it, expect, vi, beforeEach } from "vitest";

const modelMocks = vi.hoisted(() => ({
  getModelInfo: vi.fn(),
  getComboModels: vi.fn(),
}));

vi.mock("@/sse/services/model", () => modelMocks);

describe("free public noAuth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modelMocks.getComboModels.mockResolvedValue(null);
    modelMocks.getModelInfo.mockResolvedValue({ provider: null, model: null });
  });

  it("isNoAuthProvider recognizes free public providers", async () => {
    const { isNoAuthProvider } = await import("@/shared/constants/providers.js");
    expect(isNoAuthProvider("pollinations")).toBe(true);
    expect(isNoAuthProvider("pol")).toBe(true);
    expect(isNoAuthProvider("opencode")).toBe(true);
    expect(isNoAuthProvider("oc")).toBe(true);
    expect(isNoAuthProvider("uncloseai")).toBe(true);
    expect(isNoAuthProvider("unc")).toBe(true);
    expect(isNoAuthProvider("openai")).toBe(false);
    expect(isNoAuthProvider("digigo")).toBe(false);
  });

  it("isPublicFreeRequest allows direct free model prefixes without combo", async () => {
    const { isPublicFreeRequest } = await import("@/sse/services/freePublic.js");
    expect(await isPublicFreeRequest("pol/openai", { requireApiKey: true })).toBe(true);
    expect(await isPublicFreeRequest("oc/deepseek-v4-flash-free", {})).toBe(true);
    expect(await isPublicFreeRequest("unc/Lorbus/Qwen3.6-27B-int4-AutoRound", {})).toBe(true);
  });

  it("isPublicFreeRequest allows free-only combos", async () => {
    modelMocks.getComboModels.mockResolvedValue([
      "pol/openai",
      "oc/deepseek-v4-flash-free",
      "unc/Lorbus/Qwen3.6-27B-int4-AutoRound",
    ]);
    const { isPublicFreeRequest } = await import("@/sse/services/freePublic.js");
    expect(await isPublicFreeRequest("FREE", { requireApiKey: true })).toBe(true);
  });

  it("isPublicFreeRequest rejects combos with paid members", async () => {
    modelMocks.getComboModels.mockResolvedValue([
      "pol/openai",
      "digigo/gpt-5.5",
    ]);
    const { isPublicFreeRequest } = await import("@/sse/services/freePublic.js");
    expect(await isPublicFreeRequest("MIXED", {})).toBe(false);
  });

  it("isPublicFreeRequest can be disabled via settings", async () => {
    const { isPublicFreeRequest } = await import("@/sse/services/freePublic.js");
    expect(await isPublicFreeRequest("pol/openai", { allowPublicFreeModels: false })).toBe(false);
  });

  it("FREE_PUBLIC_DEFAULT_MODELS lists current free seeds", async () => {
    const { FREE_PUBLIC_DEFAULT_MODELS } = await import("@/shared/constants/providers.js");
    expect(FREE_PUBLIC_DEFAULT_MODELS.some((m) => m.startsWith("pol/"))).toBe(true);
    expect(FREE_PUBLIC_DEFAULT_MODELS.some((m) => m.startsWith("oc/"))).toBe(true);
    expect(FREE_PUBLIC_DEFAULT_MODELS.some((m) => m.startsWith("unc/"))).toBe(true);
  });
});
