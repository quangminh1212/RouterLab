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

describe("combo fusion strategy", () => {
  const log = { info: () => {}, warn: () => {} };

  const makeJsonResponse = (content, status = 200) => new Response(
    JSON.stringify({
      id: "test",
      object: "chat.completion",
      created: 1,
      model: "test-model",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );

  it("uses non-streaming requests for the parallel model calls", async () => {
    const streams = [];
    await handleComboChat({
      body: { model: "combo", messages: [{ role: "user", content: "Hello" }], stream: true },
      models: ["provider/a"],
      comboName: "fusion-stream",
      comboStrategy: "fusion",
      log,
      handleSingleModel: async (body) => {
        streams.push(body.stream);
        return makeJsonResponse("OK");
      },
    });

    expect(streams).toEqual([false]);
  });

  it("returns the single successful response when only one model succeeds", async () => {
    const response = await handleComboChat({
      body: { model: "combo", messages: [{ role: "user", content: "Hello" }] },
      models: ["provider/a", "provider/b"],
      comboName: "fusion-single",
      comboStrategy: "fusion",
      log,
      handleSingleModel: async (body, model) => {
        if (model === "provider/a") return makeJsonResponse("Response A");
        return new Response(
          JSON.stringify({ error: { message: "Failed" } }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.choices[0].message.content).toBe("Response A");
  });

  it("asks the judge to synthesize when multiple models succeed", async () => {
    let judgeCalls = 0;
    const response = await handleComboChat({
      body: { model: "combo", messages: [{ role: "user", content: "Hello" }] },
      models: ["provider/a", "provider/b"],
      comboName: "fusion-judge",
      comboStrategy: "fusion",
      fusionJudgeModel: "judge/x",
      log,
      handleSingleModel: async (body, model) => {
        if (model === "judge/x") {
          judgeCalls += 1;
          const lastMessage = body.messages[body.messages.length - 1];
          expect(lastMessage.role).toBe("user");
          expect(lastMessage.content).toContain("Model A");
          expect(lastMessage.content).toContain("Model B");
          expect(lastMessage.content).toContain("Response from provider/a");
          expect(lastMessage.content).toContain("Response from provider/b");
          expect(body.stream).toBe(false);
          return makeJsonResponse("Synthesized answer");
        }
        return makeJsonResponse(`Response from ${model}`);
      },
    });

    expect(judgeCalls).toBe(1);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.choices[0].message.content).toBe("Synthesized answer");
  });

  it("defaults the judge to the first combo model when not specified", async () => {
    const judgeModels = [];
    await handleComboChat({
      body: { model: "combo", messages: [{ role: "user", content: "Hello" }] },
      models: ["provider/a", "provider/b"],
      comboName: "fusion-default-judge",
      comboStrategy: "fusion",
      log,
      handleSingleModel: async (body, model) => {
        const isJudgeCall = body.messages[body.messages.length - 1].content?.includes("anonymized responses");
        if (isJudgeCall) judgeModels.push(model);
        return makeJsonResponse(`Response from ${model}`);
      },
    });

    expect(judgeModels.length).toBeGreaterThan(0);
    expect(judgeModels[0]).toBe("provider/a");
  });

  it("returns an error when all fusion models fail", async () => {
    const response = await handleComboChat({
      body: { model: "combo", messages: [{ role: "user", content: "Hello" }] },
      models: ["provider/a", "provider/b"],
      comboName: "fusion-fail",
      comboStrategy: "fusion",
      log,
      handleSingleModel: async () => new Response(
        JSON.stringify({ error: { message: "Everything broke" } }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error.message).toContain("Everything broke");
  });

  it("falls back to the first successful response if the judge fails", async () => {
    const response = await handleComboChat({
      body: { model: "combo", messages: [{ role: "user", content: "Hello" }] },
      models: ["provider/a", "provider/b"],
      comboName: "fusion-judge-fail",
      comboStrategy: "fusion",
      fusionJudgeModel: "judge/x",
      log,
      handleSingleModel: async (body, model) => {
        if (model === "judge/x") {
          return new Response(JSON.stringify({ error: { message: "Judge failed" } }), { status: 500 });
        }
        return makeJsonResponse(`Response from ${model}`);
      },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.choices[0].message.content).toBe("Response from provider/a");
  });
});

