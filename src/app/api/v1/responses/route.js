import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;
let initializePromise = null;

function buildResponsesErrorBody(message, type = "server_error") {
  return { error: { message, type } };
}

function hasControlChars(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value || ""));
}

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

function normalizeResponsesRequestBody(body) {
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
  if ("max_output_tokens" in next) {
    const normalized = normalizePositiveNumber(next.max_output_tokens);
    if (normalized === undefined) delete next.max_output_tokens;
    else next.max_output_tokens = normalized;
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

function chatCompletionToResponsesPayload(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map((part) => typeof part?.text === "string" ? part.text : "").join("")
    : typeof content === "string" ? content : "";
  const createdAt = typeof payload?.created === "number"
    ? payload.created
    : Math.floor(Date.now() / 1000);

  return {
    id: payload?.id || `resp_${Date.now()}`,
    object: "response",
    created_at: createdAt,
    status: "completed",
    model: payload?.model,
    output: [
      {
        id: `msg_${Date.now()}`,
        type: "message",
        status: "completed",
        role: "assistant",
        content: [
          {
            type: "output_text",
            text,
            annotations: [],
          },
        ],
      },
    ],
    usage: {
      input_tokens: payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens ?? 0,
      output_tokens: payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens ?? 0,
      total_tokens: payload?.usage?.total_tokens ?? payload?.usage?.totalTokens ?? 0,
    },
  };
}

async function normalizeResponsesJson(response) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const isSse = /\btext\/event-stream\b/i.test(contentType);
  if (!isJson && !isSse && response.ok) return response;

  const raw = await response.text();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    const trimmed = String(raw || "").trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        payload = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        payload = null;
      }
    } else {
      payload = null;
    }
  }

  if (!payload) {
    const fallbackMessage = response.ok
      ? "Invalid upstream responses payload"
      : (String(raw || "").trim() || "Upstream responses error");
    return Response.json(buildResponsesErrorBody(fallbackMessage, response.ok ? "invalid_response" : "upstream_error"), {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  if (payload?.object === "chat.completion") {
    return Response.json(chatCompletionToResponsesPayload(payload), {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return Response.json(payload, {
    status: response.status,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}

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

/**
 * POST /v1/responses - OpenAI Responses API format
 * Now handled by translator pattern (openai-responses format auto-detected)
 */
async function postHandler(request) {
  await ensureInitialized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(buildResponsesErrorBody("Invalid JSON body", "invalid_request_error"), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
  const normalizedBody = normalizeResponsesRequestBody(body);
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(normalizedBody),
  });
  const response = await handleChat(forwardedRequest);
  return await normalizeResponsesJson(response);
}

export const POST = withRouteGuard(
  "v1/responses",
  postHandler,
  { timeoutMs: 180000 },
);
