import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;
let initializePromise = null;

const CHAT_COMPLETIONS_TIMEOUT_MS = Number(process.env.CHAT_COMPLETIONS_TIMEOUT_MS) || 45000;
const OPENCLAW_CAPTURE_PROXY_ENABLED = process.env.OPENCLAW_CAPTURE_PROXY === "true";
const OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL = process.env.OPENCLAW_CAPTURE_PROXY_UPSTREAM_URL || "https://api.xlabrnd.com/v1/chat/completions";
const OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS = Number(process.env.OPENCLAW_CAPTURE_PROXY_TIMEOUT_MS) || 30000;
const OPENCLAW_COMPAT_TOKEN = "sk-6520dcd38ef3521c-liwdr1-9137175c";

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
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bodyText,
  });

  if (process.env.OPENCLAW_DEBUG_CAPTURE === "true") {
    try {
      const [{ promises: fs }, path] = await Promise.all([import("fs"), import("path")]);
      const auth = request.headers.get("authorization") || "";
      if (auth.includes("sk-6520dcd38ef3521c-liwdr1-9137175c")) {
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

  if (OPENCLAW_CAPTURE_PROXY_ENABLED && !isCaptureSelfLoop(forwardedRequest)) {
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
    return await normalizeChatCompletionsJson(response.clone(), forwardedRequest, requestBody);
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
      if (typeof choice?.delta?.content === "string") text += choice.delta.content;
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

async function retryEmptyChatAsStream(request, requestBody, fallbackPayload) {
  const streamBody = { ...(requestBody || {}), stream: true };
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (shouldSkipHeader(key)) continue;
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
  if (!contentType.includes("application/json")) return response;

  const raw = await response.text();
  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
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
    const hasText = Boolean(readChatContent(payload).trim());
    const shouldRetryAsStream = Boolean(
      request
      && requestBody
      && requestBody?.stream !== true
      && isOpenClawCompatRequest(request, requestBody)
      && !hasText
    );

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
