// OpenAI-compatible Files API: GET /v1/files/:id (metadata), DELETE /v1/files/:id
import { getFile, deleteFile } from "@/lib/agentJobsDb.js";
import { ensureAuthorized, jsonResponse, openAiError, preflight } from "../../_lib/apiAuth.js";

export async function OPTIONS() {
  return preflight();
}

export async function GET(request, { params }) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const { id } = await params;
  const file = await getFile(id);
  if (!file) return openAiError(`No such file: ${id}`, 404, "invalid_request_error", "file_not_found");
  return jsonResponse(file);
}

export async function DELETE(request, { params }) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const { id } = await params;
  const deleted = await deleteFile(id);
  if (!deleted) return openAiError(`No such file: ${id}`, 404, "invalid_request_error", "file_not_found");
  return jsonResponse({ id, object: "file", deleted: true });
}
