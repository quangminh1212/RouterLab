import { describe, expect, it } from "vitest";
import { parseModel, resolveProviderAlias } from "open-sse/services/model.js";

describe("provider compatibility aliases", () => {
  const aliases = {
    "command-code": "commandcode",
    "azure-openai": "azure",
    "bailian-coding-plan": "alicode",
    "alibaba-cn": "alicode",
    "kimi-coding-apikey": "kimi-coding",
    "devin-cli": "devin",
    "v0-vercel": "v0-vercel-web",
    "gitlab-duo": "gitlab",
  };

  it("resolves canonical provider names used by OmniRoute and 9router", () => {
    for (const [alias, provider] of Object.entries(aliases)) {
      expect(resolveProviderAlias(alias)).toBe(provider);
    }
  });

  it("parses provider-prefixed models after compatibility alias resolution", () => {
    expect(parseModel("command-code/auto")).toMatchObject({ provider: "commandcode", model: "auto" });
    expect(parseModel("bailian-coding-plan/qwen3-coder-plus")).toMatchObject({ provider: "alicode", model: "qwen3-coder-plus" });
    expect(parseModel("v0-vercel/v0-1.5-md")).toMatchObject({ provider: "v0-vercel-web", model: "v0-1.5-md" });
  });
});
