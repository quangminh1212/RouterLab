import { fetchJson, getKey, normalizeStatus } from "./_fetch.js";

const BASE = "https://jules.googleapis.com/v1alpha";

export async function createTask(credentials, { prompt, repo_url, branch }) {
  const json = await fetchJson(`${BASE}/tasks`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getKey(credentials)}`,
    },
    body: JSON.stringify({ prompt, repo_url, branch }),
  });
  return { taskId: json?.name, providerTaskId: json?.name, status: "submitted" };
}

export async function getTaskStatus(credentials, taskId) {
  const json = await fetchJson(`${BASE}/${taskId}`, {
    headers: { authorization: `Bearer ${getKey(credentials)}` },
  });
  return {
    status: normalizeStatus(json?.status),
    result: json?.result?.text || json?.output || null,
    error: json?.error?.message || null,
    activity: json?.activity || null,
  };
}

export async function cancelTask(credentials, taskId) {
  try {
    await fetchJson(`${BASE}/${taskId}:cancel`, {
      method: "POST",
      headers: { authorization: `Bearer ${getKey(credentials)}` },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || "Cancel failed" };
  }
}
