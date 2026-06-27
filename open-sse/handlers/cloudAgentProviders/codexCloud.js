import { fetchJson, getKey, normalizeStatus } from "./_fetch.js";

const BASE = "https://api.openai.com/v1";

export async function createTask(credentials, { prompt, repo_url, branch, auto_create_pr }) {
  const json = await fetchJson(`${BASE}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getKey(credentials)}`,
    },
    body: JSON.stringify({
      model: "codex-mini-latest",
      input: [{ role: "user", content: prompt }],
      background: true,
      metadata: { repo_url, branch, auto_create_pr },
    }),
  });
  const status = json?.status ? normalizeStatus(json.status) : "submitted";
  return { taskId: json?.id, providerTaskId: json?.id, status };
}

export async function getTaskStatus(credentials, taskId) {
  const json = await fetchJson(`${BASE}/responses/${taskId}`, {
    headers: { authorization: `Bearer ${getKey(credentials)}` },
  });
  const output = json?.output || [];
  const text = output.map((o) => o?.content?.find((c) => c?.type === "output_text")?.text || o?.text || "").join("\n").trim() || null;
  return {
    status: normalizeStatus(json?.status),
    result: text,
    error: json?.error?.message || null,
    activity: null,
  };
}

export async function cancelTask(credentials, taskId) {
  try {
    await fetchJson(`${BASE}/responses/${taskId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${getKey(credentials)}` },
    });
    return { success: true };
  } catch {
    return { success: false };
  }
}
