import { handleRerank } from "@/sse/handlers/rerank.js";
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
 * POST /v1/rerank - Cohere/Jina/Voyage-compatible rerank endpoint
 */
async function postHandler(request) {
  return await handleRerank(request);
}

export const POST = withRouteGuard(
  "v1/rerank",
  postHandler,
  { timeoutMs: 30000 },
);
