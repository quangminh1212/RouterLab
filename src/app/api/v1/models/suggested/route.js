import { GET as getSuggestedModels } from "@/app/api/providers/suggested-models/route";

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
  const response = await getSuggestedModels(request);
  const payload = await response.json();

  return Response.json(payload, {
    status: response.status,
    headers: buildCorsHeaders(),
  });
}
