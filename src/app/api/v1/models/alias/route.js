import { DELETE as deleteAlias, GET as getAliases, PUT as putAlias } from "@/app/api/models/alias/route";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
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
  const response = await getAliases(request);
  const payload = await safeJsonFromResponse(response);
  return Response.json(payload, { status: response.status, headers: buildCorsHeaders() });
}

export async function PUT(request) {
  const response = await putAlias(request);
  const payload = await safeJsonFromResponse(response);
  return Response.json(payload, { status: response.status, headers: buildCorsHeaders() });
}

export async function DELETE(request) {
  const response = await deleteAlias(request);
  const payload = await safeJsonFromResponse(response);
  return Response.json(payload, { status: response.status, headers: buildCorsHeaders() });
}
