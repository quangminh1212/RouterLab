import { handleEmbeddings } from "@/sse/handlers/embeddings.js";
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
 * POST /v1/embeddings - OpenAI-compatible embeddings endpoint
 */
async function postHandler(request) {
  return await handleEmbeddings(request);
}

export const POST = withRouteGuard(
  "v1/embeddings",
  postHandler,
  { timeoutMs: 90000 },
);
