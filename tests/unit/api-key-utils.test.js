import { describe, expect, it } from "vitest";

import { buildApiKey, isApiKeyFormat, normalizeApiKey } from "@/shared/utils/apiKey.js";

describe("apiKey utils", () => {
  it("buildApiKey normalizes prefix and body length", () => {
    const apiKey = buildApiKey({ prefix: " SK_* ", bodyLength: 10 });
    expect(apiKey).toMatch(/^sk-[A-Za-z0-9]{12}$/);
  });

  it("buildApiKey respects max body length", () => {
    const apiKey = buildApiKey({ prefix: "demo", bodyLength: 100 });
    expect(apiKey).toMatch(/^demo-[A-Za-z0-9]{64}$/);
  });

  it("validates and normalizes api key values", () => {
    expect(isApiKeyFormat("sk-AbCd12345678")).toBe(true);
    expect(isApiKeyFormat("bad key")).toBe(false);
    expect(normalizeApiKey("  sk-demo123456789012  ")).toBe("sk-demo123456789012");
  });
});
