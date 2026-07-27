/**
 * QoderExecutor — COSY-signed inference on api3.qoder.sh + OpenAI SSE unwrap.
 *
 * Queue/busy (code 10605, isQueued) is converted to HTTP 429 with a clear
 * message so chatCore / accountFallback can retry another account or cooldown
 * instead of dumping nested JSON into the chat stream as content.
 */

import { qoderEncodeBody } from "../shared/qoder/encoding.js";
import { buildCosyHeaders } from "../shared/qoder/cosy.js";
import { mapQoderError } from "../shared/qoder/errors.js";
import { v4 as uuidv4 } from "uuid";
import { createHash } from "crypto";

import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";
import { SSE_DONE } from "../utils/sseConstants.js";
import { NETWORK_GUARD_CONFIG } from "../config/runtimeConfig.js";
import {
  QODER_CHAT_URL_ENCODED,
} from "../shared/qoder/constants.js";
import { getQoderModelConfig, resolveQoderModels } from "../services/qoderModels.js";

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { messages: [], systemText: "" };
  }
  const systemParts = [];
  const out = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const text = extractText(msg.content);
    if (msg.role === "system") {
      if (text) systemParts.push(text);
      continue;
    }
    const cloned = { ...msg };
    cloned.content = text;
    out.push(cloned);
  }
  return { messages: out, systemText: systemParts.join("\n\n") };
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (content == null) return "";
  if (Array.isArray(content)) {
    const parts = [];
    for (const item of content) {
      if (item && typeof item === "object") {
        if (item.type === "text" && typeof item.text === "string") {
          parts.push(item.text);
        } else if (typeof item.text === "string") {
          parts.push(item.text);
        }
      }
    }
    return parts.join("\n");
  }
  return String(content);
}

function lastUserText(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && typeof m.content === "string") {
      return m.content;
    }
  }
  return "";
}

function stableHash(prefix, ...parts) {
  const h = createHash("sha256");
  h.update(prefix);
  for (const p of parts) {
    h.update("\0");
    h.update(String(p ?? ""));
  }
  return h.digest("hex").slice(0, 16);
}

function stableChatRecordId(model, messages, tools, maxTokens) {
  const h = createHash("sha256");
  h.update("qoder-record\0");
  h.update(String(model));
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    if (m.role) { h.update("\0"); h.update(m.role); }
    if (typeof m.content === "string" && m.content) {
      h.update("\0"); h.update(m.content);
    }
  }
  if (tools) {
    h.update("\0");
    try { h.update(JSON.stringify(tools)); } catch { /* ignore */ }
  }
  h.update(`\0mt=${maxTokens}`);
  return h.digest("hex").slice(0, 16);
}

function truncate(s, n) {
  return s && s.length > n ? `${s.slice(0, n)}...` : s || "";
}

async function buildQoderRequestBody({ model, body, credentials, log, proxyOptions, signal }) {
  const qoderKey = String(model || "").replace(/^qoder\//, "");

  let modelConfig = await getQoderModelConfig(credentials, qoderKey, { log, proxyOptions, signal });
  if (!modelConfig) {
    const refreshed = await resolveQoderModels(credentials, { forceRefresh: true, log, proxyOptions, signal });
    const retried = refreshed?.rawConfigs.get(qoderKey);
    if (!retried) {
      throw new Error(
        `qoder: model_config for "${qoderKey}" not yet known (run a model list fetch or check upstream connectivity)`,
      );
    }
    modelConfig = { ...retried, key: qoderKey };
  }

  const { messages, systemText } = normalizeMessages(body.messages || []);
  const tools = body.tools;
  const isReasoning = !!modelConfig.is_reasoning;
  const maxOutputTokens = Number(modelConfig.max_output_tokens) || 0;

  let maxTokens = 32_768;
  if (maxOutputTokens > 0) maxTokens = maxOutputTokens;
  if (typeof body.max_tokens === "number" && body.max_tokens > 0 && body.max_tokens < maxTokens) {
    maxTokens = body.max_tokens;
  }
  if (typeof body.max_completion_tokens === "number" && body.max_completion_tokens > 0 && body.max_completion_tokens < maxTokens) {
    maxTokens = body.max_completion_tokens;
  }

  const lastUser = lastUserText(messages);
  const psd = credentials.providerSpecificData || {};
  const sessionId = stableHash("qoder-session", psd.userId, qoderKey);
  const recordId = stableChatRecordId(qoderKey, messages, tools, maxTokens);

  return {
    qoderKey,
    payload: {
      request_id: uuidv4(),
      request_set_id: recordId,
      chat_record_id: recordId,
      session_id: sessionId,
      stream: true,
      chat_task: "FREE_INPUT",
      is_reply: true,
      is_retry: false,
      source: 1,
      version: "3",
      session_type: "qodercli",
      agent_id: "agent_common",
      task_id: "common",
      code_language: "",
      chat_prompt: "",
      image_urls: null,
      aliyun_user_type: "",
      system: systemText,
      messages,
      tools: Array.isArray(tools) ? tools : [],
      parameters: { max_tokens: maxTokens },
      chat_context: {
        chatPrompt: "",
        imageUrls: null,
        extra: {
          context: [],
          modelConfig: { key: qoderKey, is_reasoning: isReasoning },
          originalContent: lastUser,
        },
        features: [],
        text: lastUser,
      },
      model_config: modelConfig,
      business: {
        product: "cli",
        version: "1.0.0",
        type: "agent",
        stage: "start",
        id: uuidv4(),
        name: truncate(lastUser, 30),
        begin_at: Date.now(),
      },
    },
    modelConfig,
  };
}

function errorResponseFromMapped(mapped) {
  const headers = { "Content-Type": "application/json" };
  if (mapped.resetsAtMs) {
    const sec = Math.max(1, Math.ceil((mapped.resetsAtMs - Date.now()) / 1000));
    headers["Retry-After"] = String(sec);
  }
  return new Response(
    JSON.stringify({
      error: {
        message: mapped.message,
        type: mapped.isQueued ? "rate_limit_error" : "server_error",
        code: mapped.isQueued ? "rate_limit_exceeded" : "qoder_error",
      },
    }),
    { status: mapped.status, headers },
  );
}

/**
 * Peek first SSE data event. Queue/busy → non-OK Response (429).
 * Success → reconstruct stream and wrap to OpenAI SSE.
 */
async function inspectAndWrapQoderSSE(response, model) {
  if (!response.ok || !response.body) return response;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstData = null;
  let streamDone = false;

  try {
    while (firstData === null && !streamDone) {
      const { done, value } = await reader.read();
      if (done) {
        streamDone = true;
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "").trim();
        buffer = buffer.slice(nl + 1);
        if (!line || !line.startsWith("data:")) continue;
        firstData = line.slice(5).trimStart();
        break;
      }
    }

    // Trailing line without newline
    if (firstData === null && buffer.trim()) {
      const line = buffer.replace(/\r$/, "").trim();
      if (line.startsWith("data:")) {
        firstData = line.slice(5).trimStart();
        buffer = "";
      }
    }
  } catch {
    // Fall through to wrap whatever we can
  }

  if (firstData && firstData !== "[DONE]") {
    try {
      const envelope = JSON.parse(firstData);
      const statusVal = typeof envelope.statusCodeValue === "number" ? envelope.statusCodeValue : 200;
      if (statusVal !== 200) {
        const bodyStr = typeof envelope.body === "string" ? envelope.body : JSON.stringify(envelope.body || "");
        const mapped = mapQoderError(statusVal, bodyStr || firstData);
        try { await reader.cancel(); } catch { /* ignore */ }
        return errorResponseFromMapped(mapped);
      }
    } catch {
      // Not a JSON envelope — stream as normal
    }
  }

  // Rebuild: first data event (if any) + remaining buffer + rest of reader
  const encoder = new TextEncoder();
  const prefixParts = [];
  if (firstData != null) {
    prefixParts.push(encoder.encode(`data: ${firstData}\n\n`));
  }
  if (buffer.length > 0) {
    prefixParts.push(encoder.encode(buffer));
  }

  const reconstructed = new ReadableStream({
    async start(controller) {
      for (const part of prefixParts) controller.enqueue(part);
      if (streamDone) {
        controller.close();
        return;
      }
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        try { controller.error(err); } catch { /* ignore */ }
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  return wrapQoderSSE(
    new Response(reconstructed, {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    }),
    model,
  );
}

/**
 * Unwrap Qoder `{statusCodeValue, body}` SSE into plain OpenAI SSE.
 * Mid-stream non-200 envelopes become a clear error chunk (not raw nested JSON).
 */
function wrapQoderSSE(response, model) {
  if (!response.ok || !response.body) return response;

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let doneEmitted = false;

  const processLine = (line, controller) => {
    const trimmed = line.replace(/\r$/, "").trim();
    if (!trimmed) return;
    if (!trimmed.startsWith("data:")) return;
    if (doneEmitted) return;

    const data = trimmed.slice(5).trimStart();
    if (data === "[DONE]") {
      controller.enqueue(encoder.encode(SSE_DONE));
      doneEmitted = true;
      return;
    }

    let envelope;
    try { envelope = JSON.parse(data); } catch { return; }
    const statusVal = typeof envelope.statusCodeValue === "number" ? envelope.statusCodeValue : 200;
    const inner = typeof envelope.body === "string" ? envelope.body : "";
    if (statusVal !== 200) {
      // Never dump queue/auth errors into assistant content — Hermes treats
      // content deltas as a normal finish_reason=stop reply. Emit error-only
      // terminal chunk (empty content) so clients/combo can fail over.
      const mapped = mapQoderError(statusVal, inner || data);
      const errChunk = JSON.stringify({
        id: `qoder-error-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: "stop",
        }],
        error: {
          message: mapped.message,
          type: mapped.isQueued ? "rate_limit_error" : "server_error",
          code: mapped.isQueued ? "rate_limit_exceeded" : "qoder_error",
          status: mapped.status,
        },
      });
      controller.enqueue(encoder.encode(`data: ${errChunk}\n\n`));
      controller.enqueue(encoder.encode(SSE_DONE));
      doneEmitted = true;
      return;
    }
    if (!inner) return;
    if (inner === "[DONE]") {
      controller.enqueue(encoder.encode(SSE_DONE));
      doneEmitted = true;
      return;
    }
    const sanitized = inner.replace(/\r?\n/g, "");
    controller.enqueue(encoder.encode(`data: ${sanitized}\n\n`));
  };

  const transform = new TransformStream({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        processLine(line, controller);
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer.length > 0) {
        processLine(buffer, controller);
        buffer = "";
      }
      if (!doneEmitted) {
        controller.enqueue(encoder.encode(SSE_DONE));
        doneEmitted = true;
      }
    },
  });

  const transformed = response.body.pipeThrough(transform);
  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

export class QoderExecutor extends BaseExecutor {
  constructor() {
    super("qoder", PROVIDERS.qoder);
  }

  buildUrl() {
    return QODER_CHAT_URL_ENCODED;
  }

  /**
   * HTTP-level errors (and queue-mapped bodies) → friendly parseError for chatCore.
   */
  parseError(response, bodyText) {
    const mapped = mapQoderError(response.status, bodyText || "");
    return {
      status: mapped.status,
      message: mapped.message,
      resetsAtMs: mapped.resetsAtMs,
    };
  }

  async execute({ model, body, stream, credentials, signal, log, proxyOptions = null }) {
    const url = this.buildUrl();

    const psd = credentials?.providerSpecificData || {};
    if (!psd.userId) {
      const fakeResp = new Response(
        JSON.stringify({ error: { message: "qoder credential is missing userId; reconnect the account" } }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
      return { response: fakeResp, url, headers: {}, transformedBody: body };
    }
    if (!credentials?.accessToken) {
      const fakeResp = new Response(
        JSON.stringify({ error: { message: "qoder credential is missing accessToken; reconnect the account" } }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
      return { response: fakeResp, url, headers: {}, transformedBody: body };
    }

    let qoderKey;
    let payload;
    try {
      ({ qoderKey, payload } = await buildQoderRequestBody({ model, body, credentials, log, proxyOptions, signal }));
    } catch (err) {
      const fakeResp = new Response(
        JSON.stringify({ error: { message: err.message } }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
      return { response: fakeResp, url, headers: {}, transformedBody: body };
    }

    const plainBody = Buffer.from(JSON.stringify(payload), "utf8");
    const encodedBodyStr = qoderEncodeBody(plainBody);
    const encodedBodyBuf = Buffer.from(encodedBodyStr, "latin1");

    let cosyHeaders;
    try {
      cosyHeaders = buildCosyHeaders(
        encodedBodyBuf,
        url,
        {
          userId: psd.userId,
          authToken: credentials.accessToken,
          name: credentials.displayName || "",
          email: credentials.email || "",
          machineId: psd.machineId || "",
        },
      );
    } catch (err) {
      const fakeResp = new Response(
        JSON.stringify({ error: { message: `qoder cosy signing failed: ${err.message}` } }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
      return { response: fakeResp, url, headers: {}, transformedBody: body };
    }

    const modelSource = (payload.model_config && payload.model_config.source) || "system";
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Model-Key": qoderKey,
      "X-Model-Source": modelSource,
      "Accept-Encoding": "identity",
      ...cosyHeaders,
    };

    const timeoutMs = this.config?.timeoutMs || NETWORK_GUARD_CONFIG.defaultFetchTimeoutMs || 120000;
    const connectCtrl = new AbortController();
    const connectTimer = setTimeout(() => connectCtrl.abort(new Error("fetch connect timeout")), timeoutMs);
    const mergedSignal = signal ? AbortSignal.any([signal, connectCtrl.signal]) : connectCtrl.signal;

    let response;
    try {
      response = await proxyAwareFetch(
        url,
        { method: "POST", headers, body: encodedBodyBuf, signal: mergedSignal },
        proxyOptions,
      );
    } finally {
      clearTimeout(connectTimer);
    }

    if (!response.ok) {
      // Map queue-style HTTP errors before chatCore sees them
      try {
        const bodyText = await response.text();
        const mapped = mapQoderError(response.status, bodyText);
        if (mapped.isQueued || mapped.message !== bodyText) {
          return {
            response: errorResponseFromMapped(mapped),
            url,
            headers,
            transformedBody: payload,
          };
        }
        // Recreate Response (body already consumed)
        return {
          response: new Response(bodyText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          }),
          url,
          headers,
          transformedBody: payload,
        };
      } catch {
        return { response, url, headers, transformedBody: payload };
      }
    }

    const wrapped = await inspectAndWrapQoderSSE(response, `qoder/${qoderKey}`);
    return { response: wrapped, url, headers, transformedBody: payload };
  }

  async refreshCredentials() {
    return null;
  }

  needsRefresh() {
    return false;
  }
}

export default QoderExecutor;

export const __test__ = {
  normalizeMessages,
  wrapQoderSSE,
  buildQoderRequestBody,
  inspectAndWrapQoderSSE,
};
