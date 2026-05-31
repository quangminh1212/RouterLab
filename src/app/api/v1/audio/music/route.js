// POST /v1/audio/music — music generation endpoint (Suno / Udio).
//
// Registered for catalog parity with OmniRoute. Music providers (suno, udio)
// use cookie/session auth + async task generation; a dedicated music handler
// with per-provider task polling is not yet implemented in this build, so this
// endpoint returns a clear 501 with guidance rather than a fragile stub.
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json(
      { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
      { status: 400, headers: corsHeaders() },
    );
  }
  return Response.json(
    {
      error: {
        message:
          "Music generation (suno/udio) is registered but not yet implemented in this build. " +
          "These providers require cookie/session auth and async task polling. Track the parity checklist for status.",
        type: "not_implemented_error",
        code: "MUSIC_NOT_IMPLEMENTED",
      },
    },
    { status: 501, headers: corsHeaders() },
  );
}

export const POST = withRouteGuard("v1/audio/music", postHandler, { timeoutMs: 30000 });
