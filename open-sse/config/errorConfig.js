// OpenAI-compatible error types mapping (client-facing)
export const ERROR_TYPES = {
  400: { type: "invalid_request_error", code: "bad_request" },
  401: { type: "authentication_error", code: "invalid_api_key" },
  402: { type: "billing_error", code: "payment_required" },
  403: { type: "permission_error", code: "insufficient_quota" },
  404: { type: "invalid_request_error", code: "model_not_found" },
  406: { type: "invalid_request_error", code: "model_not_supported" },
  408: { type: "server_error", code: "request_timeout" },
  429: { type: "rate_limit_error", code: "rate_limit_exceeded" },
  500: { type: "server_error", code: "internal_server_error" },
  502: { type: "server_error", code: "bad_gateway" },
  503: { type: "server_error", code: "service_unavailable" },
  504: { type: "server_error", code: "gateway_timeout" },
  529: { type: "server_error", code: "overloaded" }
};

// Default error messages per status code (client-facing)
export const DEFAULT_ERROR_MESSAGES = {
  400: "Bad request",
  401: "Invalid API key provided",
  402: "Payment required",
  403: "You exceeded your current quota",
  404: "Model not found",
  406: "Model not supported",
  408: "Upstream request timed out",
  429: "Rate limit exceeded",
  500: "Internal server error",
  502: "Bad gateway - upstream provider error",
  503: "Service temporarily unavailable",
  504: "Gateway timeout",
  529: "Server temporarily overloaded"
};

// Exponential backoff config for rate limits.
// Cap 45s — longer locks (128s/256s) on a single shared API key make combo
// fallback worse by parking every model for minutes.
export const BACKOFF_CONFIG = {
  base: 1000,
  max: 45 * 1000,
  maxLevel: 8
};

// Default cooldown for transient/unknown errors
export const TRANSIENT_COOLDOWN_MS = 30 * 1000;

// Hard cap for provider-reported rate limit cooldown (e.g. codex resets_at can be 5-6h)
export const MAX_RATE_LIMIT_COOLDOWN_MS = 30 * 60 * 1000;

// Cooldown durations (ms)
const COOLDOWN = {
  long: 2 * 60 * 1000,
  short: 5 * 1000,
};

/**
 * Unified error classification rules.
 * Checked top-to-bottom: text rules first (by order), then status rules.
 * Each rule: { text?, status?, cooldownMs?, backoff? }
 *   - text: substring match (case-insensitive) on error message
 *   - status: HTTP status code match
 *   - cooldownMs: fixed cooldown duration
 *   - backoff: true = use exponential backoff (rate limit)
 */
export const ERROR_RULES = [
  // --- Text-based rules (checked first, order = priority) ---
  { text: "no credentials",            cooldownMs: COOLDOWN.long },
  { text: "request not allowed",       cooldownMs: COOLDOWN.short },
  { text: "improperly formed request", cooldownMs: COOLDOWN.long },
  // QwenCoder shared-key bursts: fixed short lock (do NOT exponential to 256s)
  { text: "too many attempts",         cooldownMs: 15 * 1000 },
  { text: "upstream_rate_limited",     cooldownMs: 20 * 1000 },
  { text: "rate_limit_error",          cooldownMs: 15 * 1000 },
  { text: "rate limited",              cooldownMs: 15 * 1000 },
  { text: "invalid sse response",      cooldownMs: COOLDOWN.short },
  { text: "rate limit",                backoff: true },
  { text: "too many requests",         backoff: true },
  { text: "quota exceeded",            backoff: true },
  { text: "capacity",                  backoff: true },
  { text: "overloaded",                backoff: true },
  { text: "currently overloaded",      backoff: true },
  { text: "servers are currently overloaded", backoff: true },
  { text: "service overloaded",        backoff: true },

  // --- Status-based rules (fallback when text doesn't match) ---
  { status: 401, cooldownMs: COOLDOWN.long },
  { status: 402, cooldownMs: COOLDOWN.long },
  { status: 403, cooldownMs: COOLDOWN.long },
  { status: 404, cooldownMs: COOLDOWN.long },
  { status: 408, cooldownMs: TRANSIENT_COOLDOWN_MS },
  // Prefer modest fixed lock over unbounded exponential for generic 429
  { status: 429, cooldownMs: 15 * 1000 },
  { status: 529, backoff: true },
];

// Backward compat: COOLDOWN_MS object (used by index.js re-export)
export const COOLDOWN_MS = {
  unauthorized: COOLDOWN.long,
  paymentRequired: COOLDOWN.long,
  notFound: COOLDOWN.long,
  transient: TRANSIENT_COOLDOWN_MS,
  requestNotAllowed: COOLDOWN.short,
};




