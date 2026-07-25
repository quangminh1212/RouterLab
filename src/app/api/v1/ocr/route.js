import { handleOcr } from "@/sse/handlers/ocr.js";
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
  return await handleOcr(request);
}

export const POST = withRouteGuard("v1/ocr", postHandler, { timeoutMs: 120000 });
