const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

function countTextChars(content) {
  if (typeof content === "string") return content.length;
  if (!Array.isArray(content)) return 0;
  let total = 0;
  for (const part of content) {
    if (part?.type === "text" && typeof part.text === "string") {
      total += part.text.length;
    }
  }
  return total;
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * POST /v1/messages/count_tokens - Mock token count response
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: { message: "Invalid JSON body", type: "invalid_request_error" } }, 400);
  }

  // Estimate token count based on content length
  const messages = Array.isArray(body.messages) ? body.messages : [];
  let totalChars = 0;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object" || Array.isArray(msg)) continue;
    totalChars += countTextChars(msg.content);
  }

  // Rough estimate: ~4 chars per token
  const inputTokens = Math.ceil(totalChars / 4);

  return jsonResponse({
    input_tokens: inputTokens
  });
}
