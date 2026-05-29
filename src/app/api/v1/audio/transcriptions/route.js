import { handleStt } from "@/sse/handlers/stt.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function invalidJsonResponse() {
  return Response.json({ error: { message: "Invalid JSON body", type: "invalid_request_error" } }, {
    status: 400,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

function hasControlChars(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value || ""));
}

function normalizeSttBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const next = { ...body };
  if ("model" in next) {
    const model = String(next.model || "").trim();
    if (!model || hasControlChars(model)) delete next.model;
    else next.model = model;
  }
  if ("url" in next) next.url = String(next.url || "").trim();
  return next;
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

/** POST /v1/audio/transcriptions - OpenAI-compatible STT endpoint */
async function postHandler(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalidJsonResponse();
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(normalizeSttBody(body)),
  });
  return await handleStt(forwardedRequest);
}

export const POST = withRouteGuard(
  "v1/audio/transcriptions",
  postHandler,
  { timeoutMs: 120000 },
);
