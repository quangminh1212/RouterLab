// A2A task executor — turns an A2A message into a chat completion request and
// captures the result as a task artifact. Streaming variant yields SSE events.
import { getApiKeys } from "@/lib/localDb.js";
import { createTask, updateTask } from "@/lib/agentJobsDb.js";

function resolveBaseUrl() {
  return (
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    `http://localhost:${process.env.PORT || 1212}`
  );
}

async function getInternalApiKey() {
  try {
    const keys = await getApiKeys();
    return keys.find((k) => k.isActive !== false)?.key || null;
  } catch {
    return null;
  }
}

// Extract plain text from an A2A message parts array or a raw string.
export function partsToText(message) {
  if (!message) return "";
  if (typeof message === "string") return message;
  const parts = Array.isArray(message.parts) ? message.parts : [];
  const texts = [];
  for (const part of parts) {
    if (typeof part === "string") texts.push(part);
    else if (typeof part?.text === "string") texts.push(part.text);
    else if (part?.type === "text" && typeof part?.content === "string") texts.push(part.content);
  }
  if (!texts.length && typeof message.content === "string") return message.content;
  return texts.join("\n");
}

// Build OpenAI chat messages from A2A params.
function buildChatMessages(params) {
  const messages = [];
  if (Array.isArray(params?.messages) && params.messages.length) {
    for (const m of params.messages) {
      const role = m?.role === "agent" ? "assistant" : m?.role || "user";
      messages.push({ role, content: partsToText(m) || (typeof m?.content === "string" ? m.content : "") });
    }
    return messages;
  }
  const single = params?.message || params;
  messages.push({ role: "user", content: partsToText(single) });
  return messages;
}

function resolveModel(params) {
  return (
    params?.model ||
    params?.configuration?.model ||
    params?.metadata?.model ||
    process.env.A2A_DEFAULT_MODEL ||
    "auto"
  );
}

async function callChat(messages, model, { stream = false } = {}) {
  const baseUrl = resolveBaseUrl();
  const apiKey = await getInternalApiKey();
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return fetch(`${baseUrl}/api/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, stream }),
    signal: AbortSignal.timeout(Number(process.env.A2A_REQUEST_TIMEOUT_MS) || 120000),
  });
}

function textArtifact(name, text) {
  return {
    artifactId: `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    parts: [{ type: "text", text }],
  };
}

// Non-streaming: run to completion and persist task state.
export async function runTask(params) {
  const skill = params?.skill || params?.metadata?.skill || "chat";
  const task = await createTask({ skill, input: params, contextId: params?.contextId || params?.message?.contextId });
  await updateTask(task.id, { state: "working" });

  try {
    const messages = buildChatMessages(params);
    if (!messages.some((m) => m.content && m.content.trim())) {
      const failed = await updateTask(task.id, {
        state: "failed",
        error: { code: "empty_message", message: "No text content found in message" },
      });
      return failed;
    }
    const model = resolveModel(params);
    const res = await callChat(messages, model);
    const text = await res.text();
    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 4000) };
    }
    if (res.status < 200 || res.status >= 300) {
      return updateTask(task.id, {
        state: "failed",
        error: { code: `http_${res.status}`, message: payload?.error?.message || "Upstream failed" },
      });
    }
    const content = payload?.choices?.[0]?.message?.content ?? payload?.output_text ?? "";
    return updateTask(task.id, {
      state: "completed",
      artifacts: [textArtifact("response", typeof content === "string" ? content : JSON.stringify(content))],
    });
  } catch (err) {
    return updateTask(task.id, {
      state: "failed",
      error: { code: "internal_error", message: err?.message || "Task failed" },
    });
  }
}

// Streaming: returns an async generator of A2A SSE event objects.
export async function* streamTask(params) {
  const skill = params?.skill || params?.metadata?.skill || "chat";
  const task = await createTask({ skill, input: params, contextId: params?.contextId || params?.message?.contextId });
  yield { type: "task", task: { id: task.id, contextId: task.contextId, status: { state: "submitted" } } };

  await updateTask(task.id, { state: "working" });
  yield { type: "status-update", taskId: task.id, status: { state: "working" }, final: false };

  try {
    const messages = buildChatMessages(params);
    const model = resolveModel(params);
    const res = await callChat(messages, model, { stream: true });
    const contentType = res.headers.get("content-type") || "";

    let aggregated = "";
    if (/text\/event-stream/i.test(contentType) && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const chunk = JSON.parse(data);
            const delta = chunk?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta) {
              aggregated += delta;
              yield {
                type: "artifact-update",
                taskId: task.id,
                artifact: textArtifact("response", delta),
                append: true,
                lastChunk: false,
              };
            }
          } catch {
            /* ignore malformed chunk */
          }
        }
      }
    } else {
      const text = await res.text();
      try {
        const payload = JSON.parse(text);
        aggregated = payload?.choices?.[0]?.message?.content ?? payload?.output_text ?? "";
      } catch {
        aggregated = text.slice(0, 4000);
      }
      yield {
        type: "artifact-update",
        taskId: task.id,
        artifact: textArtifact("response", aggregated),
        append: false,
        lastChunk: true,
      };
    }

    await updateTask(task.id, {
      state: "completed",
      artifacts: [textArtifact("response", aggregated)],
    });
    yield { type: "status-update", taskId: task.id, status: { state: "completed" }, final: true };
  } catch (err) {
    await updateTask(task.id, { state: "failed", error: { code: "internal_error", message: err?.message } });
    yield {
      type: "status-update",
      taskId: task.id,
      status: { state: "failed", error: { message: err?.message || "Task failed" } },
      final: true,
    };
  }
}
