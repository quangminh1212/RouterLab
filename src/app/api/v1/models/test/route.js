import { POST as postModelTest } from "@/app/api/models/test/route";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function safeJsonFromResponse(response) {
  return response.json().catch(async () => {
    const text = await response.text().catch(() => "");
    return { error: { message: String(text || "Upstream error"), type: "server_error" } };
  });
}
async function hasInvalidJsonBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return false;

  try {
    await request.clone().json();
    return false;
  } catch {
    return true;
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: buildCorsHeaders() });
}

export async function POST(request) {
  if (await hasInvalidJsonBody(request)) {
    return Response.json({ ok: false, error: "Invalid JSON body" }, {
      status: 400,
      headers: buildCorsHeaders(),
    });
  }

  const response = await postModelTest(request);
  const payload = await safeJsonFromResponse(response);
  return Response.json(payload, { status: response.status, headers: buildCorsHeaders() });
}
