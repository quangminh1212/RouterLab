import { GET as getVoices } from "@/app/api/media-providers/tts/voices/route";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    headers: buildCorsHeaders(),
  });
}

export async function GET(request) {
  const response = await getVoices(request);
  const payload = await response.json();

  return Response.json(payload, {
    status: response.status,
    headers: buildCorsHeaders(),
  });
}
