import { handleTts } from "@/sse/handlers/tts.js";
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

/** POST /v1/audio/speech - OpenAI-compatible TTS endpoint */
async function postHandler(request) {
  return await handleTts(request);
}

export const POST = withRouteGuard(
  "v1/audio/speech",
  postHandler,
  { timeoutMs: 120000 },
);
