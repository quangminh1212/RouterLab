import { BaseExecutor } from "./base.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";
import { randomUUID } from "crypto";

/**
 * The Old LLM free public proxy (noAuth).
 * OmniRoute: open-sse/executors/theoldllm.ts (core protocol port)
 */

const API_URL = "https://theoldllm.vercel.app/api/chatgpt";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";
const TOKEN_SEED = "oldllm-client-2026";
const UA_PREFIX = CHROME_UA.slice(0, 20);

const GPT_MODELS = {
  "gpt-5.4": "GPT_5_4",
  "gpt-5.3": "GPT_5_3",
  "gpt-5.2": "GPT_5_2",
  "gpt-5.1": "GPT_5_1",
  "gpt-5": "GPT_5",
  "gpt-4o": "GPT_4O",
};

const CLAUDE_NAMES = {
  "claude-4.6-opus": "CLAUDE_4_6_OPUS",
  "claude-4.6-sonnet": "CLAUDE_4_6_SONNET",
  "claude-4.5-haiku": "CLAUDE_4_5_HAIKU",
};

const CHATGPT_UPSTREAM_MODELS = new Set([
  "GPT_5_4",
  "GPT_5_3",
  "GPT_5_2",
  "GPT_5_1",
  "GPT_5",
  "GPT_o4_mini",
  "GPT_o3_mini",
  "gemini_3_pro",
  "gemini_2_5_pro",
  "gemini_2_0_flash",
  "gemini_1_5_flash",
  "CLAUDE_4_6_OPUS",
  "CLAUDE_4_6_SONNET",
  "CLAUDE_4_5_HAIKU",
  "openrouter_gpt_4_o",
  "openrouter_gpt_4_o_mini",
  "openrouter_gpt_4",
  "openrouter_grok_4",
  "together_deepseek_r1",
  "openrouter_deepseek_r1",
  "together_deepseek_v3",
  "openrouter_deepseek_v3",
  "sonar-deep-research",
  "sonar-pro",
  "openrouter_web_search",
]);

export function mapModel(model) {
  const trimmed = String(model || "").trim();
  if (CHATGPT_UPSTREAM_MODELS.has(trimmed)) return trimmed;
  const n = trimmed.toLowerCase();
  const gptKey = n.replace(/[_\s]+/g, "-");
  if (GPT_MODELS[gptKey]) return GPT_MODELS[gptKey];
  if (CLAUDE_NAMES[n]) return CLAUDE_NAMES[n];
  if (n.includes("claude")) {
    if (n.includes("opus")) return "CLAUDE_4_6_OPUS";
    if (n.includes("sonnet")) return "CLAUDE_4_6_SONNET";
    if (n.includes("haiku")) return "CLAUDE_4_5_HAIKU";
  }
  if (n.includes("gpt") && n.includes("5")) return "GPT_5_4";
  return "GPT_5_4";
}

export function generateRequestToken() {
  const n = Date.now();
  const e = `${n}-${TOKEN_SEED}-${UA_PREFIX}`;
  let t = 0;
  for (let i = 0; i < e.length; i++) {
    const s = e.charCodeAt(i);
    t = (t << 5) - t + s;
    t = t & t;
  }
  const r = randomUUID().replace(/-/g, "").slice(0, 8);
  return `${n.toString(36)}-${Math.abs(t).toString(36)}-${r}`;
}

function buildChatCompletion(content, model) {
  return JSON.stringify({
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: mapModel(model),
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}

function parseSseContent(sseText) {
  let content = "";
  for (const line of sseText.split("\n")) {
    if (line.startsWith("data: ") && line !== "data: [DONE]") {
      try {
        const d = JSON.parse(line.slice(6));
        content += d.choices?.[0]?.delta?.content || d.choices?.[0]?.delta?.text || "";
      } catch {
        // ignore
      }
    }
  }
  return content;
}

function isVercelMitigationResponse(response, body) {
  const mitigation = response.headers.get("x-vercel-mitigated")?.toLowerCase();
  if (mitigation === "deny" || mitigation === "challenge") return true;
  return (
    (response.status === 403 || response.status === 429) &&
    /vercel security checkpoint|"message"\s*:\s*"forbidden"/i.test(body)
  );
}

export class TheOldLlmExecutor extends BaseExecutor {
  constructor() {
    super("theoldllm", { format: "openai", noAuth: true, baseUrl: API_URL });
  }

  buildUrl() {
    return API_URL;
  }

  buildHeaders() {
    return {
      "Content-Type": "application/json",
      "X-Client-Version": "3.8.4",
      "X-Request-Token": generateRequestToken(),
      "User-Agent": CHROME_UA,
    };
  }

  transformRequest(model, body, stream) {
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    return {
      model: mapModel(model || body?.model),
      messages,
      stream: !!stream,
      temperature: body?.temperature,
      max_tokens: body?.max_tokens,
    };
  }

  async execute({ model, body, stream, signal, log, proxyOptions = null }) {
    const url = this.buildUrl();
    const transformedBody = this.transformRequest(model, body, stream);
    const headers = this.buildHeaders();
    const bodyStr = JSON.stringify(transformedBody);

    log?.debug?.("FETCH", `THEOLDLLM → ${url}`);

    let response = await proxyAwareFetch(
      url,
      { method: "POST", headers, body: bodyStr, signal },
      proxyOptions
    );
    let text = await response.text();

    if (isVercelMitigationResponse(response, text)) {
      const errBody = JSON.stringify({
        error: {
          message:
            "The Old LLM is blocked by Vercel for this server egress IP. Configure a residential proxy for 'theoldllm' and retry.",
          type: "upstream_access_denied",
          code: "THEOLDLLM_VERCEL_MITIGATED",
        },
      });
      return {
        response: new Response(errBody, {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
        url,
        headers,
        transformedBody,
      };
    }

    // Retry once on token rejection
    if (response.status === 401 || response.status === 403) {
      log?.warn?.("THEOLDLLM", `Token rejected (${response.status}), retrying…`);
      headers["X-Request-Token"] = generateRequestToken();
      response = await proxyAwareFetch(
        url,
        { method: "POST", headers, body: bodyStr, signal },
        proxyOptions
      );
      text = await response.text();
    }

    if (!response.ok) {
      return {
        response: new Response(text, {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }),
        url,
        headers,
        transformedBody,
      };
    }

    // Upstream may return SSE even for non-stream; normalize when client wants JSON
    if (!stream && text.includes("data: ")) {
      const content = parseSseContent(text);
      return {
        response: new Response(buildChatCompletion(content, model || body?.model), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
        url,
        headers,
        transformedBody,
      };
    }

    return {
      response: new Response(text, {
        status: response.status,
        headers: {
          "Content-Type": stream ? "text/event-stream" : "application/json",
        },
      }),
      url,
      headers,
      transformedBody,
    };
  }
}

export default TheOldLlmExecutor;
