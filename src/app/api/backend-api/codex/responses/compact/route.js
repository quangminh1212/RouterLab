/**
 * CLIProxyAPI parity: POST /backend-api/codex/responses/compact
 * Forwards to /v1/responses/compact when present, else /v1/responses.
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
  // Prefer compact sub-route; fall back to responses handler
  try {
    const mod = await import("@/app/api/v1/responses/compact/route.js");
    if (typeof mod.POST === "function") return mod.POST(request);
  } catch {
    // no compact route
  }
  const { POST } = await import("@/app/api/v1/responses/route.js");
  return POST(request);
}

export const POST = withRouteGuard(
  "backend-api/codex/responses/compact",
  postHandler,
  { timeoutMs: 120000 }
);
