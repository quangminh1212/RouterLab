import { handleSearch } from "@/sse/handlers/search.js";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*"
  };
}

function invalidJsonResponse() {
  return Response.json({ error: { message: "Invalid JSON body", type: "invalid_request_error" } }, {
    status: 400,
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}

function normalizeSearchBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const next = { ...body };
  if ("query" in next) next.query = String(next.query || "").trim();
  return next;
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

/**
 * POST /v1/search - Web search endpoint
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalidJsonResponse();
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(normalizeSearchBody(body)),
  });
  return await handleSearch(forwardedRequest);
}
