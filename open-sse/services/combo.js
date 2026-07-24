/**
 * Shared combo (model combo) handling with fallback support
 */

import { checkFallbackError, formatRetryAfter } from "./accountFallback.js";
import { unavailableResponse } from "../utils/error.js";
import { handleFusionChat } from "./comboFusion.js";

/**
 * Track rotation state per combo (for round-robin strategy)
 * @type {Map<string, { index: number, requestCount: number }>}
 */
const comboRotationState = new Map();
const comboPerformanceState = new Map();
const RECENT_FAILURE_WINDOW_MS = 2 * 60 * 1000;
const FAILURE_PENALTY_MS = 2000;
const LATENCY_WINDOW_SIZE = 20;
const SLOW_MODEL_MIN_SAMPLES = Math.max(3, Number(process.env.COMBO_SLOW_MODEL_MIN_SAMPLES) || 6);
const SLOW_MODEL_P95_MS = Math.max(5000, Number(process.env.COMBO_SLOW_MODEL_P95_MS) || 18000);
const SLOW_MODEL_COOLDOWN_MS = Math.max(30000, Number(process.env.COMBO_SLOW_MODEL_COOLDOWN_MS) || 3 * 60 * 1000);

function getComboPerf(comboName) {
  if (!comboName) return null;
  if (!comboPerformanceState.has(comboName)) comboPerformanceState.set(comboName, new Map());
  return comboPerformanceState.get(comboName);
}

function getLatencyP95(samples) {
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function getLatencyScore(perf) {
  if (!perf) return 0;
  return getLatencyP95(perf.latencyWindow) || perf.avgLatencyMs || 0;
}

function maybeApplySlowCooldown(current, enabled = true) {
  if (!enabled) return;
  if (!current || current.samples < SLOW_MODEL_MIN_SAMPLES) return;
  const p95 = current.p95LatencyMs || getLatencyP95(current.latencyWindow) || 0;
  if (p95 < SLOW_MODEL_P95_MS) return;

  const now = Date.now();
  if (current.slowCooldownUntil && current.slowCooldownUntil > now) return;
  current.slowCooldownUntil = now + SLOW_MODEL_COOLDOWN_MS;
}

function recordComboResult(comboName, modelStr, durationMs, ok, slowCooldownEnabled = true) {
  if (!comboName || !modelStr || !Number.isFinite(durationMs) || durationMs <= 0) return;
  const perf = getComboPerf(comboName);
  const current = perf.get(modelStr) || { avgLatencyMs: durationMs, samples: 0, failures: 0, lastFailureAt: 0, latencyWindow: [] };
  if (!Array.isArray(current.latencyWindow)) current.latencyWindow = [];
  current.latencyWindow.push(durationMs);
  if (current.latencyWindow.length > LATENCY_WINDOW_SIZE) current.latencyWindow.shift();
  current.p95LatencyMs = getLatencyP95(current.latencyWindow);
  current.samples += 1;
  current.avgLatencyMs = current.samples === 1
    ? durationMs
    : Number((((current.avgLatencyMs * (current.samples - 1)) + durationMs) / current.samples).toFixed(2));
  current.lastLatencyMs = durationMs;
  if (ok) maybeApplySlowCooldown(current, slowCooldownEnabled);
  if (ok) {
    current.failures = 0;
    current.lastSuccessAt = Date.now();
  } else {
    current.failures += 1;
    current.lastFailureAt = Date.now();
  }
  perf.set(modelStr, current);
}

function rankComboModels(models, comboName, strategy, slowCooldownEnabled = true) {
  if (!comboName || !Array.isArray(models) || models.length <= 1) {
    return models;
  }

  const strat = normalizeStrategy(strategy);
  // Round-robin / random / p2c / weighted already ordered by getRotatedModels
  if (strat === "round-robin" || strat === "random" || strat === "p2c" || strat === "weighted" || strat === "fusion") {
    return models;
  }
  // Fixed order: fallback / priority / fill-first
  if (strat === "fallback") {
    return models;
  }

  const perf = getComboPerf(comboName);
  return [...models].sort((left, right) => {
    const leftPerf = perf?.get(left);
    const rightPerf = perf?.get(right);
    const now = Date.now();
    const leftPenalty = leftPerf?.lastFailureAt && (now - leftPerf.lastFailureAt) < RECENT_FAILURE_WINDOW_MS
      ? Math.min(FAILURE_PENALTY_MS * Math.max(1, leftPerf.failures || 1), 10000)
      : 0;
    const rightPenalty = rightPerf?.lastFailureAt && (now - rightPerf.lastFailureAt) < RECENT_FAILURE_WINDOW_MS
      ? Math.min(FAILURE_PENALTY_MS * Math.max(1, rightPerf.failures || 1), 10000)
      : 0;
    const leftSlowPenalty = slowCooldownEnabled && leftPerf?.slowCooldownUntil && leftPerf.slowCooldownUntil > now ? 100000 : 0;
    const rightSlowPenalty = slowCooldownEnabled && rightPerf?.slowCooldownUntil && rightPerf.slowCooldownUntil > now ? 100000 : 0;

    if (strat === "least-used") {
      const ls = leftPerf?.samples || 0;
      const rs = rightPerf?.samples || 0;
      if (ls !== rs) return ls - rs;
    }

    // cost-optimized / auto / lkgp / context-optimized: latency + failure + slow cooldown
    const leftScore = getLatencyScore(leftPerf) + leftPenalty + leftSlowPenalty;
    const rightScore = getLatencyScore(rightPerf) + rightPenalty + rightSlowPenalty;
    if (leftScore !== rightScore) return leftScore - rightScore;
    return models.indexOf(left) - models.indexOf(right);
  });
}

/**
 * Self-healing optimizer (OmniRoute parity): return models reordered by live performance.
 * Callers can persist this order into combo.models periodically.
 */
export function suggestOptimizedComboOrder(comboName, models, { slowCooldownEnabled = true } = {}) {
  if (!Array.isArray(models) || models.length <= 1) return models || [];
  return rankComboModels(models, comboName, "auto", slowCooldownEnabled);
}

/**
 * Supported combo routing strategies (OmniRoute/9router parity).
 * - fallback / priority / fill-first: fixed order (first healthy wins)
 * - round-robin: sticky rotation
 * - random / strict-random: shuffle order each request
 * - least-used: fewest samples first
 * - cost-optimized: lowest avg latency score first (proxy for cost when pricing missing)
 * - p2c: power-of-two-choices — pick best of two random candidates, try that first
 * - weighted: prefer earlier models but allow random exploration
 * - auto / lkgp / context-optimized: performance-ranked (same as latency rank)
 */
export const COMBO_STRATEGIES = [
  "fallback",
  "priority",
  "fill-first",
  "round-robin",
  "random",
  "strict-random",
  "least-used",
  "cost-optimized",
  "p2c",
  "weighted",
  "auto",
  "lkgp",
  "context-optimized",
  "fusion",
];

function normalizeStrategy(strategy) {
  const s = String(strategy || "fallback").toLowerCase().trim();
  if (s === "priority" || s === "fill-first" || s === "fillfirst") return "fallback";
  if (s === "strict-random" || s === "strictrandom") return "random";
  if (s === "power-of-two" || s === "power-of-two-choices") return "p2c";
  if (s === "context-relay") return "context-optimized";
  return s;
}

function shuffleCopy(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Get rotated model list based on strategy
 * @param {string[]} models - Array of model strings
 * @param {string} comboName - Name of the combo
 * @param {string} strategy - see COMBO_STRATEGIES
 * @param {number} [stickyLimit=1] - Number of requests before rotating (sticky round-robin)
 * @returns {string[]} Rotated models array
 */
export function getRotatedModels(models, comboName, strategy, stickyLimit = 1) {
  if (!models || models.length <= 1) {
    return models;
  }

  const strat = normalizeStrategy(strategy);

  // Fixed order strategies
  if (strat === "fallback" || strat === "fusion") {
    return models;
  }

  if (strat === "random") {
    return shuffleCopy(models);
  }

  if (strat === "p2c") {
    const a = Math.floor(Math.random() * models.length);
    let b = Math.floor(Math.random() * models.length);
    if (b === a) b = (b + 1) % models.length;
    const perf = getComboPerf(comboName);
    const score = (m) => {
      const p = perf?.get(m);
      return getLatencyScore(p) + (p?.failures || 0) * FAILURE_PENALTY_MS;
    };
    const first = score(models[a]) <= score(models[b]) ? models[a] : models[b];
    return [first, ...models.filter((m) => m !== first)];
  }

  if (strat === "weighted") {
    // 70% keep declared order, 30% promote a random later model to front
    if (Math.random() > 0.3 || models.length < 2) return models;
    const idx = 1 + Math.floor(Math.random() * (models.length - 1));
    const pick = models[idx];
    return [pick, ...models.filter((m) => m !== pick)];
  }

  if (strat === "least-used" || strat === "cost-optimized" || strat === "auto" || strat === "lkgp" || strat === "context-optimized") {
    // rankComboModels handles ordering; keep declared order here
    return models;
  }

  if (strat !== "round-robin") {
    return models;
  }

  const state = comboRotationState.get(comboName) || { index: 0, requestCount: 0 };
  const rotatedModels = [...models];
  
  // Rotate: move models from currentIndex to front, preserving order after
  for (let i = 0; i < state.index; i++) {
    const moved = rotatedModels.shift();
    rotatedModels.push(moved);
  }
  
  // Increment request count
  state.requestCount++;
  
  // Rotate to next model only after stickyLimit requests
  if (state.requestCount >= stickyLimit) {
    state.index = (state.index + 1) % models.length;
    state.requestCount = 0;
  }
  
  comboRotationState.set(comboName, state);
  
  return rotatedModels;
}

/**
 * Reset in-memory rotation state when combo/settings change
 * @param {string} [comboName] - Combo name to reset; omit to clear all
 */

function parseRetryAfterSecondsFromText(text) {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/reset after (?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const total = (hours * 3600) + (minutes * 60) + seconds;
  return Number.isFinite(total) && total > 0 ? total : null;
}

function parseRetryAfterMsFromHeaders(headers, now = Date.now()) {
  if (!headers?.get) return null;

  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const raw = String(retryAfter).trim();
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return now + Math.max(0, seconds) * 1000;
    const dateMs = Date.parse(raw);
    if (Number.isFinite(dateMs) && dateMs > now) return dateMs;
  }

  for (const name of ["x-ratelimit-reset", "x-rate-limit-reset", "ratelimit-reset"]) {
    const raw = headers.get(name);
    if (!raw) continue;
    const value = Number(String(raw).trim());
    if (!Number.isFinite(value)) continue;
    const millis = value > 10000000000 ? value : value * 1000;
    if (millis > now) return millis;
  }

  return null;
}

function toRetryAfterIso(ms) {
  return Number.isFinite(ms) && ms > Date.now() ? new Date(ms).toISOString() : null;
}

export function resetComboRotation(comboName) {
  if (comboName) comboRotationState.delete(comboName);
  else comboRotationState.clear();
}

export function getComboPerformanceSnapshot() {
  const combos = {};
  for (const [comboName, modelMap] of comboPerformanceState.entries()) {
    combos[comboName] = Array.from(modelMap.entries()).map(([model, perf]) => ({
      model,
      samples: perf.samples || 0,
      avgLatencyMs: perf.avgLatencyMs || 0,
      p95LatencyMs: perf.p95LatencyMs || getLatencyP95(perf.latencyWindow) || 0,
      lastLatencyMs: perf.lastLatencyMs || 0,
      failures: perf.failures || 0,
      lastFailureAt: perf.lastFailureAt || null,
      lastSuccessAt: perf.lastSuccessAt || null,
      slowCooldownUntil: perf.slowCooldownUntil || null,
    })).sort((a, b) => {
      const aPenalty = a.lastFailureAt && (Date.now() - a.lastFailureAt) < RECENT_FAILURE_WINDOW_MS
        ? Math.min(FAILURE_PENALTY_MS * Math.max(1, a.failures || 1), 10000)
        : 0;
      const bPenalty = b.lastFailureAt && (Date.now() - b.lastFailureAt) < RECENT_FAILURE_WINDOW_MS
        ? Math.min(FAILURE_PENALTY_MS * Math.max(1, b.failures || 1), 10000)
        : 0;
      const now = Date.now();
      const aSlowPenalty = a.slowCooldownUntil && a.slowCooldownUntil > now ? 100000 : 0;
      const bSlowPenalty = b.slowCooldownUntil && b.slowCooldownUntil > now ? 100000 : 0;
      return ((a.p95LatencyMs || a.avgLatencyMs || 0) + aPenalty + aSlowPenalty) - ((b.p95LatencyMs || b.avgLatencyMs || 0) + bPenalty + bSlowPenalty);
    });
  }

  return {
    combos,
    config: {
      latencyWindowSize: LATENCY_WINDOW_SIZE,
      recentFailureWindowMs: RECENT_FAILURE_WINDOW_MS,
      failurePenaltyMs: FAILURE_PENALTY_MS,
      slowModelMinSamples: SLOW_MODEL_MIN_SAMPLES,
      slowModelP95Ms: SLOW_MODEL_P95_MS,
      slowModelCooldownMs: SLOW_MODEL_COOLDOWN_MS,
    },
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Get combo models from combos data
 * @param {string} modelStr - Model string to check
 * @param {Array|Object} combosData - Array of combos or object with combos
 * @returns {string[]|null} Array of models or null if not a combo
 */
export function getComboModelsFromData(modelStr, combosData) {
  // Don't check if it's in provider/model format
  if (modelStr.includes("/")) return null;
  
  // Handle both array and object formats
  const combos = Array.isArray(combosData) ? combosData : (combosData?.combos || []);
  
  const combo = combos.find(c => c.name === modelStr);
  if (combo && combo.models && combo.models.length > 0) {
    return combo.models;
  }
  return null;
}

/**
 * Handle combo chat with fallback
 * @param {Object} options
 * @param {Object} options.body - Request body
 * @param {string[]} options.models - Array of model strings to try
 * @param {Function} options.handleSingleModel - Function to handle single model: (body, modelStr) => Promise<Response>
 * @param {Object} options.log - Logger object
 * @param {string} [options.comboName] - Name of the combo (for round-robin tracking)
 * @param {string} [options.comboStrategy] - Strategy: "fallback", "round-robin", or "fusion"
 * @param {number} [options.comboStickyLimit=1] - Number of requests before rotating (sticky round-robin)
 * @param {string} [options.fusionJudgeModel] - Model to use as fusion judge (defaults to first combo model)
 * @returns {Promise<Response>}
 */
export async function handleComboChat({ body, models, handleSingleModel, log, comboName, comboStrategy, comboStickyLimit = 1, comboSlowModelCooldownEnabled = true, fusionJudgeModel }) {
  if (comboStrategy === "fusion") {
    return handleFusionChat({ body, models, handleSingleModel, log, comboName, fusionJudgeModel });
  }

  // Apply rotation strategy if enabled
  const rotatedModels = rankComboModels(
    getRotatedModels(models, comboName, comboStrategy, comboStickyLimit),
    comboName,
    comboStrategy,
    comboSlowModelCooldownEnabled,
  );

  if (comboName && rotatedModels.join("|") !== models.join("|")) {
    log.info("COMBO", `Ranked combo order: ${rotatedModels.join(" -> ")}`);
  }
  
  let lastError = null;
  let earliestRetryAfter = null;
  let lastStatus = null;

  for (let i = 0; i < rotatedModels.length; i++) {
    const modelStr = rotatedModels[i];
    log.info("COMBO", `Trying model ${i + 1}/${rotatedModels.length}: ${modelStr}`);

    try {
      const startedAt = Date.now();
      const result = await handleSingleModel(body, modelStr);
      const durationMs = Date.now() - startedAt;
      
      // Success (2xx) - return response
      if (result.ok) {
        recordComboResult(comboName, modelStr, durationMs, true, comboSlowModelCooldownEnabled);
        log.info("COMBO", `Model ${modelStr} succeeded`);
        return result;
      }

      // Extract error info from response
      let errorText = result.statusText || "";
      let retryAfter = null;
      try {
        const errorBody = await result.clone().json();
        errorText = errorBody?.error?.message || errorBody?.error || errorBody?.message || errorText;
        retryAfter = errorBody?.retryAfter || null;
      } catch {
        // Ignore JSON parse errors
      }

      const headerRetryAfter = toRetryAfterIso(parseRetryAfterMsFromHeaders(result.headers));
      if (!retryAfter && headerRetryAfter) retryAfter = headerRetryAfter;

      // Track earliest retryAfter across all combo models
      if (retryAfter && (!earliestRetryAfter || new Date(retryAfter) < new Date(earliestRetryAfter))) {
        earliestRetryAfter = retryAfter;
      }

      // Normalize error text to string (Worker-safe)
      if (typeof errorText !== "string") {
        try { errorText = JSON.stringify(errorText); } catch { errorText = String(errorText); }
      }

      // Check if should fallback to next model
      const { shouldFallback, cooldownMs } = checkFallbackError(result.status, errorText);

      if (!shouldFallback) {
        recordComboResult(comboName, modelStr, durationMs, false, comboSlowModelCooldownEnabled);
        log.warn("COMBO", `Model ${modelStr} failed (no fallback)`, { status: result.status, reason: errorText });
        return result;
      }

      // For transient errors (503/502/504), wait for cooldown before falling through
      // so a briefly-overloaded provider gets a chance to recover rather than being
      // skipped immediately (fixes: combo falls through on transient 503)
      if (cooldownMs && cooldownMs > 0 && cooldownMs <= 1200 &&
          (result.status === 503 || result.status === 502 || result.status === 504)) {
        log.info("COMBO", `Model ${modelStr} transient ${result.status}, waiting ${cooldownMs}ms before next`);
        await new Promise(r => setTimeout(r, cooldownMs));
      }

      // Fallback to next model
      recordComboResult(comboName, modelStr, durationMs, false, comboSlowModelCooldownEnabled);
      lastError = errorText || String(result.status);
      if (!lastStatus) lastStatus = result.status;
      log.warn("COMBO", `Model ${modelStr} failed, trying next`, { status: result.status, reason: errorText, cooldownMs });
    } catch (error) {
      // Catch unexpected exceptions to ensure fallback continues
      lastError = error.message || String(error);
      if (!lastStatus) lastStatus = 500;
      recordComboResult(comboName, modelStr, 1, false, comboSlowModelCooldownEnabled);
      log.warn("COMBO", `Model ${modelStr} threw error, trying next`, { error: lastError, reason: lastError });
    }
  }

  // All models failed
  // Use 503 (Service Unavailable) rather than 406 (Not Acceptable) — 406 implies
  // the request itself is invalid, but here the providers are simply unavailable
  // or have no active credentials. 503 is more accurate and retryable by clients.
  const allDisabled = lastError && lastError.toLowerCase().includes("no credentials");
  const status = allDisabled ? 503 : (lastStatus || 503);
  const msg = lastError || "All combo models unavailable";

  if (earliestRetryAfter) {
    const retryHuman = formatRetryAfter(earliestRetryAfter);
    log.warn("COMBO", `All models failed | ${msg} (${retryHuman})`);
    return unavailableResponse(status, msg, earliestRetryAfter, retryHuman);
  }

  const headers = { "Content-Type": "application/json" };
  const errorPayload = { error: { message: msg } };
  const retryAfterSeconds = parseRetryAfterSecondsFromText(lastError);
  if (retryAfterSeconds) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  log.warn("COMBO", `All models failed | ${msg}`);
  return new Response(
    JSON.stringify(errorPayload),
    { status, headers }
  );
}


