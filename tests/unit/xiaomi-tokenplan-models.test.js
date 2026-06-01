import { describe, expect, it } from "vitest";
import { getDefaultModel, getProviderModels } from "open-sse/config/providerModels.js";

describe("xiaomi token plan model catalog parity", () => {
  it("exposes xiaomi-tokenplan models and default model", () => {
    const models = getProviderModels("xiaomi-tokenplan");
    expect(models.length).toBeGreaterThanOrEqual(8);
    expect(models.map((item) => item.id)).toContain("mimo-v2.5-pro");
    expect(models.map((item) => item.id)).toContain("mimo-v2.5-tts");
    expect(getDefaultModel("xiaomi-tokenplan")).toBe("mimo-v2.5-pro");
  });
});
