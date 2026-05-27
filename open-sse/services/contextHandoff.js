import { deleteContextHandoff, getContextHandoff, upsertContextHandoff } from "../../src/lib/localDb.js";

const DEFAULT_MAX_MESSAGES = 16;
const MAX_SUMMARY_CHARS = 1400;
const MAX_PROGRESS_CHARS = 500;
const MAX_ITEMS = 6;

function flattenContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      if (!part || typeof part !== "object") return "";
      if (typeof part.text === "string") return part.text;
      if (typeof part.content === "string") return part.content;
      if (part.type === "input_text" && typeof part.text === "string") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function normalizeLine(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function extractMessages(body, maxMessages = DEFAULT_MAX_MESSAGES) {
  if (!Array.isArray(body?.messages)) return [];
  return body.messages.slice(-maxMessages).map((message) => ({
    role: typeof message?.role === "string" ? message.role : "unknown",
    content: normalizeLine(flattenContent(message?.content), 500),
  })).filter((message) => message.content);
}

function guessEntities(messages = []) {
  const matches = new Set();
  const joined = messages.map((message) => message.content).join("\n");
  for (const match of joined.matchAll(/\b[\w./-]+\.(?:js|ts|tsx|jsx|json|md|yaml|yml)\b/g)) {
    matches.add(match[0]);
    if (matches.size >= MAX_ITEMS) break;
  }
  return Array.from(matches);
}

export function extractSessionId(body) {
  return body?.sessionId
    || body?.metadata?.sessionId
    || body?.metadata?.session_id
    || body?.request?.sessionId
    || "";
}

export function buildHandoffPayload({ body, sessionId, comboName = "", fromAccount = "", provider = "", model = "", maxMessages = DEFAULT_MAX_MESSAGES }) {
  const messages = extractMessages(body, maxMessages);
  if (!sessionId || messages.length === 0) return null;

  const conversationSummary = messages
    .map((message) => `${message.role}: ${message.content}`)
    .join(" | ");

  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const assistantMessages = messages.filter((message) => message.role === "assistant").map((message) => message.content);

  return {
    sessionId,
    comboName,
    fromAccount,
    provider,
    model,
    summary: normalizeLine(conversationSummary, MAX_SUMMARY_CHARS),
    keyDecisions: assistantMessages.slice(-2).map((value) => normalizeLine(value, 180)).filter(Boolean).slice(0, MAX_ITEMS),
    taskProgress: normalizeLine(userMessages.slice(-2).join(" -> "), MAX_PROGRESS_CHARS),
    activeEntities: guessEntities(messages),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
  };
}

export function injectHandoffIntoBody(body, handoff) {
  if (!handoff?.summary) return body;
  const handoffText = [
    "<context_handoff>",
    `summary: ${handoff.summary}`,
    handoff.taskProgress ? `task_progress: ${handoff.taskProgress}` : "",
    Array.isArray(handoff.keyDecisions) && handoff.keyDecisions.length ? `key_decisions: ${handoff.keyDecisions.join(" ; ")}` : "",
    Array.isArray(handoff.activeEntities) && handoff.activeEntities.length ? `active_entities: ${handoff.activeEntities.join(", ")}` : "",
    "</context_handoff>",
  ].filter(Boolean).join("\n");

  const messages = Array.isArray(body?.messages) ? body.messages.map((message) => ({ ...message })) : [];
  const firstSystemIndex = messages.findIndex((message) => message?.role === "system");

  if (firstSystemIndex >= 0) {
    const current = flattenContent(messages[firstSystemIndex].content).trim();
    messages[firstSystemIndex].content = current ? `${current}\n\n${handoffText}` : handoffText;
  } else {
    messages.unshift({ role: "system", content: handoffText });
  }

  return {
    ...body,
    messages,
    _contextRelayInjected: true,
  };
}

export async function loadContextHandoff(sessionId, comboName = "") {
  return getContextHandoff(sessionId, comboName);
}

export async function storeContextHandoff(payload) {
  return upsertContextHandoff(payload);
}

export async function clearContextHandoff(sessionId, comboName = "") {
  return deleteContextHandoff(sessionId, comboName);
}
