// Shared API-key auth helper for /v1 management-style endpoints
// (Files, Batches, A2A). Mirrors the requireApiKey gate used by the
// streaming handlers in src/sse/handlers/*.
import { getSettings, validateApiKey } from "@/lib/localDb.js";
import { parseBearerToken } from "@/models";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export function corsHeaders(extra = {}) {
  return { ...CORS_HEADERS, ...extra };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(extraHeaders) },
  });
}

export function openAiError(message, status = 400, type = "invalid_request_error", code = null) {
  return jsonResponse({ error: { message, type, code, param: null } }, status);
}

export function extractApiKey(request) {
  const auth = request.headers.get("authorization");
  const fromBearer = parseBearerToken(auth);
  if (fromBearer) return fromBearer;
  return request.headers.get("x-api-key") || "";
}

/**
 * Returns null when authorized, or a Response when the request must be rejected.
 */
export async function ensureAuthorized(request, requestContext = {}) {
  const settings = await getSettings();
  if (!settings.requireApiKey) return null;
  const apiKey = extractApiKey(request);
  if (!apiKey) return openAiError("Missing API key", 401, "authentication_error", "missing_api_key");
  const valid = await validateApiKey(apiKey, requestContext);
  if (!valid) return openAiError("Invalid API key", 401, "authentication_error", "invalid_api_key");
  return null;
}

export function preflight() {
  return new Response(null, { headers: corsHeaders() });
}
