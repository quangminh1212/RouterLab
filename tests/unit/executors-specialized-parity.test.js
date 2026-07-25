import { describe, it, expect } from "vitest";
import {
  getExecutor,
  hasSpecializedExecutor,
  listSpecializedExecutors,
} from "../../open-sse/executors/index.js";
import { mapModel, generateRequestToken } from "../../open-sse/executors/theoldllm.js";
import { injectSystemMarker, MIMO_SYSTEM_MARKER } from "../../open-sse/executors/mimo-free.js";
import { parseOcrModel, getOcrProvider } from "../../open-sse/handlers/ocrCore.js";
import { getCredentialStoreMode, getCredentialStore } from "../../src/lib/credentialStore.js";
import { normalizeMoonshotRequest } from "../../open-sse/executors/moonshot.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REQUIRED_SPECIALIZED = [
  "puter",
  "cloudflare-ai",
  "pollinations",
  "codebuddy-cn",
  "xai",
  "xai-oauth",
  "cliproxyapi",
  "9router",
  "xiaomi-tokenplan",
  "mimocode",
  "theoldllm",
  "zenmux-free",
  "kie",
  "glm",
  "glm-cn",
  "commandcode",
  "command-code",
  "gitlab",
  "gitlab-duo",
  "windsurf",
  "trae",
  "zed-hosted",
  "auggie",
  "ghe-copilot",
  "grok-cli",
  "chipotle",
  "hyperagent",
  "promptql",
  "adobe-firefly",
  "notion-web",
  "kimchi",
  "ollama-local",
  "moonshot",
  "kimi",
  "nlpcloud",
  "azure",
  "azure-openai",
  "devin-cli",
  "amazon-q",
  "bedrock",
];

describe("specialized executor parity (OmniRoute/9router/CLIProxyAPI)", () => {
  it("registers all required specialized executors", () => {
    for (const id of REQUIRED_SPECIALIZED) {
      expect(hasSpecializedExecutor(id), `missing specialized executor: ${id}`).toBe(true);
      expect(getExecutor(id).provider || getExecutor(id).getProvider?.() || id).toBeTruthy();
    }
  });

  it("lists a large specialized set (beyond default-only catalog)", () => {
    const list = listSpecializedExecutors();
    expect(list.length).toBeGreaterThanOrEqual(40);
  });

  it("theoldllm maps models", () => {
    expect(mapModel("gpt-5.4")).toBe("GPT_5_4");
    expect(mapModel("claude-4.6-opus")).toBe("CLAUDE_4_6_OPUS");
    expect(mapModel("GPT_5_4")).toBe("GPT_5_4");
    expect(generateRequestToken()).toMatch(/^[a-z0-9]+-[a-z0-9]+-[a-f0-9]+$/i);
  });

  it("mimocode injects anti-abuse system marker", () => {
    const body = { messages: [{ role: "user", content: "hi" }] };
    const next = injectSystemMarker(body);
    expect(next.messages[0].role).toBe("system");
    expect(next.messages[0].content).toContain(MIMO_SYSTEM_MARKER);
    // idempotent
    expect(injectSystemMarker(next).messages.filter((m) => m.role === "system").length).toBe(1);
  });

  it("cloudflare-ai flattens text parts and rejects images", () => {
    const ex = getExecutor("cloudflare-ai");
    const flat = ex.transformRequest("m", {
      messages: [{ role: "user", content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] }],
    });
    expect(flat.messages[0].content).toBe("ab");
    expect(() =>
      ex.transformRequest("m", {
        messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: "x" } }] }],
      })
    ).toThrow(/does not accept image/i);
  });

  it("codebuddy-cn forces stream and handles reasoning_effort", () => {
    const ex = getExecutor("codebuddy-cn");
    const out = ex.transformRequest("m", { messages: [], reasoning_effort: "high" }, false, {});
    expect(out.stream).toBe(true);
    expect(out.reasoning_summary).toBe("auto");
    const off = ex.transformRequest("m", { messages: [], reasoning_effort: "none" }, false, {});
    expect(off.reasoning_effort).toBeUndefined();
  });

  it("xai strips effort suffix for allowlisted models", () => {
    const ex = getExecutor("xai");
    const out = ex.transformRequest("grok-4.3-high", { model: "grok-4.3-high" });
    expect(out.model).toBe("grok-4.3");
    expect(out.reasoning_effort).toBe("high");
  });

  it("pollinations enables jsonMode only for json response_format", () => {
    const ex = getExecutor("pollinations");
    const withJson = ex.transformRequest("openai", {
      response_format: { type: "json_object" },
    }, true);
    expect(withJson.jsonMode).toBe(true);
    const plain = ex.transformRequest("openai", { messages: [] }, true);
    expect(plain.jsonMode).toBeUndefined();
  });

  it("ocr helpers resolve mistral", () => {
    expect(parseOcrModel("mistral-ocr-latest").provider).toBe("mistral");
    expect(getOcrProvider("mistral")?.baseUrl).toContain("mistral");
  });

  it("credential store defaults to file", () => {
    expect(getCredentialStoreMode()).toMatch(/file|postgres|git|s3/);
  });

  it("special-protocol providers return 501 with actionable message", async () => {
    const ex = getExecutor("chipotle");
    const { response } = await ex.execute({
      model: "x",
      body: { messages: [] },
      stream: false,
      credentials: {},
    });
    expect(response.status).toBe(501);
    const data = await response.json();
    expect(data.error?.code).toBe("special_protocol_not_implemented");
    expect(String(data.error?.message || "")).toMatch(/Chipotle|Amelia|WebSocket/i);
  });

  it("notion-web is registered via webChat generic path", () => {
    expect(hasSpecializedExecutor("notion-web")).toBe(true);
  });

  it("grok-cli strips effort suffix", () => {
    const ex = getExecutor("grok-cli");
    const out = ex.transformRequest("grok-4-high", { model: "grok-4-high" }, true, {});
    expect(out.model).toBe("grok-4");
    expect(out.reasoning_effort).toBe("high");
  });

  it("kimchi strips anthropic-only fields", () => {
    const ex = getExecutor("kimchi");
    const out = ex.transformRequest(
      "gpt-test",
      { messages: [{ role: "user", content: "hi" }], thinking: { type: "enabled" }, system: "sys" },
      false,
      {}
    );
    expect(out.thinking).toBeUndefined();
    expect(out.system).toBeUndefined();
    expect(out.messages.some((m) => m.role === "system")).toBe(true);
  });

  it("moonshot normalizes kimi-k3 sampling", () => {
    const out = normalizeMoonshotRequest("kimi-k3", {
      model: "kimi-k3",
      temperature: 0.7,
      max_tokens: 100,
    });
    expect(out.temperature).toBeUndefined();
    expect(out.reasoning_effort).toBe("max");
    expect(out.max_completion_tokens).toBe(100);
  });

  it("credential store exposes postgres/git/s3 backends", () => {
    const prev = process.env.CREDENTIAL_STORE;
    process.env.CREDENTIAL_STORE = "file";
    expect(getCredentialStore().name).toBe("file");
    process.env.CREDENTIAL_STORE = "git";
    expect(getCredentialStore().name).toBe("git");
    process.env.CREDENTIAL_STORE = "postgres";
    expect(getCredentialStore().name).toBe("postgres");
    process.env.CREDENTIAL_STORE = "s3";
    expect(getCredentialStore().name).toBe("s3");
    if (prev === undefined) delete process.env.CREDENTIAL_STORE;
    else process.env.CREDENTIAL_STORE = prev;
  });

  it("CLIProxy codex backend-api route file exists", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    expect(
      existsSync(path.join(root, "src/app/api/backend-api/codex/responses/route.js"))
    ).toBe(true);
    expect(
      existsSync(path.join(root, "src/app/api/v0/management/[[...path]]/route.js"))
    ).toBe(true);
  });
});

