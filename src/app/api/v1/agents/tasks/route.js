// Cloud agent task API: POST /v1/agents/tasks (create), GET /v1/agents/tasks (list)
import { withRouteGuard } from "@/lib/runtimeGuard";
import { listAgentTasks } from "@/lib/agentJobsDb.js";
import { createCloudAgentTask, validateTaskRequest } from "open-sse/handlers/cloudAgents.js";
import { ensureAuthorized, jsonResponse, openAiError, preflight } from "../../_lib/apiAuth.js";

export async function OPTIONS() {
  return preflight();
}

async function postHandler(request) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const validation = validateTaskRequest(body);
  if (validation.error) return openAiError(validation.error, 400);
  try {
    const task = await createCloudAgentTask(validation);
    return jsonResponse(task, 202);
  } catch (err) {
    return openAiError(err?.message || "Failed to create task", 502);
  }
}

async function getHandler(request) {
  const denied = await ensureAuthorized(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const tasks = await listAgentTasks({ status, limit });
  return jsonResponse({ object: "list", data: tasks });
}

export const POST = withRouteGuard("v1/agents/tasks", postHandler, { timeoutMs: 20000 });
export const GET = withRouteGuard("v1/agents/tasks:list", getHandler, { timeoutMs: 15000 });
