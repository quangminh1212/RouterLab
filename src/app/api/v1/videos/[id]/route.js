/**
 * 9router parity: GET /v1/videos/{id} — poll async video job.
 * Without a dedicated job store, returns 404 with actionable message.
 */
import { withRouteGuard } from "@/lib/runtimeGuard";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders() });
}

async function getHandler(_request, { params }) {
  const { id } = await params;
  // If image/video job store exists later, look up here.
  return Response.json(
    {
      id,
      object: "video",
      status: "not_found",
      error: {
        message:
          `No async video job found for id '${id}'. ` +
          "Synchronous /v1/videos/generations responses do not require polling; " +
          "async provider job stores are optional.",
        type: "not_found",
      },
    },
    { status: 404, headers: corsHeaders() }
  );
}

export const GET = withRouteGuard("v1/videos/[id]", getHandler, { timeoutMs: 30000 });
