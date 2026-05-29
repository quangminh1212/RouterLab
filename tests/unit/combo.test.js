import { describe, it, expect, beforeEach } from "vitest";
import { getRotatedModels, handleComboChat, resetComboRotation } from "../../open-sse/services/combo.js";

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

describe("combo retry-after propagation", () => {
  const log = { info: () => {}, warn: () => {} };

  it("uses upstream Retry-After header when every combo model fails", async () => {
    const response = await handleComboChat({
      body: { model: "combo" },
      models: ["provider/a", "provider/b"],
      comboName: "retry-after-combo",
      comboStrategy: "fallback",
      log,
      handleSingleModel: async () => new Response(
        JSON.stringify({ error: { message: "Rate limit exceeded" } }),
        {
          status: 429,
          statusText: "Too Many Requests",
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "45",
          },
        },
      ),
    });

    expect(response.status).toBe(429);
    const retryAfter = Number(response.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(44);
    expect(retryAfter).toBeLessThanOrEqual(46);
  });

  it("uses earliest reset header across failed combo models", async () => {
    const resetAtSec = Math.floor(Date.now() / 1000) + 30;
    let attempts = 0;

    const response = await handleComboChat({
      body: { model: "combo" },
      models: ["provider/a", "provider/b"],
      comboName: "reset-header-combo",
      comboStrategy: "fallback",
      log,
      handleSingleModel: async () => {
        attempts += 1;
        return new Response(
          JSON.stringify({ error: { message: "Rate limit exceeded" } }),
          {
            status: 429,
            statusText: "Too Many Requests",
            headers: {
              "Content-Type": "application/json",
              "x-ratelimit-reset": String(attempts === 1 ? resetAtSec + 30 : resetAtSec),
            },
          },
        );
      },
    });

    expect(response.status).toBe(429);
    const retryAfter = Number(response.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThanOrEqual(29);
    expect(retryAfter).toBeLessThanOrEqual(31);
  });
});

