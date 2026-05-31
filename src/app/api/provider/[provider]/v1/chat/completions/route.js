// Amp CLI: POST /api/provider/{provider}/v1/chat/completions
import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { withRouteGuard } from "@/lib/runtimeGuard";
import { ampCors, ampError, buildScopedBody } from "../../../_lib/ampForward.js";

let initialized = false;
async function ensureInitialized() {
  if (initialized) return;
  await Promise.resolve(initTranslators());
  initialized = true;
}
ensureInitialized().catch(() => {});

export async function OPTIONS() {
  return new Response(null, { headers: ampCors() });
}

async function postHandler(request, { params }) {
  await ensureInitialized();
  const { provider } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return ampError("Invalid JSON body", 400);
  }
  const { body: scoped } = await buildScopedBody(provider, body);
  const forwardedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(scoped),
  });
  return await handleChat(forwardedRequest);
}

export const POST = withRouteGuard("amp/chat/completions", postHandler, { timeoutMs: 120000 });
