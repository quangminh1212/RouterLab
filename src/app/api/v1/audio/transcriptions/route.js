import { handleStt } from "@/sse/handlers/stt.js";
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

/** POST /v1/audio/transcriptions - OpenAI-compatible STT endpoint */
async function postHandler(request) {
  return await handleStt(request);
}

export const POST = withRouteGuard(
  "v1/audio/transcriptions",
  postHandler,
  { timeoutMs: 120000 },
);
