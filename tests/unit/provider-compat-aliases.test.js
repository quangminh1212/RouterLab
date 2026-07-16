import { describe, expect, it } from "vitest";
import { parseModel, resolveProviderAlias } from "open-sse/services/model.js";

describe("provider compatibility aliases", () => {
  // Renames that still map onto an existing XLab id
  const renameAliases = {
    "command-code": "commandcode",
    "azure-openai": "azure",
    "gitlab-duo": "gitlab",
    "tavily-search": "tavily",
    "serper-search": "serper",
  };

  // OmniRoute ids that are first-class providers in XLab (Đợt 6)
  const firstClass = {
    "bailian-coding-plan": "bailian-coding-plan",
    "alibaba-cn": "alibaba-cn",
    "kimi-coding-apikey": "kimi-coding-apikey",
    "devin-cli": "devin-cli",
    "v0-vercel": "v0-vercel",
    tokenrouter: "tokenrouter",
    theoldllm: "theoldllm",
  };

  it("resolves OmniRoute rename aliases", () => {
    for (const [alias, provider] of Object.entries(renameAliases)) {
      expect(resolveProviderAlias(alias)).toBe(provider);
    }
  });

  it("keeps OmniRoute first-class provider ids", () => {
    for (const [alias, provider] of Object.entries(firstClass)) {
      expect(resolveProviderAlias(alias)).toBe(provider);
    }
  });

  it("parses provider-prefixed models after alias resolution", () => {
    expect(parseModel("command-code/auto")).toMatchObject({ provider: "commandcode", model: "auto" });
    expect(parseModel("bailian-coding-plan/qwen3-coder-plus")).toMatchObject({
      provider: "bailian-coding-plan",
      model: "qwen3-coder-plus",
    });
    expect(parseModel("v0-vercel/v0-1.5-md")).toMatchObject({ provider: "v0-vercel", model: "v0-1.5-md" });
    expect(parseModel("trk/gpt-4o")).toMatchObject({ provider: "tokenrouter", model: "gpt-4o" });
    expect(parseModel("tllm/claude-sonnet")).toMatchObject({ provider: "theoldllm", model: "claude-sonnet" });
  });
});
