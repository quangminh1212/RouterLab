// Cloud agent task API: GET /v1/agents/tasks/:id (status), DELETE /v1/agents/tasks/:id (cancel)
import { withRouteGuard } from "@/lib/runtimeGuard";
import { getCloudAgentTask, cancelCloudAgentTask } from "open-sse/handlers/cloudAgents.js";
import { ensureAuthorized, jsonResponse, openAiError, preflight } from "../../../_lib/apiAuth.js";

export async function OPTIONS() {
  return preflight();
}

async function getHandler(request, { params }) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const { id } = await params;
  const task = await getCloudAgentTask(id);
  if (!task) return openAiError(`No such task: ${id}`, 404, "invalid_request_error", "task_not_found");
  return jsonResponse(task);
}

async function deleteHandler(request, { params }) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const { id } = await params;
  const res = await cancelCloudAgentTask(id);
  if (res.status === 404) return openAiError(res.error, 404, "invalid_request_error", "task_not_found");
  if (res.status === 409) return openAiError(res.error, 409, "invalid_request_error", "task_not_cancellable");
  if (!res.success) return openAiError(res.error || "Failed to cancel task", 502);
  return jsonResponse({ success: true, id });
}

export const GET = withRouteGuard("v1/agents/tasks/:id", getHandler, { timeoutMs: 15000 });
export const DELETE = withRouteGuard("v1/agents/tasks/:id:cancel", deleteHandler, { timeoutMs: 15000 });
