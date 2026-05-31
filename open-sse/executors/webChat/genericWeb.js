// GenericWebExecutor — config-driven executor for web providers whose backend
// speaks an OpenAI-shaped /chat/completions SSE behind a session cookie or
// bearer token. Configured per-provider in ./registry.js.
//
// For providers whose web protocol is NOT yet reverse-engineered, the registry
// marks them `implemented: false`; this executor then returns a clear,
// actionable error instead of shipping fragile guessed requests.
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
import { WEB_CHAT_CONFIGS } from "./registry.js";

async function* openAiStyleContent(body, signal) {
  for await (const evt of readSseJson(body, signal)) {
    if (evt.error) {
      yield { error: evt.error?.message || String(evt.error), done: true };
      return;
    }
    const choice = evt.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.message?.content;
    if (typeof delta === "string" && delta) yield { delta };
    if (choice?.finish_reason) { yield { done: true }; return; }
  }
  yield { done: true };
}

export class GenericWebExecutor extends BaseExecutor {
  constructor(provider) {
    super(provider, PROVIDERS[provider] || { baseUrl: "", format: "openai" });
    this.webConfig = WEB_CHAT_CONFIGS[provider] || {};
  }

  authHint() {
    return this.webConfig.authHint || "Provide a valid session cookie/token for this web provider.";
  }

  async execute({ model, body, stream, credentials, signal, log }) {
    const cfg = this.webConfig;
    const url = cfg.chatUrl || this.config.baseUrl;

    // Providers we have not reverse-engineered yet: fail clearly instead of
    // sending a fragile guessed request that would silently misbehave.
    if (!cfg.implemented) {
      return wrap(errorResponse(
        `Provider '${this.provider}' is registered but its web protocol is not yet implemented in this build. ` +
        `Use an API-key provider for this vendor instead, or track the parity checklist for status.`,
        501, "NOT_IMPLEMENTED",
      ), url, body);
    }

    const messages = flattenMessages(body?.messages);
    if (!messages.length) return wrap(errorResponse("Missing or empty messages array", 400, "invalid_request"), url, body);

    const token = credentials?.accessToken || credentials?.apiKey || "";
    const headers = {
      "User-Agent": browserUserAgent(),
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "Origin": cfg.origin || "",
      "Referer": cfg.referer || "",
      ...(cfg.extraHeaders || {}),
    };
    if (cfg.authMode === "bearer") headers["Authorization"] = `Bearer ${token}`;
    else if (cfg.authMode === "cookie") headers["Cookie"] = `${cfg.cookieName}=${token}`;

    const payload = typeof cfg.buildBody === "function"
      ? cfg.buildBody({ model, messages, body })
      : { model: cfg.modelMap?.[model] || model, messages: messages.map((m) => ({ role: m.role, content: m.text })), stream: true };

    log?.info?.(this.provider.toUpperCase(), `Query ${model}, msgs=${messages.length}`);

    let res;
    try {
      res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal });
    } catch (err) {
      return wrap(errorResponse(`${this.provider} connection failed: ${err?.message || String(err)}`, 502), url, body);
    }
    if (!res.ok) {
      let msg = `${this.provider} returned HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) msg = `${this.provider} auth failed — ${this.authHint()}`;
      else if (res.status === 429) msg = `${this.provider} rate limited. Wait and retry.`;
      return wrap(errorResponse(msg, res.status, `HTTP_${res.status}`), url, body);
    }
    if (!res.body) return wrap(errorResponse(`${this.provider} returned empty body`, 502), url, body);

    const gen = (cfg.extractContent || openAiStyleContent)(res.body, signal);
    const finalResponse = stream ? buildStreamingResponse(gen, model) : await buildNonStreamingResponse(gen, model);
    return { response: finalResponse, url, headers, transformedBody: payload };
  }
}

function wrap(response, url, body) {
  return { response, url, headers: {}, transformedBody: body };
}

export default GenericWebExecutor;
