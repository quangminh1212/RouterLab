import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;
let initializePromise = null;

function messagesError(message, type = "server_error", status = 500) {
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

function normalizeMessagesRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const next = { ...body };
  if ("model" in next) {
    const model = String(next.model || "").trim();
    if (!model || hasControlChars(model)) delete next.model;
    else next.model = model;
  }
  if ("metadata" in next && next.metadata && typeof next.metadata !== "object") {
    delete next.metadata;
  }
  if ("max_tokens" in next) {
    const normalized = normalizePositiveNumber(next.max_tokens);
    if (normalized === undefined) delete next.max_tokens;
    else next.max_tokens = normalized;
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

/**
 * Initialize translators once
 */
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

/**
 * Handle CORS preflight
 */
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
 * POST /v1/messages - Claude format (auto convert via handleChat)
 */
async function postHandler(request) {
  await ensureInitialized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return messagesError("Invalid JSON body", "invalid_request_error", 400);
  }
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(normalizeMessagesRequestBody(body)),
  });
  return await handleChat(forwardedRequest);
}

export const POST = withRouteGuard(
  "v1/messages",
  postHandler,
  { timeoutMs: 180000 },
);
