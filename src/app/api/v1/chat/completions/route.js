import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";
import { parseBearerToken } from "@/models";

let initialized = false;
let initializePromise = null;

// Default 300s: Hermes/agent turns (skill load + reasoning models) exceed 60s TTFB easily.
// Align with Hermes request_timeout_seconds=300 and v1/messages/responses class timeouts.
const CHAT_COMPLETIONS_TIMEOUT_MS = Number(process.env.CHAT_COMPLETIONS_TIMEOUT_MS) || 300000;
const OPENCLAW_CAPTURE_PROXY_ENABLED = process.env.OPENCLAW_CAPTURE_PROXY === "true";
const OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL = process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL || "https://api.xlabrnd.com/v1/chat/completions";
const OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS = Number(process.env.OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS) || 30000;
const OPENCLAW_CAPTURE_PROXY_TOKENS = String(process.env.OPENCLAW_CAPTURE_PROXY_TOKENS || "")
  .split(",")
  .map((token) => token.trim())
  .filter(Boolean);

async function ensureInitialized() {
  if (initialized) return;
  if (!initializePromise) {
    initializePromise = Promise.resolve(initTranslators())
      .then(() => {
        initialized = true;
      })
      .finally(() => {
        initializePromise = null;
      });
  }
  await initializePromise;
}

ensureInitialized().catch(() => {});

function normalizePositiveNumber(value, fallback = undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeTemperature(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < 0 || parsed > 2) return undefined;
  return parsed;
}

function normalizeTopP(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed <= 0 || parsed > 1) return undefined;
  return parsed;
}

function hasControlChars(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value || ""));
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return messages;
  return messages
    .map((message) => {
      if (!message || typeof message !== "object" || Array.isArray(message)) return null;
      const role = String(message.role || "").trim();
      if (!role || hasControlChars(role)) return null;
      const next = { ...message, role };
      if (typeof next.content === "string") next.content = next.content;
      return next;
    })
    .filter(Boolean);
}

function normalizeChatRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const next = { ...body };
  if ("model" in next) {
    const model = String(next.model || "").trim();
    if (!model || hasControlChars(model)) delete next.model;
    else next.model = model;
  }
  if ("user" in next) {
    const user = String(next.user || "").trim();
    if (!user || hasControlChars(user)) delete next.user;
    else next.user = user;
  }
  if ("messages" in next) {
    next.messages = normalizeMessages(next.messages);
  }
  if ("max_tokens" in next) {
    const normalized = normalizePositiveNumber(next.max_tokens);
    if (normalized === undefined) delete next.max_tokens;
    else next.max_tokens = normalized;
  }
  if ("max_completion_tokens" in next) {
    const normalized = normalizePositiveNumber(next.max_completion_tokens);
    if (normalized === undefined) delete next.max_completion_tokens;
    else next.max_completion_tokens = normalized;
  }
  if ("temperature" in next) {
    const normalized = normalizeTemperature(next.temperature);
    if (normalized === undefined) delete next.temperature;
    else next.temperature = normalized;
  }
  if ("top_p" in next) {
    const normalized = normalizeTopP(next.top_p);
    if (normalized === undefined) delete next.top_p;
    else next.top_p = normalized;
  }
  return next;
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

function shouldSkipHeader(key) {
  const lower = key.toLowerCase();
  return [
    "host",
    "content-length",
    "connection",
    "cookie",
    "proxy-authorization",
    "referer",
    "referrer",
    "origin",
    "cf-connecting-ip",
    "cf-ipcountry",
    "cf-ray",
    "cf-visitor",
    "cf-warp-tag-id",
    "cdn-loop",
    "x-forwarded-for",
    "x-forwarded-host",
    "x-forwarded-port",
    "x-forwarded-proto",
  ].includes(lower);
}

function isCaptureSelfLoop(request) {
  try {
    const incomingHost = new URL(request.url).host;
    const upstreamHost = new URL(OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL).host;
    return incomingHost.toLowerCase() === upstreamHost.toLowerCase();
  } catch {
    return false;
  }
}

function shouldUseOpenClawCaptureProxy(request) {
  if (!OPENCLAW_CAPTURE_PROXY_ENABLED || isCaptureSelfLoop(request)) return false;
  if (OPENCLAW_CAPTURE_PROXY_TOKENS.length === 0) return false;
  const token = parseBearerToken(request.headers.get("authorization"));
  return !!token && OPENCLAW_CAPTURE_PROXY_TOKENS.includes(token);
}

async function writeOpenClawCapture(stage, payload) {
  if (!OPENCLAW_CAPTURE_PROXY_ENABLED) return;
  const [{ promises: fs }, path, os] = await Promise.all([
    import("fs"),
    import("path"),
    import("os")
  ]);
  const rootDir = process.env.OPENCLAW_CAPTURE_DIR
    || path.join(process.cwd(), ".tmp-openclaw-capture");
  await fs.mkdir(rootDir, { recursive: true });
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}_${String(now.getMilliseconds()).padStart(3, "0")}`;
  const file = path.join(rootDir, `${stamp}_${stage}.json`);
  await fs.writeFile(file, JSON.stringify({
    hostname: os.hostname(),
    timestamp: now.toISOString(),
    stage,
    ...payload,
  }, null, 2), "utf8");
}

async function proxyOpenClawCapture(request) {
  const rawBody = await request.text();
  const inboundHeaders = Object.fromEntries(request.headers.entries());
  await writeOpenClawCapture("inbound", {
    method: request.method,
    url: request.url,
    headers: inboundHeaders,
    bodyText: rawBody,
  });

  const outboundHeaders = new Headers();
  for (const [key, value] of Object.entries(inboundHeaders)) {
    if (shouldSkipHeader(key)) continue;
    if (String(key).toLowerCase() === "authorization") {
      const token = parseBearerToken(value);
      if (token) outboundHeaders.set("authorization", `Bearer ${token}`);
      continue;
    }
    outboundHeaders.set(key, value);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS);

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL, {
      method: request.method,
      headers: outboundHeaders,
      body: rawBody,
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (error) {
    await writeOpenClawCapture("upstream-error", {
      upstreamUrl: OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL,
      requestHeaders: Object.fromEntries(outboundHeaders.entries()),
      requestBodyText: rawBody,
      errorName: error?.name,
      errorMessage: error?.message,
      timeoutMs: OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS,
    });

    const timedOut = error?.name === "AbortError";
    return new Response(JSON.stringify({
      error: {
        message: timedOut
          ? `OpenClaw upstream timed out after ${OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS}ms`
          : `OpenClaw upstream request failed: ${error?.message || "unknown error"}`,
        type: timedOut ? "timeout_error" : "server_error",
        code: timedOut ? "OPENCLAW_UPSTREAM_TIMEOUT" : "OPENCLAW_UPSTREAM_ERROR",
      },
    }), {
      status: timedOut ? 504 : 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const upstreamText = await upstreamResponse.text();
  await writeOpenClawCapture("upstream", {
    upstreamUrl: OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL,
    requestHeaders: Object.fromEntries(outboundHeaders.entries()),
    requestBodyText: rawBody,
    responseStatus: upstreamResponse.status,
    responseStatusText: upstreamResponse.statusText,
    responseHeaders: Object.fromEntries(upstreamResponse.headers.entries()),
    responseBodyText: upstreamText,
  });

  return new Response(upstreamText, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: upstreamResponse.headers,
  });
}

async function postHandler(request) {
  const bodyText = await request.text();
  let requestBody = null;
  if (bodyText) {
    try {
      requestBody = JSON.parse(bodyText);
    } catch {
      requestBody = null;
    }
  }
  const normalizedRequestBody = normalizeChatRequestBody(requestBody);
  const forwardedBodyText = normalizedRequestBody && requestBody
    ? JSON.stringify(normalizedRequestBody)
    : bodyText;
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: forwardedBodyText,
  });

  if (process.env.OPENCLAW_DEBUG_CAPTURE === "true") {
    try {
      const [{ promises: fs }, path] = await Promise.all([import("fs"), import("path")]);
      const authToken = parseBearerToken(request.headers.get("authorization"));
      if (OPENCLAW_CAPTURE_PROXY_TOKENS.includes(authToken)) {
        const captureDir = "C:\\tmp\\openclaw-debug-capture";
        await fs.mkdir(captureDir, { recursive: true });
        await fs.writeFile(path.join(captureDir, "last-chat-request.json"), JSON.stringify({
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          bodyText,
        }, null, 2), "utf8");
      }
    } catch {}
  }

  if (shouldUseOpenClawCaptureProxy(forwardedRequest)) {
    return proxyOpenClawCapture(forwardedRequest);
  }

  if (OPENCLAW_CAPTURE_PROXY_ENABLED && isCaptureSelfLoop(forwardedRequest)) {
    await writeOpenClawCapture("capture-bypass", {
      reason: "self-loop-detected",
      incomingUrl: forwardedRequest.url,
      upstreamUrl: OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL,
    });
  }

  await ensureInitialized();
  const response = await handleChat(forwardedRequest);
  try {
    return await normalizeChatCompletionsJson(response.clone(), forwardedRequest, normalizedRequestBody);
  } catch (error) {
    console.error("[v1/chat/completions] normalize fallback:", error?.message || error);
    return response;
  }
}

function extractResponseText(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  if (Array.isArray(payload.output)) {
    const chunks = [];
    for (const item of payload.output) {
      if (!item || typeof item !== "object") continue;
      const content = Array.isArray(item.content) ? item.content : [];
      for (const part of content) {
        if (typeof part?.text === "string" && part.text) chunks.push(part.text);
      }
    }
    return chunks.join("");
  }
  return "";
}

function responsesToChatCompletion(payload) {
  const content = extractResponseText(payload);
  const created = typeof payload?.created_at === "number" ? payload.created_at : Math.floor(Date.now() / 1000);
  const promptTokens = payload?.usage?.input_tokens ?? payload?.usage?.prompt_tokens ?? 0;
  const completionTokens = payload?.usage?.output_tokens ?? payload?.usage?.completion_tokens ?? 0;
  const totalTokens = payload?.usage?.total_tokens ?? (promptTokens + completionTokens);

  return {
    id: payload?.id || `chatcmpl_${Date.now()}`,
    object: "chat.completion",
    created,
    model: payload?.model || "openclaw",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    },
  };
}

function readChatContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("");
  }
  return "";
}

function isOpenClawCompatRequest(request, requestBody) {
  const model = String(requestBody?.model || "");
  const userAgent = request?.headers?.get("user-agent") || "";
  const hasOpenClawSignal = /openclaw/i.test(model) || /openclaw/i.test(userAgent);
  return hasOpenClawSignal;
}

function shouldRetryEmptyChatAsStream(request, requestBody, payload) {
  if (!request || !requestBody || requestBody?.stream === true) return false;
  if (readChatContent(payload).trim()) return false;
  if (payload?.object !== "chat.completion" || !Array.isArray(payload?.choices) || payload.choices.length === 0) {
    return false;
  }
  return true;
}

function isMalformedGatewayResponse(status, raw) {
  if (status !== 200) return false;
  const text = String(raw || "").trim();
  if (!text) return true;
  return /empty\s+or\s+malformed\s+response|check\s+for\s+a\s+proxy\s+or\s+gateway|intercepting\s+the\s+request/i.test(text);
}

function isMalformedGatewayPayload(status, payload) {
  if (status !== 200 || !payload || typeof payload !== "object") return false;
  const message = payload?.error?.message || payload?.message || payload?.detail || payload?.error;
  return isMalformedGatewayResponse(status, message);
}

function extractSseChunkText(chunk) {
  const choice = chunk?.choices?.[0];
  if (typeof choice?.delta?.content === "string") return choice.delta.content;
  if (typeof chunk?.delta === "string") return chunk.delta;
  if (typeof chunk?.text === "string") return chunk.text;
  if (chunk?.type === "response.output_text.delta" && typeof chunk?.delta === "string") return chunk.delta;
  if (chunk?.type === "response.content_part.done" && typeof chunk?.part?.text === "string") return chunk.part.text;
  if (chunk?.type === "response.output_item.done" && Array.isArray(chunk?.item?.content)) {
    return chunk.item.content.map((part) => typeof part?.text === "string" ? part.text : "").join("");
  }
  return "";
}

function chatCompletionFromSse(raw, fallbackModel = "openclaw") {
  const lines = String(raw || "").split(/\r?\n/);
  let text = "";
  let id = "";
  let model = "";
  let created = Math.floor(Date.now() / 1000);
  let finishReason = "stop";
  let usage = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payloadText = trimmed.slice(5).trim();
    if (!payloadText || payloadText === "[DONE]") continue;
    try {
      const chunk = JSON.parse(payloadText);
      if (!id && chunk?.id) id = chunk.id;
      if (!model && chunk?.model) model = chunk.model;
      if (typeof chunk?.created === "number") created = chunk.created;
      const choice = chunk?.choices?.[0];
      text += extractSseChunkText(chunk);
      if (typeof choice?.finish_reason === "string" && choice.finish_reason) finishReason = choice.finish_reason;
      if (chunk?.usage && typeof chunk.usage === "object") usage = chunk.usage;
    } catch {
      // ignore malformed chunk
    }
  }

  return {
    id: id || `chatcmpl_${Date.now()}`,
    object: "chat.completion",
    created,
    model: model || fallbackModel,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: finishReason,
      },
    ],
    usage: usage || { prompt_tokens: 0, completion_tokens: text ? 1 : 0, total_tokens: text ? 1 : 0 },
  };
}

function parseLooseJsonPayload(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const trimmed = String(raw || "").trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function retryEmptyChatAsStream(request, requestBody, fallbackPayload) {
  const streamBody = { ...(requestBody || {}), stream: true };
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (shouldSkipHeader(key)) continue;
    if (String(key).toLowerCase() === "authorization") {
      const token = parseBearerToken(value);
      if (token) headers.set("authorization", `Bearer ${token}`);
      continue;
    }
    headers.set(key, value);
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const retryRequest = new Request(request.url, {
    method: request.method,
    headers,
    body: JSON.stringify(streamBody),
  });

  const retryResponse = await handleChat(retryRequest);
  const retryContentType = retryResponse.headers.get("content-type") || "";
  const retryRaw = await retryResponse.text();

  if (/\btext\/event-stream\b/i.test(retryContentType)) {
    return chatCompletionFromSse(retryRaw, fallbackPayload?.model || String(requestBody?.model || "openclaw"));
  }

  if (retryContentType.includes("application/json")) {
    try {
      const retryPayload = JSON.parse(retryRaw);
      if (retryPayload?.object === "response" || typeof retryPayload?.output_text === "string" || Array.isArray(retryPayload?.output)) {
        return responsesToChatCompletion(retryPayload);
      }
      return retryPayload;
    } catch {
      return fallbackPayload;
    }
  }

  return fallbackPayload;
}

async function normalizeChatCompletionsJson(response, request = null, requestBody = null) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (request && requestBody && requestBody?.stream !== true) {
      const raw = await response.text();
      if (isMalformedGatewayResponse(response.status, raw)) {
        const recoveredPayload = await retryEmptyChatAsStream(request, requestBody, null);
        if (readChatContent(recoveredPayload).trim()) {
          return Response.json(recoveredPayload, {
            status: response.status,
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        }
      }
      return new Response(raw, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
  }

  const raw = await response.text();
  const payload = parseLooseJsonPayload(raw);
  if (!payload) {
    if (request && requestBody && requestBody?.stream !== true && isMalformedGatewayResponse(response.status, raw)) {
      const recoveredPayload = await retryEmptyChatAsStream(request, requestBody, null);
      if (readChatContent(recoveredPayload).trim()) {
        return Response.json(recoveredPayload, {
          status: response.status,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    }
    return new Response(raw, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": contentType || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (payload?.object === "chat.completion" && Array.isArray(payload?.choices) && payload.choices.length > 0) {
    const shouldRetryAsStream = shouldRetryEmptyChatAsStream(request, requestBody, payload);

    if (shouldRetryAsStream) {
      const recoveredPayload = await retryEmptyChatAsStream(request, requestBody, payload);
      if (readChatContent(recoveredPayload).trim()) {
        return Response.json(recoveredPayload, {
          status: response.status,
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      }
    }

    return Response.json(payload, {
      status: response.status,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  if (payload?.object === "response" || typeof payload?.output_text === "string" || Array.isArray(payload?.output)) {
    return Response.json(responsesToChatCompletion(payload), {
      status: response.status,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  if (request && requestBody && requestBody?.stream !== true && isMalformedGatewayPayload(response.status, payload)) {
    const recoveredPayload = await retryEmptyChatAsStream(request, requestBody, null);
    if (readChatContent(recoveredPayload).trim()) {
      return Response.json(recoveredPayload, {
        status: response.status,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
  }

  return Response.json(payload, {
    status: response.status,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

export const POST = withRouteGuard(
  "v1/chat/completions",
  postHandler,
  { timeoutMs: CHAT_COMPLETIONS_TIMEOUT_MS },
);
