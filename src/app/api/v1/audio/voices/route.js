import { GET as getVoices } from "@/app/api/media-providers/tts/voices/route";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

async function safeJsonFromResponse(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: String(text || "Upstream error"), type: "server_error" } };
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: buildCorsHeaders(),
  });
}

export async function GET(request) {
  const response = await getVoices(request);
  const payload = await safeJsonFromResponse(response);

  return Response.json(payload, {
    status: response.status,
    headers: buildCorsHeaders(),
  });
}
