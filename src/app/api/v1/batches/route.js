// OpenAI-compatible Batch API: POST /v1/batches (create), GET /v1/batches (list)
// https://platform.openai.com/docs/api-reference/batch
import { withRouteGuard } from "@/lib/runtimeGuard";
import { createBatch, listBatches, getFile } from "@/lib/agentJobsDb.js";
import { startBatchProcessing } from "@/lib/batchProcessor.js";
import { ensureAuthorized, jsonResponse, openAiError, preflight } from "../_lib/apiAuth.js";

export async function OPTIONS() {
  return preflight();
}

const SUPPORTED_ENDPOINTS = new Set(["/v1/chat/completions", "/v1/embeddings", "/v1/completions"]);
const SUPPORTED_WINDOWS = new Set(["24h"]);

async function postHandler(request) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return openAiError("Invalid JSON body", 400);
  }

  const { input_file_id, endpoint, completion_window = "24h", metadata = null } = body;

  if (!input_file_id || typeof input_file_id !== "string") {
    return openAiError("Missing required parameter: 'input_file_id'", 400, "invalid_request_error", "missing_input_file_id");
  }
  if (!endpoint || !SUPPORTED_ENDPOINTS.has(endpoint)) {
    return openAiError(
      `Invalid 'endpoint'. Supported: ${[...SUPPORTED_ENDPOINTS].join(", ")}`,
      400,
      "invalid_request_error",
      "invalid_endpoint",
    );
  }
  if (!SUPPORTED_WINDOWS.has(completion_window)) {
    return openAiError("Invalid 'completion_window'. Only '24h' is supported.", 400);
  }

  const inputFile = await getFile(input_file_id);
  if (!inputFile) {
    return openAiError(`Input file not found: ${input_file_id}`, 404, "invalid_request_error", "file_not_found");
  }

  const batch = await createBatch({ input_file_id, endpoint, completion_window, metadata });
  startBatchProcessing(batch.id);
  return jsonResponse(batch, 200);
}

async function getHandler(request) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const after = url.searchParams.get("after");
  const { data, hasMore } = await listBatches({ limit, after });
  return jsonResponse({
    object: "list",
    data,
    first_id: data[0]?.id || null,
    last_id: data[data.length - 1]?.id || null,
    has_more: hasMore,
  });
}

export const POST = withRouteGuard("v1/batches", postHandler, { timeoutMs: 20000 });
export const GET = withRouteGuard("v1/batches:list", getHandler, { timeoutMs: 15000 });
