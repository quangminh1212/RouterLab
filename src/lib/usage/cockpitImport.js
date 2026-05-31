/**
 * Cockpit usage import — parse a Cockpit / Antigravity-style "Data Export"
 * file and normalize it into usage entries that can be merged additively into
 * XLab Router's usage `dailySummary`.
 *
 * Why this exists:
 *   For accounts where XLab Router only holds a chat token (no scope to read
 *   the provider's quota API), the Antigravity "Cockpit" panel is the only
 *   place that sees usage. Exporting from Cockpit and importing here lets that
 *   usage be folded into the totals XLab Router already tracks.
 *
 * Design:
 *   The exact export schema can vary by Cockpit/Antigravity version, so the
 *   parser is intentionally tolerant. It recognizes three broad shapes and
 *   normalizes them to a common entry list. Field mapping is centralized in
 *   `pickNumber` / `pickString` so adapting to a new export only touches the
 *   alias tables below.
 */

// Token field aliases seen across export variants.
const PROMPT_KEYS = [
  "prompt_tokens", "promptTokens", "input_tokens", "inputTokens",
  "tokensIn", "tokens_in", "inputTokenCount", "promptTokenCount",
];
const COMPLETION_KEYS = [
  "completion_tokens", "completionTokens", "output_tokens", "outputTokens",
  "tokensOut", "tokens_out", "outputTokenCount", "completionTokenCount",
];
const REQUEST_KEYS = [
  "requests", "requestCount", "request_count", "count", "calls", "numRequests",
  "interactions", "messages",
];
const COST_KEYS = ["cost", "totalCost", "amount", "spend", "usd", "creditsUsed"];
const MODEL_KEYS = ["model", "modelId", "model_id", "modelKey", "name", "displayName"];
const PROVIDER_KEYS = ["provider", "vendor", "source", "platform"];
const DATE_KEYS = ["date", "day", "timestamp", "time", "createdAt", "created_at", "ts", "occurredAt"];

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function pickNumber(obj, keys, fallback = 0) {
  for (const key of keys) {
    const v = obj?.[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return fallback;
}

function pickString(obj, keys, fallback = "") {
  for (const key of keys) {
    const v = obj?.[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return fallback;
}

/**
 * Convert any recognized date value to a local YYYY-MM-DD key.
 * Falls back to the provided default date when none is present.
 */
export function toDateKey(value, fallbackDate) {
  let d = null;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    d = new Date(value < 1e12 ? value * 1000 : value);
  } else if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    // Already a date-only key.
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  if (!d || Number.isNaN(d.getTime())) {
    d = fallbackDate instanceof Date ? fallbackDate : new Date();
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Locate the array of usage records inside an arbitrary export object.
 * Returns { records, container } or { records: null }.
 */
function findRecordArray(root) {
  if (Array.isArray(root)) return { records: root };

  const candidatePaths = [
    ["usage"], ["records"], ["events", ], ["items"], ["entries"], ["rows"],
    ["data", "usage"], ["data", "records"], ["data", "events"],
    ["usage", "records"], ["usage", "events"], ["usage", "history"],
    ["account", "usage"], ["analytics", "usage"],
  ];

  for (const pathKeys of candidatePaths) {
    let node = root;
    let ok = true;
    for (const k of pathKeys) {
      if (isObject(node) && Array.isArray(node[k])) { node = node[k]; }
      else if (isObject(node) && isObject(node[k])) { node = node[k]; }
      else { ok = false; break; }
    }
    if (ok && Array.isArray(node)) return { records: node };
  }

  return { records: null };
}

/**
 * Locate a quota/model map: { models|quotas: { "<model>": { used, total, ... } } }
 */
function findModelMap(root) {
  const candidates = [root?.models, root?.quotas, root?.usage?.models, root?.usage?.quotas, root?.data?.models];
  for (const c of candidates) {
    if (isObject(c)) return c;
  }
  return null;
}

function normalizeRecord(rec, fallbackDate) {
  if (!isObject(rec)) return null;
  const requests = pickNumber(rec, REQUEST_KEYS, 0);
  const promptTokens = pickNumber(rec, PROMPT_KEYS, 0);
  const completionTokens = pickNumber(rec, COMPLETION_KEYS, 0);
  const cost = pickNumber(rec, COST_KEYS, 0);

  // Skip rows that carry no measurable usage at all.
  if (requests === 0 && promptTokens === 0 && completionTokens === 0 && cost === 0) {
    return null;
  }

  return {
    dateKey: toDateKey(rec[DATE_KEYS.find((k) => rec[k] != null)], fallbackDate),
    provider: pickString(rec, PROVIDER_KEYS, "cockpit"),
    model: pickString(rec, MODEL_KEYS, "unknown"),
    requests: requests > 0 ? Math.round(requests) : (promptTokens || completionTokens || cost ? 1 : 0),
    promptTokens: Math.max(0, Math.round(promptTokens)),
    completionTokens: Math.max(0, Math.round(completionTokens)),
    cost: cost > 0 ? cost : 0,
  };
}

/**
 * Parse a Cockpit export payload into normalized usage entries.
 *
 * @param {object|Array|string} input - parsed JSON object/array, or raw JSON string.
 * @returns {{ entries: Array, shape: string, exportedAt: string|null, warnings: string[] }}
 */
export function parseCockpitExport(input) {
  const warnings = [];
  let root = input;
  if (typeof input === "string") {
    try {
      root = JSON.parse(input);
    } catch {
      return { entries: [], shape: "invalid", exportedAt: null, warnings: ["File is not valid JSON."] };
    }
  }
  if (!root || (typeof root !== "object")) {
    return { entries: [], shape: "invalid", exportedAt: null, warnings: ["Unsupported export structure."] };
  }

  const exportedAtRaw = pickString(root, ["exportedAt", "exported_at", "generatedAt", "createdAt", "date"], "");
  const fallbackDate = exportedAtRaw && !Number.isNaN(new Date(exportedAtRaw).getTime())
    ? new Date(exportedAtRaw)
    : new Date();

  // Shape A: explicit record/event array.
  const { records } = findRecordArray(root);
  if (Array.isArray(records) && records.length) {
    const entries = records.map((r) => normalizeRecord(r, fallbackDate)).filter(Boolean);
    if (entries.length) {
      return { entries, shape: "records", exportedAt: exportedAtRaw || null, warnings };
    }
    warnings.push("Found a record array but no rows contained usage numbers.");
  }

  // Shape B: quota/model map (per-model used counts, no per-day breakdown).
  const modelMap = findModelMap(root);
  if (modelMap) {
    const entries = [];
    for (const [modelKey, info] of Object.entries(modelMap)) {
      if (!isObject(info)) continue;
      const used = pickNumber(info, ["used", "usedCount", "consumed", "requestsUsed", ...REQUEST_KEYS], 0);
      const promptTokens = pickNumber(info, PROMPT_KEYS, 0);
      const completionTokens = pickNumber(info, COMPLETION_KEYS, 0);
      const cost = pickNumber(info, COST_KEYS, 0);
      if (used === 0 && promptTokens === 0 && completionTokens === 0 && cost === 0) continue;
      entries.push({
        dateKey: toDateKey(info.resetTime || info.date || exportedAtRaw, fallbackDate),
        provider: pickString(info, PROVIDER_KEYS, "cockpit"),
        model: modelKey,
        requests: used > 0 ? Math.round(used) : 0,
        promptTokens: Math.max(0, Math.round(promptTokens)),
        completionTokens: Math.max(0, Math.round(completionTokens)),
        cost: cost > 0 ? cost : 0,
      });
    }
    if (entries.length) {
      return { entries, shape: "quota", exportedAt: exportedAtRaw || null, warnings };
    }
  }

  // Shape C: a re-export of our own summary-only format.
  if (isObject(root.dailySummary)) {
    const entries = [];
    for (const [dateKey, day] of Object.entries(root.dailySummary)) {
      if (!isObject(day)) continue;
      const byModel = isObject(day.byModel) ? day.byModel : null;
      if (byModel) {
        for (const [mKey, m] of Object.entries(byModel)) {
          if (!isObject(m)) continue;
          const [rawModel, provider] = String(mKey).split("|");
          entries.push({
            dateKey,
            provider: m.provider || provider || "cockpit",
            model: m.rawModel || rawModel || "unknown",
            requests: Math.round(Number(m.requests || 0)),
            promptTokens: Math.max(0, Math.round(Number(m.promptTokens || 0))),
            completionTokens: Math.max(0, Math.round(Number(m.completionTokens || 0))),
            cost: Number(m.cost || 0),
          });
        }
      } else {
        entries.push({
          dateKey,
          provider: "cockpit",
          model: "unknown",
          requests: Math.round(Number(day.requests || 0)),
          promptTokens: Math.max(0, Math.round(Number(day.promptTokens || 0))),
          completionTokens: Math.max(0, Math.round(Number(day.completionTokens || 0))),
          cost: Number(day.cost || 0),
        });
      }
    }
    if (entries.length) {
      return { entries, shape: "dailySummary", exportedAt: exportedAtRaw || null, warnings };
    }
  }

  warnings.push("No recognizable usage data found in export.");
  return { entries: [], shape: "unknown", exportedAt: exportedAtRaw || null, warnings };
}

/**
 * Aggregate normalized entries into a totals summary (for preview/UI).
 */
export function summarizeEntries(entries) {
  const totals = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, days: new Set(), models: new Set() };
  for (const e of entries) {
    totals.requests += e.requests || 0;
    totals.promptTokens += e.promptTokens || 0;
    totals.completionTokens += e.completionTokens || 0;
    totals.cost += e.cost || 0;
    totals.days.add(e.dateKey);
    totals.models.add(e.model);
  }
  return {
    requests: totals.requests,
    promptTokens: totals.promptTokens,
    completionTokens: totals.completionTokens,
    cost: totals.cost,
    dayCount: totals.days.size,
    modelCount: totals.models.size,
  };
}
