import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";

let initialized = false;

/**
 * Initialize translators once
 */
async function ensureInitialized() {
  if (!initialized) {
    await initTranslators();
    initialized = true;
  }
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

/**
 * POST /v1/messages - Claude format (auto convert via handleChat)
 */
async function postHandler(request) {
  await ensureInitialized();
  return await handleChat(request);
}

export const POST = withRouteGuard(
  "v1/messages",
  postHandler,
  { timeoutMs: 180000 },
);
