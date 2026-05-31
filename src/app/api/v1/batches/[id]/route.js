// OpenAI-compatible Batch API: GET /v1/batches/:id (retrieve status)
import { getBatch } from "@/lib/agentJobsDb.js";
import { ensureAuthorized, jsonResponse, openAiError, preflight } from "../../_lib/apiAuth.js";

export async function OPTIONS() {
  return preflight();
}

export async function GET(request, { params }) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const { id } = await params;
  const batch = await getBatch(id);
  if (!batch) return openAiError(`No such batch: ${id}`, 404, "invalid_request_error", "batch_not_found");
  return jsonResponse(batch);
}
