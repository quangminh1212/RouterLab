// Shared helpers for web-cookie chat executors (DuckDuckGo, HuggingChat, etc.)
// Extracts the common OpenAI <-> web-session translation glue so each provider
// only implements: buildRequestInit (url/headers/body) + an async generator
// that yields { delta | thinking | error | done } from the upstream stream.

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export function browserUserAgent() {
  return BROWSER_UA;
}

// Flatten OpenAI messages → [{ role, text }] (text-only), dropping empties.
export function flattenMessages(messages) {
  const out = [];
  for (const msg of Array.isArray(messages) ? messages : []) {
    let role = String(msg?.role || "user");
    if (role === "developer") role = "system";
    let content = "";
    if (typeof msg?.content === "string") content = msg.content;
    else if (Array.isArray(msg?.content)) {
      content = msg.content.filter((c) => c?.type === "text").map((c) => String(c.text || "")).join(" ");
    }
    if (!content.trim()) continue;
    out.push({ role, text: content });
  }
  return out;
}

// Collapse messages to a single prompt string (system/assistant prefixed).
export function messagesToPrompt(messages) {
  const flat = flattenMessages(messages);
  let lastUserIdx = -1;
  for (let i = flat.length - 1; i >= 0; i--) {
    if (flat[i].role === "user") { lastUserIdx = i; break; }
  }
  return flat
    .map((m, i) => (i === lastUserIdx ? m.text : `${m.role}: ${m.text}`))
    .join("\n\n");
}

export function sseChunk(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Read a Server-Sent-Events body, yielding parsed JSON of each `data:` payload.
export async function* readSseJson(body, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") {
          if (payload === "[DONE]") return;
          continue;
        }
        try { yield JSON.parse(payload); } catch { /* skip non-JSON */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Read a newline-delimited JSON (NDJSON) body, yielding each parsed object.
export async function* readNdjson(body, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try { yield JSON.parse(line); } catch { /* skip */ }
      }
    }
    const tail = buffer.trim();
    if (tail) { try { yield JSON.parse(tail); } catch { /* skip */ } }
  } finally {
    reader.releaseLock();
  }
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export function errorResponse(message, status = 502, code = "WEB_ERROR") {
  return jsonResponse({ error: { message, type: "upstream_error", code } }, status);
}

// Wrap a content async-generator into an OpenAI streaming SSE Response.
// gen yields: { delta? , thinking?, error?, done? }
export function buildStreamingResponse(gen, model) {
  const cid = `chatcmpl-web-${(globalThis.crypto || crypto).randomUUID().slice(0, 12)}`;
  const created = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (delta, finish = null) => {
        controller.enqueue(encoder.encode(sseChunk({
          id: cid, object: "chat.completion.chunk", created, model,
          choices: [{ index: 0, delta, finish_reason: finish, logprobs: null }],
        })));
      };
      try {
        emit({ role: "assistant" });
        for await (const c of gen) {
          if (c.error) { emit({ content: `[Error: ${c.error}]` }); break; }
          if (c.thinking) { emit({ reasoning_content: c.thinking }); continue; }
          if (c.done) break;
          if (c.delta) emit({ content: c.delta });
        }
        emit({}, "stop");
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        emit({ content: `[Stream error: ${err?.message || String(err)}]` }, "stop");
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
}

// Drain a content async-generator into an OpenAI non-streaming Response.
export async function buildNonStreamingResponse(gen, model) {
  const cid = `chatcmpl-web-${(globalThis.crypto || crypto).randomUUID().slice(0, 12)}`;
  const created = Math.floor(Date.now() / 1000);
  let content = "";
  const thinking = [];
  for await (const c of gen) {
    if (c.error) return errorResponse(c.error, 502);
    if (c.thinking) { thinking.push(c.thinking); continue; }
    if (c.done) break;
    if (c.delta) content += c.delta;
    if (c.answer) content = c.answer;
  }
  const msg = { role: "assistant", content };
  if (thinking.length) msg.reasoning_content = thinking.join("\n");
  const pt = Math.ceil(content.length / 4);
  return jsonResponse({
    id: cid, object: "chat.completion", created, model,
    choices: [{ index: 0, message: msg, finish_reason: "stop", logprobs: null }],
    usage: { prompt_tokens: pt, completion_tokens: pt, total_tokens: pt * 2 },
  });
}
