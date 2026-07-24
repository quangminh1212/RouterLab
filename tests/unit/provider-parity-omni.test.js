import { describe, it, expect } from "vitest";
import { AI_PROVIDERS, isNoAuthProvider } from "@/shared/constants/providers.js";
import { PROVIDERS } from "open-sse/config/providers.js";
import { parseModel } from "open-sse/services/model.js";

/** OmniRoute providers that must exist after Đợt 6 parity wave */
const OMNI_WAVE = [
  "tokenrouter", "requesty", "zenmux", "dgrid", "orcarouter", "modelscope",
  "digitalocean", "alibaba", "alibaba-cn", "bailian-coding-plan", "hcnsec",
  "glmt", "sparkdesk", "openvecta", "sumopod", "kenari", "x5lab", "wafer",
  "nube", "qiniu", "factory", "openadapter", "pioneer", "charm-hyper", "dit",
  "bai", "v0-vercel", "codebuddy-cn", "kimi-coding-apikey", "theoldllm",
  "mimocode", "auggie", "agy", "windsurf", "trae", "zed", "zed-hosted",
  "clinepass", "grok-cli", "devin-cli", "yuanbao-web", "zai-web", "qwen-web",
  "copilot-m365-web", "lmarena", "zenmux-free", "veoaifree-web",
  "agnes", "aihorde", "ainative", "aion", "ant-ling", "chenzk", "chipotle", "clova-studio", "dahl", "felo-web", "freepik", "g4f-gemini", "g4f-groq", "g4f-nvidia", "g4f-ollama", "g4f-pollinations", "ghe-copilot", "hyperagent", "inception", "internlm", "nara", "navy", "notion-web", "plamo", "promptql", "qwen-cloud", "qwen-cloud-token-plan", "routeway", "sarvam", "sealion", "typhoon", "writer", "xai-oauth"
];

const OMNI_ALIASES = {
  "azure-openai": "azure",
  "gitlab-duo": "gitlab",
  "command-code": "commandcode",
  "tavily-search": "tavily",
  "serper-search": "serper",
  trk: "tokenrouter",
  ali: "alibaba",
  tllm: "theoldllm",
};

describe("OmniRoute provider parity (Đợt 6)", () => {
  it("registers all Omni wave providers in UI catalog", () => {
    for (const id of OMNI_WAVE) {
      expect(AI_PROVIDERS[id], `missing UI provider ${id}`).toBeTruthy();
    }
  });

  it("wires OpenAI-compatible backend PROVIDERS for gateway wave", () => {
    const needBackend = [
      "tokenrouter", "requesty", "zenmux", "dgrid", "alibaba", "modelscope",
      "digitalocean", "theoldllm", "mimocode", "pioneer", "factory", "qiniu",
    ];
    for (const id of needBackend) {
      expect(PROVIDERS[id]?.baseUrl, `missing backend baseUrl for ${id}`).toBeTruthy();
    }
  });

  it("resolves OmniRoute alias renames", () => {
    for (const [alias, provider] of Object.entries(OMNI_ALIASES)) {
      const parsed = parseModel(`${alias}/test-model`);
      expect(parsed.provider, alias).toBe(provider);
    }
  });

  it("marks free public Omni providers as noAuth", () => {
    expect(isNoAuthProvider("theoldllm")).toBe(true);
    expect(isNoAuthProvider("mimocode")).toBe(true);
    expect(isNoAuthProvider("auggie")).toBe(true);
    expect(isNoAuthProvider("tokenrouter")).toBe(false);
  });

  it("keeps catalog above OmniRoute baseline", () => {
    // OmniRoute ~250+, XLab should stay competitive after wave
    expect(Object.keys(AI_PROVIDERS).length).toBeGreaterThanOrEqual(300);
  });
});
