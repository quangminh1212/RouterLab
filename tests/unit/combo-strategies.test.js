import { describe, it, expect, beforeEach } from "vitest";
import {
  getRotatedModels,
  resetComboRotation,
  COMBO_STRATEGIES,
  suggestOptimizedComboOrder,
} from "../../open-sse/services/combo.js";
import { optimizeCombos, shouldSelfHeal } from "../../open-sse/services/comboSelfHeal.js";

describe("combo strategy expansion (OmniRoute parity)", () => {
  const models = ["a/m1", "b/m2", "c/m3"];

  beforeEach(() => {
    resetComboRotation();
  });

  it("exports known strategies", () => {
    expect(COMBO_STRATEGIES).toContain("fallback");
    expect(COMBO_STRATEGIES).toContain("p2c");
    expect(COMBO_STRATEGIES).toContain("least-used");
    expect(COMBO_STRATEGIES).toContain("cost-optimized");
  });

  it("priority/fill-first alias to fixed order", () => {
    expect(getRotatedModels(models, "x", "priority")).toEqual(models);
    expect(getRotatedModels(models, "x", "fill-first")).toEqual(models);
  });

  it("random returns permutation of same models", () => {
    const out = getRotatedModels(models, "rand", "random");
    expect(out).toHaveLength(3);
    expect(new Set(out)).toEqual(new Set(models));
  });

  it("p2c puts one model first and keeps others", () => {
    const out = getRotatedModels(models, "p2c", "p2c");
    expect(out).toHaveLength(3);
    expect(new Set(out)).toEqual(new Set(models));
  });

  it("suggestOptimizedComboOrder returns same set", () => {
    const out = suggestOptimizedComboOrder("opt", models);
    expect(new Set(out)).toEqual(new Set(models));
  });
});

describe("combo self-heal", () => {
  it("skips when insufficient samples", async () => {
    const results = await optimizeCombos(
      [{ name: "XLab", models: ["a", "b"] }],
      { minSamples: 100 },
    );
    expect(results[0].changed).toBe(false);
    expect(results[0].skipped).toBe("insufficient_samples");
  });

  it("shouldSelfHeal false without samples", () => {
    expect(shouldSelfHeal("no-such-combo", { minSamples: 1 })).toBe(false);
  });
});
