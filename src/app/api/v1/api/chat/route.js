import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { transformToOllama } from "open-sse/utils/ollamaTransform.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;
let initializePromise = null;

const API_CHAT_TIMEOUT_MS = Number(process.env.CHAT_COMPLETIONS_TIMEOUT_MS) || 60000;

function apiChatError(message, type = "server_error", status = 500) {
  return Response.json({ error: { message, type } }, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

function hasControlChars(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value || ""));
}

function normalizePositiveNumber(value, fallback = undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeApiChatBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const next = { ...body };
  if ("model" in next) {
    const model = String(next.model || "").trim();
    if (!model || hasControlChars(model)) delete next.model;
    else next.model = model;
  }
  if ("options" in next && next.options && typeof next.options === "object" && !Array.isArray(next.options)) {
    const options = { ...next.options };
    if ("num_predict" in options) {
      const normalized = normalizePositiveNumber(options.num_predict);
      if (normalized === undefined) delete options.num_predict;
      else options.num_predict = normalized;
    }
    if ("temperature" in options) {
      const parsed = Number(options.temperature);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) delete options.temperature;
      else options.temperature = parsed;
    }
    next.options = options;
  }
  return next;
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

async function postHandler(request) {
  await ensureInitialized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return apiChatError("Invalid JSON body", "invalid_request_error", 400);
  }
  const normalizedBody = normalizeApiChatBody(body);
  const modelName = normalizedBody.model || "llama3.2";
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(normalizedBody),
  });

  const response = await handleChat(forwardedRequest);
  return transformToOllama(response, modelName);
}

export const POST = withRouteGuard(
  "v1/api/chat",
  postHandler,
  { timeoutMs: API_CHAT_TIMEOUT_MS },
);
