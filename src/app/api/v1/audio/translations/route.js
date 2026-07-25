import { handleAudioTranslation } from "@/sse/handlers/audioTranslation.js";
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
  return await handleAudioTranslation(request);
}

export const POST = withRouteGuard("v1/audio/translations", postHandler, {
  timeoutMs: 120000,
});
