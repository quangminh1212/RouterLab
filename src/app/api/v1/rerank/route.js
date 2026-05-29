import { handleRerank } from "@/sse/handlers/rerank.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

function hasControlChars(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value || ""));
}

function normalizePositiveNumber(value, fallback = undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRerankBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const next = { ...body };
  if ("model" in next) {
    const model = String(next.model || "").trim();
    if (!model || hasControlChars(model)) delete next.model;
    else next.model = model;
  }
  if ("top_n" in next) {
    const normalized = normalizePositiveNumber(next.top_n);
    if (normalized === undefined) delete next.top_n;
    else next.top_n = normalized;
  }
  return next;
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

/**
 * POST /v1/rerank - Cohere/Jina/Voyage-compatible rerank endpoint
 */
async function postHandler(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: { message: "Invalid JSON body", type: "invalid_request_error" } }, {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(normalizeRerankBody(body)),
  });
  return await handleRerank(forwardedRequest);
}

export const POST = withRouteGuard(
  "v1/rerank",
  postHandler,
  { timeoutMs: 30000 },
);
