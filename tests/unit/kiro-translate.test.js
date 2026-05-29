import { describe, expect, it } from "vitest";
import { buildKiroPayload } from "../../open-sse/translator/request/openai-to-kiro.js";

describe("buildKiroPayload", () => {
  it("uses requested max_tokens when provided", () => {
    const payload = buildKiroPayload("claude-opus-4.7", {
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 2048,
    }, true, {});

    expect(payload.inferenceConfig?.maxTokens).toBe(2048);
  });

  it("prefers max_completion_tokens and caps to Kiro limit", () => {
    const payload = buildKiroPayload("claude-opus-4.7", {
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 2048,
      max_completion_tokens: 50000,
    }, true, {});

    expect(payload.inferenceConfig?.maxTokens).toBe(32000);
  });

  it("does not force inference maxTokens when request omitted token cap", () => {
    const payload = buildKiroPayload("claude-opus-4.7", {
      messages: [{ role: "user", content: "Hello" }],
    }, true, {});

    expect(payload.inferenceConfig?.maxTokens).toBeUndefined();
  });
});
