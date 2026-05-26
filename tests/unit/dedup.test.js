import { beforeEach, describe, expect, it } from "vitest";
import {
  clearInflightDedup,
  computeRequestDedupHash,
  getInflightDedupCount,
  shouldDeduplicateRequest,
  withRequestDedup,
} from "../../src/sse/services/requestDedup.js";

describe("request dedup", () => {
  beforeEach(() => {
    clearInflightDedup();
  });

  it("uses stable hashes for equivalent deterministic requests", () => {
    const body = {
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0,
      max_tokens: 32,
    };

    expect(computeRequestDedupHash(body, "openai", "gpt-4o")).toBe(
      computeRequestDedupHash({ ...body }, "openai", "gpt-4o"),
    );
  });

  it("skips stream and high-temperature requests", () => {
    expect(shouldDeduplicateRequest({ stream: true, temperature: 0 })).toBe(false);
    expect(shouldDeduplicateRequest({ stream: false, temperature: 0.8 })).toBe(false);
    expect(shouldDeduplicateRequest({ stream: false, temperature: 0 })).toBe(true);
  });

  it("shares concurrent identical requests and hydrates independent response objects", async () => {
    let calls = 0;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });

    const task = async () => {
      calls += 1;
      await gate;
      return {
        success: true,
        response: new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      };
    };

    const first = withRequestDedup("hash-a", task);
    const second = withRequestDedup("hash-a", task);
    expect(getInflightDedupCount()).toBe(1);

    release();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(calls).toBe(1);
    expect(firstResult.deduplicated).toBe(false);
    expect(secondResult.deduplicated).toBe(true);
    expect(await firstResult.result.response.json()).toEqual({ ok: true });
    expect(await secondResult.result.response.json()).toEqual({ ok: true });
    expect(firstResult.result.response).not.toBe(secondResult.result.response);
    expect(getInflightDedupCount()).toBe(0);
  });
});
