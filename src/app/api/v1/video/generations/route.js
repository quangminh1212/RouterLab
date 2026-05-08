import { handleImageGeneration } from "@/sse/handlers/imageGeneration.js";

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

/** 
 * POST /v1/video/generations - Video generation endpoint
 * Uses same handler as image generation; provider adapters handle video models
 */
export async function POST(request) {
  return await handleImageGeneration(request);
}
