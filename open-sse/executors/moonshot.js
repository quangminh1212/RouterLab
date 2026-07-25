import { DefaultExecutor } from "./default.js";

/**
 * Moonshot / Kimi OpenAI-compatible executor.
 * OmniRoute: open-sse/executors/moonshot.ts (core normalization port)
 */

const FIXED_SAMPLING_PARAMS = [
  "temperature",
  "top_p",
  "frequency_penalty",
  "presence_penalty",
  "n",
];

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function normalizeMaxCompletionTokens(body, ceiling) {
  if (body.max_completion_tokens === undefined && body.max_tokens !== undefined) {
    body.max_completion_tokens = body.max_tokens;
  }
  delete body.max_tokens;
  if (
    typeof body.max_completion_tokens === "number" &&
    Number.isFinite(body.max_completion_tokens) &&
    body.max_completion_tokens > ceiling
  ) {
    body.max_completion_tokens = ceiling;
  }
}

export function normalizeMoonshotRequest(model, body) {
  const record = asRecord(body);
  if (!record) return body;

  const normalizedModel = String(model || "").toLowerCase();
  if (!normalizedModel.startsWith("kimi-")) return body;

  const next = { ...record };
  const isK3 = /^kimi-k3(?:$|-)/.test(normalizedModel);
  const isK27 = /^kimi-k2\.7-code(?:$|-)/.test(normalizedModel);
  const isK26 = /^kimi-k2\.6(?:$|-)/.test(normalizedModel);
  const outputCeiling = isK3 ? 1048576 : 262144;

  normalizeMaxCompletionTokens(next, outputCeiling);

  if (isK3 || isK27 || isK26) {
    for (const key of FIXED_SAMPLING_PARAMS) delete next[key];
  } else {
    delete next.temperature;
  }

  if (isK3) {
    delete next.thinking;
    delete next.enable_thinking;
    delete next.reasoning;
    next.reasoning_effort = "max";
    return next;
  }

  // K2 thinking normalization (simplified)
  const existingThinking = asRecord(next.thinking);
  const reasoning = asRecord(next.reasoning);
  const requestedEffort = next.reasoning_effort ?? reasoning?.effort;
  const enableThinking = next.enable_thinking;
  delete next.reasoning_effort;
  delete next.reasoning;
  delete next.enable_thinking;

  const requested =
    typeof requestedEffort === "string" ? requestedEffort.toLowerCase() : "";
  if (
    requested === "none" ||
    requested === "off" ||
    enableThinking === false ||
    existingThinking?.type === "disabled"
  ) {
    next.thinking = { type: "disabled" };
  } else if (
    requested ||
    enableThinking === true ||
    existingThinking?.type === "enabled" ||
    existingThinking?.type === "adaptive"
  ) {
    next.thinking = {
      type: "enabled",
      ...(existingThinking?.keep === "all" ? { keep: "all" } : {}),
    };
  } else {
    delete next.thinking;
  }

  if ((isK27 || isK26) && next.tool_choice === "required") next.tool_choice = "auto";
  return next;
}

export class MoonshotExecutor extends DefaultExecutor {
  constructor(provider = "moonshot") {
    super(provider);
  }

  transformRequest(model, body, stream, credentials) {
    const base = super.transformRequest(model, body, stream, credentials);
    const normalized = normalizeMoonshotRequest(model, base);
    const record = asRecord(normalized);
    if (stream && this.provider === "kimi" && record) {
      return { ...record, stream: true };
    }
    return normalized;
  }
}

export default MoonshotExecutor;
