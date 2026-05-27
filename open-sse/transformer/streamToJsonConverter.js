/**
 * Stream-to-JSON Converter
 * Converts Responses API SSE stream to single JSON response
 * Used when client requests non-streaming but provider forces streaming (e.g., Codex)
 */

/**
 * Process a single SSE message and update state accordingly.
 */
function getDataPayloads(msg) {
  const payloads = [];
  for (const line of String(msg || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (payload) payloads.push(payload);
  }
  return payloads;
}

function ensureMessageItem(state, outputIndex = 0, itemId = null) {
  const existing = state.items.get(outputIndex);
  if (existing?.type === "message") return existing;
  const item = existing || {
    id: itemId || `msg_${Date.now()}_${outputIndex}`,
    type: "message",
    status: "in_progress",
    role: "assistant",
    content: [{ type: "output_text", text: "", annotations: [] }]
  };
  if (!Array.isArray(item.content)) item.content = [{ type: "output_text", text: "", annotations: [] }];
  if (!item.content[0]) item.content[0] = { type: "output_text", text: "", annotations: [] };
  state.items.set(outputIndex, item);
  return item;
}

function appendOutputText(state, parsed) {
  const outputIndex = parsed.output_index ?? 0;
  const contentIndex = parsed.content_index ?? 0;
  const text = parsed.delta ?? parsed.text ?? parsed.content ?? "";
  if (typeof text !== "string" || text.length === 0) return;

  const item = ensureMessageItem(state, outputIndex, parsed.item_id || null);
  while (item.content.length <= contentIndex) {
    item.content.push({ type: "output_text", text: "", annotations: [] });
  }
  const content = item.content[contentIndex];
  if (!content.type) content.type = "output_text";
  content.text = `${content.text || ""}${text}`;
}

function mergeUsage(state, usage) {
  if (!usage || typeof usage !== "object") return;
  state.usage.input_tokens = usage.input_tokens || usage.prompt_tokens || state.usage.input_tokens || 0;
  state.usage.output_tokens = usage.output_tokens || usage.completion_tokens || state.usage.output_tokens || 0;
  state.usage.total_tokens = usage.total_tokens || state.usage.total_tokens || ((state.usage.input_tokens || 0) + (state.usage.output_tokens || 0));
}

/**
 * Process a single SSE message and update state accordingly.
 * Supports both full SSE (`event:` + `data:`) and data-only Responses API
 * streams where the event name is embedded as `data.type`.
 */
function processSSEMessage(msg, state) {
  if (!msg.trim()) return;

  const eventMatch = msg.match(/^event:\s*(.+)$/m);
  const payloads = getDataPayloads(msg);
  if (payloads.length === 0) return;

  for (const dataStr of payloads) {
    if (dataStr === "[DONE]") continue;

    let parsed;
    try { parsed = JSON.parse(dataStr); }
    catch { continue; }

    const eventType = (eventMatch?.[1] || parsed.type || "").trim();

    if (eventType === "response.created") {
      state.responseId = parsed.response?.id || parsed.id || state.responseId;
      state.created = parsed.response?.created_at || parsed.created_at || state.created;
    } else if (eventType === "response.output_item.added") {
      if (parsed.item) state.items.set(parsed.output_index ?? 0, parsed.item);
    } else if (eventType === "response.output_text.delta") {
      appendOutputText(state, parsed);
    } else if (eventType === "response.output_text.done") {
      const item = ensureMessageItem(state, parsed.output_index ?? 0, parsed.item_id || null);
      const contentIndex = parsed.content_index ?? 0;
      while (item.content.length <= contentIndex) {
        item.content.push({ type: "output_text", text: "", annotations: [] });
      }
      if (typeof parsed.text === "string") item.content[contentIndex].text = parsed.text;
    } else if (eventType === "response.output_item.done") {
      state.items.set(parsed.output_index ?? 0, parsed.item || ensureMessageItem(state, parsed.output_index ?? 0, parsed.item_id || null));
    } else if (eventType === "response.completed") {
      state.status = "completed";
      state.responseId = parsed.response?.id || parsed.id || state.responseId;
      state.created = parsed.response?.created_at || parsed.created_at || state.created;
      mergeUsage(state, parsed.response?.usage || parsed.usage);
    } else if (eventType === "response.failed") {
      state.status = "failed";
      mergeUsage(state, parsed.response?.usage || parsed.usage);
    }
  }
}

const EMPTY_RESPONSE = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

/**
 * Convert Responses API SSE stream to single JSON response
 * @param {ReadableStream} stream - SSE stream from provider
 * @returns {Promise<Object>} Final JSON response in Responses API format
 */
export async function convertResponsesStreamToJson(stream) {
  if (!stream || typeof stream.getReader !== "function") {
    return { id: `resp_${Date.now()}`, object: "response", created_at: Math.floor(Date.now() / 1000), status: "failed", output: [], usage: { ...EMPTY_RESPONSE } };
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const state = {
    responseId: "",
    created: Math.floor(Date.now() / 1000),
    status: "in_progress",
    usage: { ...EMPTY_RESPONSE },
    items: new Map()
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() || "";

      for (const msg of messages) {
        processSSEMessage(msg, state);
      }
    }

    // Flush remaining buffer (last event may not end with \n\n)
    if (buffer.trim()) {
      processSSEMessage(buffer, state);
    }
  } finally {
    reader.releaseLock();
  }

  // Build output array from accumulated items (ordered by index)
  const output = [];
  const maxIndex = state.items.size > 0 ? Math.max(...state.items.keys()) : -1;
  for (let i = 0; i <= maxIndex; i++) {
    output.push(state.items.get(i) || { type: "message", content: [], role: "assistant" });
  }

  return {
    id: state.responseId || `resp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    object: "response",
    created_at: state.created,
    status: state.status || "completed",
    output,
    usage: state.usage
  };
}
