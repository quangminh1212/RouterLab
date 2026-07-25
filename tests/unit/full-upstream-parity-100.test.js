import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getExecutor,
  hasSpecializedExecutor,
  listSpecializedExecutors,
} from "../../open-sse/executors/index.js";
import { getCredentialStore } from "../../src/lib/credentialStore.js";
import * as sessionManager from "../../open-sse/services/sessionManager.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function route(...parts) {
  return existsSync(path.join(root, "src", "app", "api", ...parts, "route.js"));
}

/** OmniRoute short aliases that must resolve to specialized executors */
const OMNI_ALIASES = [
  "adp-web",
  "bb-web",
  "cgpt-web",
  "copilot",
  "cw-web",
  "db",
  "ddgw",
  "ds-web",
  "felo",
  "gc",
  "gembiz",
  "gemini-business",
  "gweb",
  "hc",
  "huggingchat",
  "in-ai",
  "lma",
  "ms-web",
  "msdesigner",
  "nw",
  "poe",
  "pplx-web",
  "t3chat",
  "v0",
  "ven",
  "veo-free",
  "ybw",
  "zw",
  "glmt",
  "kimi-coding",
  "kimi-coding-apikey",
];

/** 9router executor stems that must exist as specialized or file */
const NR_EXECUTORS = [
  "antigravity",
  "azure",
  "codebuddy-cn",
  "codex",
  "commandcode",
  "cursor",
  "gemini-cli",
  "github",
  "grok-cli",
  "grok-web",
  "iflow",
  "kimchi",
  "kiro",
  "mimo-free",
  "ollama-local",
  "opencode",
  "opencode-go",
  "perplexity-web",
  "qoder",
  "qwen",
  "vertex",
  "xiaomi-tokenplan",
];

describe("100% upstream parity — no missing feature surface", () => {
  it("registers all Omni short aliases as specialized executors", () => {
    for (const id of OMNI_ALIASES) {
      expect(hasSpecializedExecutor(id), `missing executor alias: ${id}`).toBe(true);
      expect(getExecutor(id)).toBeTruthy();
    }
  });

  it("covers all 9router specialized executors", () => {
    for (const id of NR_EXECUTORS) {
      expect(hasSpecializedExecutor(id), `missing 9router executor: ${id}`).toBe(true);
    }
  });

  it("lists a large specialized executor set", () => {
    expect(listSpecializedExecutors().length).toBeGreaterThanOrEqual(80);
  });

  it("sessionManager service path exists (parity with Omni services)", () => {
    expect(typeof sessionManager.deriveSessionId).toBe("function");
  });

  it("CLIProxyAPI public API surfaces exist", () => {
    expect(route("v1", "chat", "completions")).toBe(true);
    expect(route("v1", "messages")).toBe(true);
    expect(route("v1", "models")).toBe(true);
    expect(route("v1", "responses")).toBe(true);
    expect(route("v1", "ws")).toBe(true);
    expect(route("backend-api", "codex", "responses")).toBe(true);
    expect(route("backend-api", "codex", "responses", "compact")).toBe(true);
    expect(route("v0", "management", "[[...path]]")).toBe(true);
    expect(route("health") || route("api", "health") || existsSync(path.join(root, "src/app/health/route.js"))).toBe(true);
  });

  it("9router API surfaces exist", () => {
    expect(route("v1", "videos", "generations")).toBe(true);
    expect(route("v1", "videos", "edits")).toBe(true);
    expect(route("v1", "videos", "extensions")).toBe(true);
    expect(route("v1", "videos", "[id]")).toBe(true);
    expect(route("headroom", "status")).toBe(true);
    expect(route("headroom", "start")).toBe(true);
    expect(route("headroom", "stop")).toBe(true);
    expect(route("headroom", "restart")).toBe(true);
    expect(route("headroom", "extras")).toBe(true);
    expect(route("auth", "oidc", "start")).toBe(true);
    expect(route("auth", "oidc", "callback")).toBe(true);
    expect(route("auth", "oidc", "test")).toBe(true);
    expect(route("auth", "reset-password")).toBe(true);
    expect(route("version", "shutdown")).toBe(true);
    expect(route("pxpipe", "status")).toBe(true);
    expect(route("oauth", "codex", "import-token")).toBe(true);
    expect(route("oauth", "codex", "bulk-import")).toBe(true);
    expect(route("oauth", "kiro", "api-key")).toBe(true);
    expect(route("media-providers", "tts", "minimax", "voices")).toBe(true);
    expect(route("mcp", "[plugin]", "sse")).toBe(true);
    expect(route("mcp", "[plugin]", "message")).toBe(true);
    expect(route("proxy-pools", "cloudflare-deploy")).toBe(true);
    expect(route("proxy-pools", "deno-deploy")).toBe(true);
  });

  it("Omni media + OCR surfaces exist", () => {
    expect(route("v1", "ocr")).toBe(true);
    expect(route("v1", "audio", "translations")).toBe(true);
    expect(route("v1", "audio", "music")).toBe(true);
    expect(route("v1", "audio", "speech")).toBe(true);
    expect(route("v1", "embeddings")).toBe(true);
    expect(route("v1", "rerank")).toBe(true);
    expect(route("v1", "moderations")).toBe(true);
    expect(route("v1", "search")).toBe(true);
    expect(route("v1", "web", "fetch")).toBe(true);
  });

  it("media/TTS/embedding providers have backend PROVIDERS registry modules", async () => {
    const { PROVIDERS } = await import("../../open-sse/config/providers/index.js");
    const mediaIds = [
      "fal-ai",
      "black-forest-labs",
      "recraft",
      "runwayml",
      "topaz",
      "sdwebui",
      "comfyui",
      "stability-ai",
      "segmind",
      "edge-tts",
      "aws-polly",
      "google-tts",
      "elevenlabs",
      "voyage-ai",
      "jina-ai",
      "jina-reader",
      "local-device",
      "deepgram",
      "assemblyai",
    ];
    for (const id of mediaIds) {
      expect(PROVIDERS[id]?.baseUrl, `missing PROVIDERS entry: ${id}`).toBeTruthy();
    }
  });

  it("credential stores do not throw for mode selection", () => {
    const prev = process.env.CREDENTIAL_STORE;
    for (const mode of ["file", "git", "postgres", "s3"]) {
      process.env.CREDENTIAL_STORE = mode;
      expect(getCredentialStore().name).toBeTruthy();
    }
    if (prev === undefined) delete process.env.CREDENTIAL_STORE;
    else process.env.CREDENTIAL_STORE = prev;
  });

  it("no specialized executor returns undefined for catalog free/oauth ids", () => {
    const critical = [
      "theoldllm",
      "mimocode",
      "pollinations",
      "auggie",
      "cliproxyapi",
      "9router",
      "xai-oauth",
      "devin-cli",
      "gitlab-duo",
      "windsurf",
      "trae",
      "zed-hosted",
      "kimchi",
      "nlpcloud",
      "moonshot",
    ];
    for (const id of critical) {
      expect(hasSpecializedExecutor(id), id).toBe(true);
    }
  });
});

describe("no feature regressions — core modules load", () => {
  it("combo / payloadRules / redisUsageQueue / promptInjectionGuard import", async () => {
    const combo = await import("../../open-sse/services/combo.js");
    const rules = await import("../../open-sse/services/payloadRules.js");
    const redis = await import("../../open-sse/services/redisUsageQueue.js");
    const guard = await import("../../open-sse/services/promptInjectionGuard.js");
    expect(combo).toBeTruthy();
    expect(rules).toBeTruthy();
    expect(redis).toBeTruthy();
    expect(guard).toBeTruthy();
  });

  it("rtk caveman/ponytail/headroom import", async () => {
    const caveman = await import("../../open-sse/rtk/caveman.js");
    const ponytail = await import("../../open-sse/rtk/ponytail.js");
    const headroom = await import("../../open-sse/rtk/headroom.js");
    expect(caveman).toBeTruthy();
    expect(ponytail).toBeTruthy();
    expect(typeof headroom.compressViaHeadroom).toBe("function");
  });

  it("cloud agents module loads", async () => {
    const ca = await import("../../open-sse/handlers/cloudAgents.js");
    expect(typeof ca.validateTaskRequest).toBe("function");
  });
});
