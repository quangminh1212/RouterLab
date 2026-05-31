// OpenAI-compatible Batch API: POST /v1/batches/:id/cancel
import { getBatch, updateBatch } from "@/lib/agentJobsDb.js";
import { ensureAuthorized, jsonResponse, openAiError, preflight } from "../../../_lib/apiAuth.js";

export async function OPTIONS() {
  return preflight();
}

const CANCELLABLE = new Set(["validating", "in_progress", "finalizing"]);

export async function POST(request, { params }) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const { id } = await params;
  const batch = await getBatch(id);
  if (!batch) return openAiError(`No such batch: ${id}`, 404, "invalid_request_error", "batch_not_found");

  if (["completed", "failed", "cancelled", "expired"].includes(batch.status)) {
    return openAiError(`Cannot cancel a batch with status '${batch.status}'`, 409, "invalid_request_error", "batch_not_cancellable");
  }

  const updated = await updateBatch(id, {
    status: CANCELLABLE.has(batch.status) ? "cancelling" : "cancelled",
    cancelling_at: Math.floor(Date.now() / 1000),
  });
  return jsonResponse(updated);
}
