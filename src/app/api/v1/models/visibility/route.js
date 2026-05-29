import { GET as getVisibility, PATCH as patchVisibility } from "@/app/api/models/visibility/route";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function safeJsonFromResponse(response) {
  return response.json().catch(async () => {
    const text = await response.text().catch(() => "");
    return { error: { message: String(text || "Upstream error"), type: "server_error" } };
  });
}

export async function OPTIONS() {
  return new Response(null, { headers: buildCorsHeaders() });
}

export async function GET(request) {
  const response = await getVisibility(request);
  const payload = await safeJsonFromResponse(response);
  return Response.json(payload, { status: response.status, headers: buildCorsHeaders() });
}

export async function PATCH(request) {
  const response = await patchVisibility(request);
  const payload = await safeJsonFromResponse(response);
  return Response.json(payload, { status: response.status, headers: buildCorsHeaders() });
}
