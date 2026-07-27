/**
 * Detect "poison" assistant content that is really an upstream error dump
 * (e.g. Qoder queue 10605 rendered as chat text). Combo must treat these as
 * failed attempts so fallback continues instead of Hermes finishing with junk.
 */

import { parseQoderErrorBody, mapQoderError } from "./qoder/errors.js";

const POISON_PATTERNS = [
  /\[qoder\s+error\s+\d+/i,
  /qoder\s+error\s+403/i,
  /"code"\s*:\s*"10605"/,
  /"code"\s*:\s*10605/,
  /isQueued"\s*:\s*true/i,
  /"modelKey"\s*:\s*"qmodel_preview"/i,
  /Qoder model ".+" is busy \(queue/i,
];

/**
 * @param {string} text
 * @returns {boolean}
 */
/**
 * Strip wrappers like `[qoder error 403: {...}]` so nested JSON can be parsed.
 * @param {string} text
 * @returns {string}
 */
export function unwrapPoisonWrapper(text) {
  let t = String(text || "").trim();
  // [qoder error 403: {...}] or [Qoder model ... is busy ...]
  const m = t.match(/^\[[^\]]*?error[^\]]*?:\s*([\s\S]+)\]\s*$/i);
  if (m) t = m[1].trim();
  return t;
}

export function looksLikePoisonAssistantContent(text) {
  if (!text || typeof text !== "string") return false;
  const t = text.trim();
  if (!t) return false;
  // Full-message dumps are short; avoid false positives on long normal prose.
  if (t.length > 2500) return false;
  if (POISON_PATTERNS.some((re) => re.test(t))) return true;
  const unwrapped = unwrapPoisonWrapper(t);
  const info = parseQoderErrorBody(unwrapped);
  if (info.isQueued || info.code === "10605") return true;
  return false;
}

/**
 * Extract text content from a small OpenAI chat.completion or SSE prefix.
 * @param {string} raw
 * @returns {string}
 */
export function extractContentFromOpenAIFragment(raw) {
  if (!raw || typeof raw !== "string") return "";
  const parts = [];
  // Non-stream JSON body
  try {
    const j = JSON.parse(raw);
    const msg = j?.choices?.[0]?.message?.content;
    if (typeof msg === "string") return msg;
    const delta = j?.choices?.[0]?.delta?.content;
    if (typeof delta === "string") return delta;
    if (typeof j?.error?.message === "string") return j.error.message;
  } catch {
    /* SSE path */
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trimStart();
    if (!data || data === "[DONE]") continue;
    try {
      const j = JSON.parse(data);
      const c = j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content;
      if (typeof c === "string" && c) parts.push(c);
      if (typeof j?.error?.message === "string" && j.error.message) parts.push(j.error.message);
      // Qoder envelope
      if (typeof j?.statusCodeValue === "number" && j.statusCodeValue !== 200) {
        const body = typeof j.body === "string" ? j.body : JSON.stringify(j.body || "");
        parts.push(body || data);
      }
    } catch {
      if (looksLikePoisonAssistantContent(data)) parts.push(data);
    }
  }
  return parts.join("");
}

/**
 * Peek the first bytes of a Response body. If the fragment is a poison error
 * dump, return a JSON 429 Response so combo fallback continues. Otherwise
 * return a Response that still contains the peeked bytes + remaining stream.
 *
 * @param {Response} response
 * @param {{ maxBytes?: number, log?: { warn?: Function } }} [opts]
 * @returns {Promise<Response>}
 */
export async function rejectPoisonStreamResponse(response, opts = {}) {
  if (!response?.ok || !response.body) return response;

  const maxBytes = Math.max(512, Number(opts.maxBytes) || 4096);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = new Uint8Array(0);
  let done = false;

  try {
    while (buf.byteLength < maxBytes && !done) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value?.byteLength) {
        const next = new Uint8Array(buf.byteLength + value.byteLength);
        next.set(buf, 0);
        next.set(value, buf.byteLength);
        buf = next;
      }
    }
  } catch {
    // On peek failure, rebuild with what we have (best effort)
  }

  const text = decoder.decode(buf, { stream: !done });
  const content = extractContentFromOpenAIFragment(text);
  const poison =
    looksLikePoisonAssistantContent(content) ||
    looksLikePoisonAssistantContent(text);

  if (poison) {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    const raw = content || text;
    const mapped = mapQoderError(403, unwrapPoisonWrapper(raw));
    // Always treat poison dumps as retryable (429) so combo fallback continues.
    const status = 429;
    const message =
      mapped.isQueued || mapped.message
        ? mapped.message
        : "Upstream returned queue/error content disguised as assistant text";
    opts.log?.warn?.(
      "COMBO",
      `Poison upstream content detected → ${status}: ${message}`,
    );
    const headers = { "Content-Type": "application/json" };
    const resetsAtMs = mapped.resetsAtMs || Date.now() + 30_000;
    headers["Retry-After"] = String(
      Math.max(1, Math.ceil((resetsAtMs - Date.now()) / 1000)),
    );
    return new Response(
      JSON.stringify({
        error: {
          message,
          type: "rate_limit_error",
          code: "rate_limit_exceeded",
        },
      }),
      { status, headers },
    );
  }

  // Rebuild stream: peeked bytes + remaining
  const encoder = new TextEncoder();
  const prefix = buf;
  const remainingDone = done;
  const reconstructed = new ReadableStream({
    async start(controller) {
      if (prefix.byteLength) controller.enqueue(prefix);
      if (remainingDone) {
        controller.close();
        return;
      }
      try {
        while (true) {
          const { done: d, value } = await reader.read();
          if (d) break;
          if (value) controller.enqueue(value);
        }
        controller.close();
      } catch (err) {
        try {
          controller.error(err);
        } catch {
          /* ignore */
        }
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });

  const headers = new Headers(response.headers);
  return new Response(reconstructed, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
