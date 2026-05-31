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
 * Adapter for the Antigravity "Cockpit Tools" data-transfer export
 * (schema: "cockpit-tools.data-transfer").
 *
 * Shape:
 *   {
 *     schema: "cockpit-tools.data-transfer",
 *     exported_at, version,
 *     accounts: { platforms: { <platform>: { account_count, exported_data: [ <account>, ... ] } } }
 *   }
 *
 * Each account carries a point-in-time quota/credit snapshot rather than a
 * per-day request history. We extract a "requests used" count per account so
 * it can be folded into the usage totals. One usage entry per account (tagged
 * by the account email) on the export date.
 */
function extractCockpitToolsEntries(root, fallbackDate) {
  const platforms = root?.accounts?.platforms;
  if (!isObject(platforms)) return [];

  const exportDateKey = toDateKey(
    root.exported_at || root.exportedAt || root.accounts?.exported_at,
    fallbackDate
  );
  const entries = [];

  for (const [platform, node] of Object.entries(platforms)) {
    const list = Array.isArray(node?.exported_data) ? node.exported_data : [];
    for (const acc of list) {
      if (!isObject(acc)) continue;
      const used = extractAccountUsedCount(platform, acc);
      if (used <= 0) continue;
      entries.push({
        dateKey: exportDateKey,
        provider: platform,
        model: pickString(acc, ["plan_name", "plan_type", "copilot_plan", "plan_tier"], "plan"),
        account: pickString(acc, ["email", "github_login", "github_email", "account_name", "user_id", "id"], ""),
        requests: Math.round(used),
        promptTokens: 0,
        completionTokens: 0,
        cost: 0,
      });
    }
  }

  return entries;
}

/**
 * Derive a "consumed units" count from a Cockpit Tools account snapshot.
 * Returns 0 when no absolute count can be derived (e.g. codex only exposes a
 * percentage, which cannot be converted to an absolute request count).
 */
function extractAccountUsedCount(platform, acc) {
  // Kiro: explicit consumed credits (+ bonus credits).
  const creditsUsed = pickNumber(acc, ["credits_used"], 0) + pickNumber(acc, ["bonus_used"], 0);
  if (creditsUsed > 0) return creditsUsed;

  // GitHub Copilot: entitlement - remaining, summed across metered quotas.
  const snapshots = acc.copilot_quota_snapshots;
  if (isObject(snapshots)) {
    let usedTotal = 0;
    for (const snap of Object.values(snapshots)) {
      if (!isObject(snap) || snap.unlimited) continue;
      const entitlement = pickNumber(snap, ["entitlement"], 0);
      const remaining = pickNumber(snap, ["quota_remaining", "remaining"], entitlement);
      const used = entitlement - remaining;
      if (used > 0) usedTotal += used;
    }
    if (usedTotal > 0) return usedTotal;
  }

  // Generic used/total style fields on the account itself.
  const directUsed = pickNumber(acc, ["used", "usedCount", "requestsUsed", "usage_count"], 0);
  if (directUsed > 0) return directUsed;

  return 0;
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

  // Shape 0 (highest priority): Antigravity "Cockpit Tools" data-transfer export.
  const looksLikeCockpitTools =
    (typeof root.schema === "string" && root.schema.includes("cockpit")) ||
    isObject(root?.accounts?.platforms);
  if (looksLikeCockpitTools) {
    const entries = extractCockpitToolsEntries(root, fallbackDate);
    if (entries.length) {
      return { entries, shape: "cockpit-tools", exportedAt: exportedAtRaw || null, warnings };
    }
    warnings.push(
      "Cockpit Tools export detected but no account exposed an absolute usage count " +
        "(e.g. Codex only reports a percentage). Nothing to merge."
    );
  }

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
