import { handleWebSearch } from "@/sse/handlers/webSearch.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

async function postHandler(request) {
  return await handleWebSearch(request);
}

export const POST = withRouteGuard(
  "v1/search",
  postHandler,
  { timeoutMs: 120000 },
);
