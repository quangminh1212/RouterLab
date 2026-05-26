import { afterEach, describe, expect, it, vi } from "vitest";

import { FetchTimeoutError, fetchWithTimeout } from "@/shared/utils/fetch";
import { fetchSuggestedModels } from "@/shared/utils/suggest";

describe("shared fetch utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("throws FetchTimeoutError when request exceeds timeout", async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn(
      (_input, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(init.signal.reason ?? new DOMException("Aborted", "AbortError"));
        }, { once: true });
      })
    );

    const resultPromise = fetchWithTimeout("https://example.com", {}, 10, "Custom timeout")
      .then(() => null)
      .catch((error) => error);

    await vi.advanceTimersByTimeAsync(20);

    const error = await resultPromise;
    expect(error).toBeInstanceOf(FetchTimeoutError);
    expect(error).toMatchObject({
      name: "FetchTimeoutError",
      message: "Custom timeout",
    });
  });

  it("preserves external abort errors", async () => {
    const controller = new AbortController();
    const aborted = new DOMException("User cancelled", "AbortError");

    global.fetch = vi.fn(async (_input, init) => {
      init.signal.throwIfAborted();
      return { ok: true };
    });

    controller.abort(aborted);

    await expect(
      fetchWithTimeout("https://example.com", { signal: controller.signal }, 50)
    ).rejects.toBe(aborted);
  });

  it("deduplicates concurrent suggested model requests for the same provider", async () => {
    const payload = [{ id: "gpt-4.1", name: "GPT-4.1" }];
    let resolveFetch;

    global.fetch = vi.fn(
      () => new Promise((resolve) => {
        resolveFetch = () => resolve({
          ok: true,
          json: async () => ({ data: payload }),
        });
      })
    );

    const first = fetchSuggestedModels({ url: "https://api.example.com/models/dedupe", type: "openai" });
    const second = fetchSuggestedModels({ url: "https://api.example.com/models/dedupe", type: "openai" });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    resolveFetch();

    await expect(first).resolves.toEqual(payload);
    await expect(second).resolves.toEqual(payload);
  });

  it("separates cache entries by provider type", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }));

    await fetchSuggestedModels({ url: "https://api.example.com/models/cache", type: "openai" });
    await fetchSuggestedModels({ url: "https://api.example.com/models/cache", type: "anthropic" });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
