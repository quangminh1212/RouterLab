import { DELETE as deleteCustom, GET as getCustom, POST as postCustom } from "@/app/api/models/custom/route";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    headers: buildCorsHeaders(),
  });
}

export async function GET(request) {
  const response = await getCustom(request);
  const payload = await response.json();

  return Response.json(payload, {
    status: response.status,
    headers: buildCorsHeaders(),
  });
}

export async function POST(request) {
  const response = await postCustom(request);
  const payload = await response.json();

  return Response.json(payload, {
    status: response.status,
    headers: buildCorsHeaders(),
  });
}

export async function DELETE(request) {
  const response = await deleteCustom(request);
  const payload = await response.json();

  return Response.json(payload, {
    status: response.status,
    headers: buildCorsHeaders(),
  });
}
