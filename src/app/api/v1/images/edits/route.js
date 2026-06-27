import { handleImageEdits } from "@/sse/handlers/imageEdits.js";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function invalidJsonResponse() {
  return Response.json(
    { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
    { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
  );
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

/** POST /v1/images/edits - OpenAI-compatible image editing (inpainting) endpoint */
export async function POST(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.toLowerCase().includes("multipart/form-data")) {
    return await handleImageEdits(request);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalidJsonResponse();
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(body),
  });

  return await handleImageEdits(forwardedRequest);
}
