/**
 * 9router parity: POST /v1/videos/extensions (extend generated video).
 * Forwards to video generation with extension marker when no dedicated adapter.
 */
import { withRouteGuard } from "@/lib/runtimeGuard";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function postHandler(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json(
      { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
      { status: 400, headers: corsHeaders() }
    );
  }
  const next = { ...body, operation: body.operation || "extension" };
  const forwarded = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(next),
  });
  const { POST } = await import("@/app/api/v1/video/generations/route.js");
  return POST(forwarded);
}

export const POST = withRouteGuard("v1/videos/extensions", postHandler, {
  timeoutMs: 180000,
});
