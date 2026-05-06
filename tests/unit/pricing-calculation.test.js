import { describe, expect, it } from "vitest";

import { calculateCostFromTokens } from "../../src/shared/constants/pricing.js";
import { extractUsageFromResponse } from "../../open-sse/handlers/chatCore/requestDetail.js";

describe("pricing calculation", () => {
  const pricing = {
    input: 2,
    output: 4,
    cached: 1,
    reasoning: 6,
    cache_creation: 3,
  };

  it("subtracts cached tokens only for OpenAI-style usage", () => {
    const cost = calculateCostFromTokens({
      prompt_tokens: 1000,
      prompt_tokens_details: { cached_tokens: 200 },
      completion_tokens: 500,
      completion_tokens_details: { reasoning_tokens: 50 },
    }, pricing);

    expect(cost).toBeCloseTo((800 * 2 + 200 * 1 + 500 * 4 + 50 * 6) / 1_000_000, 12);
  });

  it("does not subtract cache-read tokens for Anthropic-style usage", () => {
    const cost = calculateCostFromTokens({
      input_tokens: 1000,
      cache_read_input_tokens: 200,
      cache_creation_input_tokens: 300,
      output_tokens: 500,
    }, pricing);

    expect(cost).toBeCloseTo((1000 * 2 + 200 * 1 + 300 * 3 + 500 * 4) / 1_000_000, 12);
  });

  it("extracts Gemini cached and reasoning tokens for storage", () => {
    const usage = extractUsageFromResponse({
      usageMetadata: {
        promptTokenCount: 1200,
        candidatesTokenCount: 400,
        cachedContentTokenCount: 900,
        thoughtsTokenCount: 150,
      },
    });

    expect(usage).toEqual({
      prompt_tokens: 1200,
      completion_tokens: 400,
      cached_tokens: 900,
      reasoning_tokens: 150,
    });
  });
});
