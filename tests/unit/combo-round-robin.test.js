import { describe, it, expect, beforeEach } from "vitest";
import { getRotatedModels, resetComboRotation } from "../../open-sse/services/combo.js";

describe("combo round-robin rotation", () => {
  const models = ["openai/gpt-4o-mini", "anthropic/claude-sonnet", "gemini/gemini-2.5-flash"];

  beforeEach(() => {
    resetComboRotation();
  });

  it("does not rotate when strategy is fallback", () => {
    expect(getRotatedModels(models, "test-combo", "fallback", 1)).toEqual(models);
    expect(getRotatedModels(models, "test-combo", "fallback", 3)).toEqual(models);
  });

  it("rotates every request when sticky limit is 1", () => {
    expect(getRotatedModels(models, "test-combo", "round-robin", 1)).toEqual([
      "openai/gpt-4o-mini",
      "anthropic/claude-sonnet",
      "gemini/gemini-2.5-flash",
    ]);
    expect(getRotatedModels(models, "test-combo", "round-robin", 1)).toEqual([
      "anthropic/claude-sonnet",
      "gemini/gemini-2.5-flash",
      "openai/gpt-4o-mini",
    ]);
    expect(getRotatedModels(models, "test-combo", "round-robin", 1)).toEqual([
      "gemini/gemini-2.5-flash",
      "openai/gpt-4o-mini",
      "anthropic/claude-sonnet",
    ]);
  });

  it("sticks to same first model for N requests before rotating", () => {
    expect(getRotatedModels(models, "sticky-combo", "round-robin", 2)[0]).toBe("openai/gpt-4o-mini");
    expect(getRotatedModels(models, "sticky-combo", "round-robin", 2)[0]).toBe("openai/gpt-4o-mini");
    expect(getRotatedModels(models, "sticky-combo", "round-robin", 2)[0]).toBe("anthropic/claude-sonnet");
    expect(getRotatedModels(models, "sticky-combo", "round-robin", 2)[0]).toBe("anthropic/claude-sonnet");
    expect(getRotatedModels(models, "sticky-combo", "round-robin", 2)[0]).toBe("gemini/gemini-2.5-flash");
  });

  it("keeps rotation state isolated per combo", () => {
    expect(getRotatedModels(models, "combo-a", "round-robin", 1)[0]).toBe("openai/gpt-4o-mini");
    expect(getRotatedModels(models, "combo-b", "round-robin", 1)[0]).toBe("openai/gpt-4o-mini");
    expect(getRotatedModels(models, "combo-a", "round-robin", 1)[0]).toBe("anthropic/claude-sonnet");
    expect(getRotatedModels(models, "combo-b", "round-robin", 1)[0]).toBe("anthropic/claude-sonnet");
  });
});
