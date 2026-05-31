// DuckDuckGo AI Chat (duck.ai) — anonymous, free, no credentials required.
// Flow: GET /duckchat/v1/status (x-vqd-accept:1) -> x-vqd-hash-1 token
//       POST /duckchat/v1/chat with that token -> SSE of {message} deltas.
import { BaseExecutor } from "../base.js";
import { PROVIDERS } from "../../config/providers.js";
import {
  browserUserAgent,
  flattenMessages,
  readSseJson,
  buildStreamingResponse,
  buildNonStreamingResponse,
  errorResponse,
} from "./_base.js";

const STATUS_URL = "https://duckduckgo.com/duckchat/v1/status";
const CHAT_URL = "https://duckduckgo.com/duckchat/v1/chat";

// Map friendly ids to DuckDuckGo model ids.
const MODEL_MAP = {
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-5-mini": "gpt-5-mini",
  "o4-mini": "o4-mini",
  "claude-3-haiku": "claude-3-haiku-20240307",
  "llama-3.3-70b": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  "mixtral-small-3": "mistralai/Mistral-Small-24B-Instruct-2501",
  "gpt-oss-120b": "openai/gpt-oss-120b",
};

function resolveModel(model) {
  if (MODEL_MAP[model]) return MODEL_MAP[model];
  // pass through raw if a DDG id was given
  return model || "gpt-4o-mini";
}

function baseHeaders() {
  return {
    "User-Agent": browserUserAgent(),
    "Accept": "text/event-stream",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://duckduckgo.com",
    "Referer": "https://duckduckgo.com/",
    "Content-Type": "application/json",
  };
}

async function fetchVqd() {
  const res = await fetch(STATUS_URL, {
    method: "GET",
    headers: { ...baseHeaders(), "x-vqd-accept": "1", "Cache-Control": "no-store" },
  });
  // DDG returns the token in one of these headers depending on rollout.
  const vqd =
    res.headers.get("x-vqd-hash-1") ||
    res.headers.get("x-vqd-4") ||
    res.headers.get("x-vqd-accept");
  return { vqd, status: res.status };
}

async function* extractContent(body, signal) {
  for await (const evt of readSseJson(body, signal)) {
    if (evt.action === "error" || evt.status === 429 || evt.type === "error") {
      yield { error: evt.message || `DuckDuckGo error (${evt.status || "unknown"})`, done: true };
      return;
    }
    if (typeof evt.message === "string" && evt.message) {
      yield { delta: evt.message };
    }
    if (evt.action === "success" && evt.message === undefined) {
      // heartbeat / completion marker
    }
  }
  yield { done: true };
}

export class DuckDuckGoWebExecutor extends BaseExecutor {
  constructor() {
    super("duckduckgo-web", PROVIDERS["duckduckgo-web"] || { baseUrl: CHAT_URL, format: "openai" });
  }

  async execute({ model, body, stream, signal, log }) {
    const messages = flattenMessages(body?.messages);
    if (!messages.length) {
      return wrap(errorResponse("Missing or empty messages array", 400, "invalid_request"), body);
    }

    const { vqd, status } = await fetchVqd().catch(() => ({ vqd: null, status: 0 }));
    if (!vqd) {
      return wrap(errorResponse(`DuckDuckGo handshake failed (status ${status}). The duck.ai endpoint may have changed or is rate limiting this IP.`, 502, "DDG_HANDSHAKE"), body);
    }

    // DuckDuckGo now ships an obfuscated JS proof-of-work challenge as the
    // x-vqd-hash-1 token (multi-KB base64 of JavaScript that must be executed in
    // a browser to compute the real hash). It cannot be echoed back as-is — doing
    // so yields HTTP 431. Detect the challenge and fail clearly instead.
    if (vqd.length > 600) {
      return wrap(errorResponse(
        "DuckDuckGo AI Chat now requires solving a client-side JavaScript anti-bot challenge (x-vqd-hash-1), which cannot be computed server-side without a JS sandbox. This provider is temporarily unavailable until a challenge solver is added.",
        503, "DDG_JS_CHALLENGE",
      ), body);
    }

    const ddgModel = resolveModel(model);
    const payload = {
      model: ddgModel,
      messages: messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : (m.role === "system" ? "user" : m.role), content: m.text })),
    };

    log?.info?.("DDG-WEB", `Query ${model} -> ${ddgModel}, msgs=${messages.length}`);

    let res;
    try {
      res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { ...baseHeaders(), "x-vqd-hash-1": vqd, "x-vqd-4": vqd },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err) {
      return wrap(errorResponse(`DuckDuckGo connection failed: ${err?.message || String(err)}`, 502), body);
    }

    if (!res.ok) {
      let msg = `DuckDuckGo returned HTTP ${res.status}`;
      if (res.status === 429) msg = "DuckDuckGo rate limited. Wait a moment and retry.";
      else if (res.status === 418 || res.status === 403) msg = "DuckDuckGo blocked the request (challenge). Retry later.";
      return wrap(errorResponse(msg, res.status, `HTTP_${res.status}`), body);
    }
    if (!res.body) return wrap(errorResponse("DuckDuckGo returned empty body", 502), body);

    const gen = extractContent(res.body, signal);
    const finalResponse = stream
      ? buildStreamingResponse(gen, model)
      : await buildNonStreamingResponse(gen, model);
    return { response: finalResponse, url: CHAT_URL, headers: {}, transformedBody: payload };
  }
}

function wrap(response, body) {
  return { response, url: CHAT_URL, headers: {}, transformedBody: body };
}

export default DuckDuckGoWebExecutor;
