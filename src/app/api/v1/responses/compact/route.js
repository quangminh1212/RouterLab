import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;
let initializePromise = null;

function hasControlChars(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value || ""));
}

function normalizeCompactRequestBody(body) {
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
  return next;
}

function compactError(message, type = "server_error", status = 500) {
  return Response.json({ error: { message, type } }, {
    status,
    headers: { "Access-Control-Allow-Origin": "*" },
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
 * POST /v1/responses/compact - Compact conversation context
 * Reuses the same handleChat pipeline, signals compact via body._compact
 */
async function postHandler(request) {
  await ensureInitialized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return compactError("Invalid JSON body", "invalid_request_error", 400);
  }
  const normalizedBody = normalizeCompactRequestBody(body);
  normalizedBody._compact = true;
  const newRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(normalizedBody)
  });
  return await handleChat(newRequest);
}

export const POST = withRouteGuard(
  "v1/responses/compact",
  postHandler,
  { timeoutMs: 180000 },
);
