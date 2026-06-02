import { describe, expect, it } from "vitest";
import { getDefaultModel, getProviderModels } from "open-sse/config/providerModels.js";

describe("provider model catalog parity", () => {
  it("exposes inference-net model catalog", () => {
    const models = getProviderModels("inference-net");
    expect(models.map((item) => item.id)).toEqual([
      "meta-llama/llama-3.3-70b-instruct/fp-16",
      "deepseek/deepseek-v3-0324",
      "mistralai/mistral-nemo-12b-instruct/fp-16",
    ]);
    expect(getDefaultModel("inference-net")).toBe("meta-llama/llama-3.3-70b-instruct/fp-16");
  });

  it("exposes nous-research model catalog", () => {
    const models = getProviderModels("nous-research");
    expect(models.map((item) => item.id)).toEqual([
      "Hermes-4-405B",
      "Hermes-4-70B",
    ]);
    expect(getDefaultModel("nous-research")).toBe("Hermes-4-405B");
  });
});
