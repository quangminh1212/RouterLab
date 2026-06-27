import { fetchJson, getKey, normalizeStatus } from "./_fetch.js";

const BASE = "https://api.devin.ai/v1";

export async function createTask(credentials, { prompt, repo_url, branch }) {
  const json = await fetchJson(`${BASE}/sessions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getKey(credentials)}`,
    },
    body: JSON.stringify({ prompt, repo_url, branch }),
  });
  return { taskId: json?.session_id, providerTaskId: json?.session_id, status: "submitted" };
}

export async function getTaskStatus(credentials, taskId) {
  const json = await fetchJson(`${BASE}/sessions/${taskId}`, {
    headers: { authorization: `Bearer ${getKey(credentials)}` },
  });
  return {
    status: normalizeStatus(json?.status),
    result: json?.output || null,
    error: json?.error?.message || null,
    activity: json?.steps || null,
  };
}

export async function cancelTask(credentials, taskId) {
  try {
    await fetchJson(`${BASE}/sessions/${taskId}/cancel`, {
      method: "POST",
      headers: { authorization: `Bearer ${getKey(credentials)}` },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || "Cancel failed" };
  }
}
