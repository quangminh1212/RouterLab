import { getProviderCredentials } from "@/sse/services/auth.js";
import * as db from "@/lib/agentJobsDb.js";
import * as codexCloud from "./cloudAgentProviders/codexCloud.js";
import * as devin from "./cloudAgentProviders/devin.js";
import * as jules from "./cloudAgentProviders/jules.js";

const PROVIDERS = { "codex-cloud": codexCloud, devin, jules };
const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function validateTaskRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid JSON body" };
  const { provider, prompt, repo_url } = body;
  if (!provider || !PROVIDERS[provider]) return { error: `Unsupported provider: ${provider}` };
  if (!prompt || typeof prompt !== "string") return { error: "Missing required parameter: 'prompt'" };
  if (!repo_url || typeof repo_url !== "string") return { error: "Missing required parameter: 'repo_url'" };
  return {
    provider,
    prompt,
    repo_url,
    branch: typeof body.branch === "string" ? body.branch : "main",
    auto_create_pr: Boolean(body.auto_create_pr),
  };
}

function usableCredentials(credentials) {
  return credentials && !credentials.allRateLimited && (credentials.accessToken || credentials.apiKey);
}

export async function createCloudAgentTask(params) {
  const { provider, ...rest } = params;
  const credentials = await getProviderCredentials(provider);
  if (!usableCredentials(credentials)) throw new Error(`No credentials for ${provider}`);
  const { taskId: providerTaskId, status } = await PROVIDERS[provider].createTask(credentials, rest);
  return db.createAgentTask({ provider, providerTaskId, status, ...rest });
}

export async function getCloudAgentTask(id) {
  let task = await db.getAgentTask(id);
  if (!task) return null;
  if (!TERMINAL.has(task.status)) {
    const credentials = await getProviderCredentials(task.provider);
    if (usableCredentials(credentials)) {
      try {
        const remote = await PROVIDERS[task.provider].getTaskStatus(credentials, task.providerTaskId);
        const updates = {};
        if (remote.status && remote.status !== task.status) updates.status = remote.status;
        if (remote.result !== undefined) updates.result = remote.result;
        if (remote.error !== undefined) updates.error = remote.error;
        if (remote.activity !== undefined) updates.activity = remote.activity;
        if (Object.keys(updates).length) task = await db.updateAgentTask(id, updates);
      } catch {}
    }
  }
  return task;
}

export async function cancelCloudAgentTask(id) {
  const task = await db.getAgentTask(id);
  if (!task) return { success: false, error: "Task not found", status: 404 };
  if (TERMINAL.has(task.status)) return { success: false, error: `Task already ${task.status}`, status: 409 };
  const credentials = await getProviderCredentials(task.provider);
  if (!usableCredentials(credentials)) return { success: false, error: "Provider credentials unavailable", status: 500 };
  const res = await PROVIDERS[task.provider].cancelTask(credentials, task.providerTaskId);
  if (res.success) await db.updateAgentTask(id, { status: "cancelled", error: null });
  else if (res.error) await db.updateAgentTask(id, { error: res.error });
  return res;
}
