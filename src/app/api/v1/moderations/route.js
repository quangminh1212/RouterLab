import { handleModeration } from "@/sse/handlers/moderation.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

/**
 * POST /v1/moderations - OpenAI-compatible moderation endpoint
 */
async function postHandler(request) {
  return await handleModeration(request);
}

export const POST = withRouteGuard(
  "v1/moderations",
  postHandler,
  { timeoutMs: 30000 },
);
