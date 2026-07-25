/**
 * 9router parity: POST /v1/videos/edits → image/video edit path when available.
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
  // Prefer dedicated image edits; video edit falls through same pipeline
  try {
    const mod = await import("@/app/api/v1/images/edits/route.js");
    if (typeof mod.POST === "function") return mod.POST(request);
  } catch {
    // fall through
  }
  const { POST } = await import("@/app/api/v1/video/generations/route.js");
  return POST(request);
}

export const POST = withRouteGuard("v1/videos/edits", postHandler, { timeoutMs: 180000 });
