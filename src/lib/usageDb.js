import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs";
import { DATA_DIR } from "@/lib/dataDir.js";
import { getDb as getMainDb } from "@/lib/localDb.js";

const isCloud = typeof caches !== 'undefined' || typeof caches === 'object';
const DB_FILE = isCloud ? null : path.join(DATA_DIR, "usage.json");
const LOG_FILE = isCloud ? null : path.join(DATA_DIR, "log.txt");

// Ensure data directory exists
if (!isCloud && fs && typeof fs.existsSync === "function") {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`[usageDb] Created data directory: ${DATA_DIR}`);
    }
  } catch (error) {
    console.error("[usageDb] Failed to create data directory:", error.message);
  }
}

const defaultData = {
  history: [],
  totalRequestsLifetime: 0,
  dailySummary: {},
};

function createUsageData() {
  return {
    history: [],
    totalRequestsLifetime: 0,
    dailySummary: {},
  };
}

function ensureUsageDataShape(value) {
  const data = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : createUsageData();

  if (!Array.isArray(data.history)) data.history = [];
  if (typeof data.totalRequestsLifetime !== "number") data.totalRequestsLifetime = data.history.length;
  if (!data.dailySummary || typeof data.dailySummary !== "object" || Array.isArray(data.dailySummary)) data.dailySummary = {};

  return data;
}

function getLocalDateKey(timestamp) {
  const d = timestamp ? new Date(timestamp) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addToCounter(target, key, values) {
  if (!target[key]) target[key] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
  target[key].requests += values.requests || 1;
  target[key].promptTokens += values.promptTokens || 0;
  target[key].completionTokens += values.completionTokens || 0;
  target[key].cost += values.cost || 0;
  if (values.meta) Object.assign(target[key], values.meta);
}

function aggregateEntryToDailySummary(dailySummary, entry) {
  const dateKey = getLocalDateKey(entry.timestamp);
  if (!dailySummary[dateKey]) {
    dailySummary[dateKey] = {
      requests: 0, promptTokens: 0, completionTokens: 0, cost: 0,
      byProvider: {}, byModel: {}, byAccount: {}, byApiKey: {}, byEndpoint: {},
    };
  }
  const day = dailySummary[dateKey];
  const promptTokens = entry.tokens?.prompt_tokens || entry.tokens?.input_tokens || 0;
  const completionTokens = entry.tokens?.completion_tokens || entry.tokens?.output_tokens || 0;
  const cost = entry.cost || 0;
  const vals = { promptTokens, completionTokens, cost };

  day.requests += 1;
  day.promptTokens += promptTokens;
  day.completionTokens += completionTokens;
  day.cost += cost;

  if (entry.provider) addToCounter(day.byProvider, entry.provider, vals);

  const modelKey = entry.provider ? `${entry.model}|${entry.provider}` : entry.model;
  addToCounter(day.byModel, modelKey, { ...vals, meta: { rawModel: entry.model, provider: entry.provider } });

  if (entry.connectionId) {
    addToCounter(day.byAccount, entry.connectionId, { ...vals, meta: { rawModel: entry.model, provider: entry.provider } });
  }

  const apiKeyVal = entry.apiKey && typeof entry.apiKey === "string" ? entry.apiKey : "local-no-key";
  const akModelKey = `${apiKeyVal}|${entry.model}|${entry.provider || "unknown"}`;
  addToCounter(day.byApiKey, akModelKey, { ...vals, meta: { rawModel: entry.model, provider: entry.provider, apiKey: entry.apiKey || null } });

  const endpoint = entry.endpoint || "Unknown";
  const epKey = `${endpoint}|${entry.model}|${entry.provider || "unknown"}`;
  addToCounter(day.byEndpoint, epKey, { ...vals, meta: { endpoint, rawModel: entry.model, provider: entry.provider } });
}

function migrateHistoryToDailySummary(db) {
  const history = db.data.history || [];
  if (!history.length) return false;
  db.data.dailySummary = {};
  for (const entry of history) {
    aggregateEntryToDailySummary(db.data.dailySummary, entry);
  }
  console.log(`[usageDb] Migrated ${history.length} history entries to dailySummary (${Object.keys(db.data.dailySummary).length} days)`);
  return true;
}

function ensureDailySummaryFromHistory(db) {
  const data = ensureUsageDataShape(db.data);
  const history = Array.isArray(data.history) ? data.history : [];
  const dailySummary = data.dailySummary && typeof data.dailySummary === "object" && !Array.isArray(data.dailySummary)
    ? data.dailySummary
    : {};

  if (!history.length) {
    data.dailySummary = dailySummary;
    db.data = data;
    return false;
  }

  const summaryKeys = new Set(Object.keys(dailySummary));
  const hasMissingHistoryDay = history.some((entry) => {
    const timestamp = new Date(entry?.timestamp).getTime();
    return Number.isFinite(timestamp) && !summaryKeys.has(getLocalDateKey(entry.timestamp));
  });

  if (summaryKeys.size > 0 && !hasMissingHistoryDay) {
    data.dailySummary = dailySummary;
    db.data = data;
    return false;
  }

  db.data = data;
  return migrateHistoryToDailySummary(db);
}

// Singleton instance
let dbInstance = null;

// Use global to share pending state across Next.js route modules
if (!global._pendingRequests) {
  global._pendingRequests = { byModel: {}, byAccount: {} };
}
const pendingRequests = global._pendingRequests;

// Track last error provider for UI edge coloring (auto-clears after 10s)
if (!global._lastErrorProvider) {
  global._lastErrorProvider = { provider: "", ts: 0 };
}
const lastErrorProvider = global._lastErrorProvider;

// Use global to share singleton across Next.js route modules
if (!global._statsEmitter) {
  global._statsEmitter = new EventEmitter();
  global._statsEmitter.setMaxListeners(50);
}
export const statsEmitter = global._statsEmitter;

// Safety timers — force-clear pending counts after 1 min if END was never called
if (!global._pendingTimers) global._pendingTimers = {};
const pendingTimers = global._pendingTimers;

const PENDING_TIMEOUT_MS = 60 * 1000; // 1 minute
const MAX_HISTORY = 10000;
const PENDING_TIMERS_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Periodic cleanup for orphaned timers
if (!global._pendingTimersCleanupInterval) {
  global._pendingTimersCleanupInterval = setInterval(() => {
    const keys = Object.keys(pendingTimers);
    if (keys.length > 100) {
      console.log(`[usageDb] Cleaning up ${keys.length} pending timers`);
      for (const key of keys) {
        clearTimeout(pendingTimers[key]);
        delete pendingTimers[key];
      }
    }
  }, PENDING_TIMERS_CLEANUP_INTERVAL_MS);
  // Prevent interval from blocking process exit
  global._pendingTimersCleanupInterval.unref();
}

/**
 * Track a pending request
 * @param {string} model
 * @param {string} provider
 * @param {string} connectionId
 * @param {boolean} started - true if started, false if finished
 * @param {boolean} [error] - true if ended with error
 */
export function trackPendingRequest(model, provider, connectionId, started, error = false) {
  const modelKey = provider ? `${model} (${provider})` : model;
  const timerKey = `${connectionId}|${modelKey}`;

  // Track by model
  if (!pendingRequests.byModel[modelKey]) pendingRequests.byModel[modelKey] = 0;
  pendingRequests.byModel[modelKey] = Math.max(0, pendingRequests.byModel[modelKey] + (started ? 1 : -1));

  // Track by account
  if (connectionId) {
    if (!pendingRequests.byAccount[connectionId]) pendingRequests.byAccount[connectionId] = {};
    if (!pendingRequests.byAccount[connectionId][modelKey]) pendingRequests.byAccount[connectionId][modelKey] = 0;
    pendingRequests.byAccount[connectionId][modelKey] = Math.max(0, pendingRequests.byAccount[connectionId][modelKey] + (started ? 1 : -1));
  }

  if (started) {
    // Safety timeout: force-clear if END is never called (client disconnect, crash, etc.)
    clearTimeout(pendingTimers[timerKey]);
    pendingTimers[timerKey] = setTimeout(() => {
      delete pendingTimers[timerKey];
      if (pendingRequests.byModel[modelKey] > 0) {
        pendingRequests.byModel[modelKey] = 0;
      }
      if (connectionId && pendingRequests.byAccount[connectionId]?.[modelKey] > 0) {
        pendingRequests.byAccount[connectionId][modelKey] = 0;
      }
      statsEmitter.emit("pending");
    }, PENDING_TIMEOUT_MS);
  } else {
    // END called normally — cancel the safety timer
    clearTimeout(pendingTimers[timerKey]);
    delete pendingTimers[timerKey];
  }

  // Track error provider (auto-clears after 10s)
  if (!started && error && provider) {
    lastErrorProvider.provider = provider.toLowerCase();
    lastErrorProvider.ts = Date.now();
  }

  const t = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  console.log(`[${t}] [PENDING] ${started ? "START" : "END"}${error ? " (ERROR)" : ""} | provider=${provider} | model=${model}`);
  statsEmitter.emit("pending");
}

/**
 * Lightweight: get only activeRequests + recentRequests without full stats recalc
 */
export async function getActiveRequests() {
  const activeRequests = [];

  // Build active requests from pending state
  let connectionMap = {};
  try {
    const { getProviderConnections } = await import("@/lib/localDb.js");
    const allConnections = await getProviderConnections();
    for (const conn of allConnections) {
      connectionMap[conn.id] = conn.name || conn.email || conn.id;
    }
  } catch {}

  for (const [connectionId, models] of Object.entries(pendingRequests.byAccount)) {
    for (const [modelKey, count] of Object.entries(models)) {
      if (count > 0) {
        const accountName = connectionMap[connectionId] || `Account ${connectionId.slice(0, 8)}...`;
        const match = modelKey.match(/^(.*) \((.*)\)$/);
        const modelName = match ? match[1] : modelKey;
        const providerName = match ? match[2] : "unknown";
        activeRequests.push({ model: modelName, provider: providerName, account: accountName, count });
      }
    }
  }

  // Get recent requests from history (re-read to get latest)
  const db = await getUsageDb();
  await db.read();
  const history = db.data.history || [];
  const recentRequestsRaw = await Promise.all(
    [...history]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(async (e) => {
        const t = e.tokens || {};
        const promptTokens = t.prompt_tokens || t.input_tokens || 0;
        const completionTokens = t.completion_tokens || t.output_tokens || 0;
        const existingCost = Number(e.cost || 0);
        const computedCost = existingCost > 0
          ? existingCost
          : await calculateCost(e.provider, e.model, t);
        return {
          timestamp: e.timestamp,
          model: e.model,
          provider: e.provider || "",
          promptTokens,
          completionTokens,
          cost: computedCost,
          status: e.status || "ok",
        };
      })
  );

  const recentRequests = recentRequestsRaw
    .filter((e) => e.promptTokens > 0 || e.completionTokens > 0)
    .slice(0, 20);

  // Error provider (auto-clear after 10s)
  const errorProvider = (Date.now() - lastErrorProvider.ts < 10000) ? lastErrorProvider.provider : "";

  return { activeRequests, recentRequests, errorProvider };
}

/**
 * Get usage database instance (singleton)
 */
export async function getUsageDb() {
  if (isCloud) {
    // Return in-memory DB for Workers
    if (!dbInstance) {
      dbInstance = new Low({ read: async () => {}, write: async () => {} }, defaultData);
      dbInstance.data = defaultData;
    }
    return dbInstance;
  }

  if (!dbInstance) {
    dbInstance = {
      _main: null,
      async read() {
        this._main = await getMainDb();
        this._main.data.usageData = ensureUsageDataShape(this._main.data.usageData);

        // One-time migration from legacy usage.json
        const usageData = this._main.data.usageData;
        const hasHistoryUsage = Array.isArray(usageData.history)
          ? usageData.history.length > 0
          : false;
        const hasDailySummaryUsage = usageData.dailySummary
          && typeof usageData.dailySummary === "object"
          && !Array.isArray(usageData.dailySummary)
          && Object.keys(usageData.dailySummary).length > 0;
        const hasLifetimeUsage = Number.isFinite(usageData.totalRequestsLifetime)
          && usageData.totalRequestsLifetime > 0;
        const hasAnyUsage = hasHistoryUsage || hasDailySummaryUsage || hasLifetimeUsage;
        if (!hasAnyUsage && DB_FILE && fs.existsSync(DB_FILE)) {
          try {
            const legacyRaw = fs.readFileSync(DB_FILE, "utf8");
            const legacy = JSON.parse(legacyRaw || "{}");
            if (legacy && typeof legacy === "object") {
              this._main.data.usageData = ensureUsageDataShape({
                history: Array.isArray(legacy.history) ? legacy.history : [],
                totalRequestsLifetime: Number.isFinite(legacy.totalRequestsLifetime)
                  ? legacy.totalRequestsLifetime
                  : (Array.isArray(legacy.history) ? legacy.history.length : 0),
                dailySummary: legacy.dailySummary && typeof legacy.dailySummary === "object"
                  ? legacy.dailySummary
                  : {},
              });
            }
          } catch {
            // ignore legacy migration failure
          }
        }

        if (ensureDailySummaryFromHistory({ data: this._main.data.usageData })) {
          await this._main.write();
        }
      },
      async write() {
        if (!this._main) return;

        const maxAttempts = 8;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await this._main.write();
            return;
          } catch (error) {
            const isRenameTmpMissing =
              error?.code === "ENOENT"
              && typeof error?.path === "string"
              && error.path.includes(".db.json.tmp");

            if (!isRenameTmpMissing || attempt === maxAttempts) {
              throw error;
            }

            try {
              if (DATA_DIR && fs && !fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
              }
            } catch {}

            try {
              await this._main.read();
            } catch {}

            await new Promise((resolve) => setTimeout(resolve, 120 * attempt));
          }
        }
      },
      get data() {
        if (!this._main?.data) return createUsageData();
        this._main.data.usageData = ensureUsageDataShape(this._main.data.usageData);
        return this._main.data.usageData;
      },
      set data(value) {
        if (!this._main) return;
        this._main.data.usageData = ensureUsageDataShape(value);
      },
    };

    await dbInstance.read();
  }
  return dbInstance;
}

/**
 * Save request usage
 * @param {object} entry - Usage entry { provider, model, tokens: { prompt_tokens, completion_tokens, ... }, connectionId?, apiKey? }
 */
export async function saveRequestUsage(entry) {
  if (isCloud) return; // Skip saving in Workers

  try {
    const db = await getUsageDb();

    // Add timestamp if not present
    if (!entry.timestamp) {
      entry.timestamp = new Date().toISOString();
    }

    // Ensure history array exists
    if (!Array.isArray(db.data.history)) {
      db.data.history = [];
    }
    if (db.data.history.length >= MAX_HISTORY) {
      db.data.history.splice(0, db.data.history.length - MAX_HISTORY + 1);
    }
    if (typeof db.data.totalRequestsLifetime !== "number") {
      db.data.totalRequestsLifetime = db.data.history.length;
    }

    const entryCost = await calculateCost(entry.provider, entry.model, entry.tokens);
    entry.cost = entryCost;

    // Keep API key cost cache in localDb aligned with newly persisted usage
    if (entry.apiKey) {
      try {
        const { invalidateApiKeyCostCache } = await import("@/lib/localDb.js");
        invalidateApiKeyCostCache(entry.apiKey, entryCost);
      } catch {}
    }

    db.data.history.push(entry);
    db.data.totalRequestsLifetime += 1;

    if (!db.data.dailySummary) db.data.dailySummary = {};
    aggregateEntryToDailySummary(db.data.dailySummary, entry);

    if (db.data.history.length > MAX_HISTORY) {
      db.data.history.splice(0, db.data.history.length - MAX_HISTORY);
    }

    await db.write();
    statsEmitter.emit("update");
  } catch (error) {
    console.error("Failed to save usage stats:", error);
  }
}

/**
 * Get usage history
 * @param {object} filter - Filter criteria
 */
export async function getUsageHistory(filter = {}) {
  const db = await getUsageDb();
  let history = db.data.history || [];

  // Apply filters
  if (filter.provider) {
    history = history.filter(h => h.provider === filter.provider);
  }

  if (filter.model) {
    history = history.filter(h => h.model === filter.model);
  }

  if (filter.startDate) {
    const start = new Date(filter.startDate).getTime();
    history = history.filter(h => new Date(h.timestamp).getTime() >= start);
  }

  if (filter.endDate) {
    const end = new Date(filter.endDate).getTime();
    history = history.filter(h => new Date(h.timestamp).getTime() <= end);
  }

  return history;
}

/**
 * Format date as dd-mm-yyyy h:m:s
 */
function formatLogDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${d}-${m}-${y} ${h}:${min}:${s}`;
}

/**
 * Append to log.txt
 * Format: datetime(dd-mm-yyyy h:m:s) | model | provider | account | tokens sent | tokens received | status
 */
export async function appendRequestLog({ model, provider, connectionId, tokens, status }) {
  if (isCloud) return; // Skip logging in Workers

  try {
    const timestamp = formatLogDate();
    const p = provider?.toUpperCase() || "-";
    const m = model || "-";

    // Resolve account name
    let account = connectionId ? connectionId.slice(0, 8) : "-";
    try {
      const { getProviderConnections } = await import("@/lib/localDb.js");
      const connections = await getProviderConnections();
      const conn = connections.find(c => c.id === connectionId);
      if (conn) {
        account = conn.name || conn.email || account;
      }
    } catch {}

    const sent = tokens?.prompt_tokens !== undefined ? tokens.prompt_tokens : "-";
    const received = tokens?.completion_tokens !== undefined ? tokens.completion_tokens : "-";

    const line = `${timestamp} | ${m} | ${p} | ${account} | ${sent} | ${received} | ${status}\n`;

    fs.appendFileSync(LOG_FILE, line);

    // Trim to keep only last 200 lines
    const content = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n");
    if (lines.length > 200) {
      fs.writeFileSync(LOG_FILE, lines.slice(-200).join("\n") + "\n");
    }
  } catch (error) {
    console.error("Failed to append to log.txt:", error.message);
  }
}

/**
 * Get last N lines of log.txt
 */
export async function getRecentLogs(limit = 200) {
  if (isCloud) return []; // Skip in Workers
  
  // Runtime check: ensure fs module is available
  if (!fs || typeof fs.existsSync !== "function") {
    console.error("[usageDb] fs module not available in this environment");
    return [];
  }
  
  if (!LOG_FILE) {
    console.error("[usageDb] LOG_FILE path not defined");
    return [];
  }
  
  if (!fs.existsSync(LOG_FILE)) {
    console.log(`[usageDb] Log file does not exist: ${LOG_FILE}`);
    return [];
  }
  
  try {
    const content = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = content.trim().split("\n");
    return lines.slice(-limit).reverse();
  } catch (error) {
    console.error("[usageDb] Failed to read log.txt:", error.message);
    console.error("[usageDb] LOG_FILE path:", LOG_FILE);
    return [];
  }
}

/**
 * Calculate cost for a usage entry
 * @param {string} provider - Provider ID
 * @param {string} model - Model ID
 * @param {object} tokens - Token counts
 * @returns {number} Cost in dollars
 */
async function calculateCost(provider, model, tokens) {
  if (!tokens || !provider || !model) return 0;

  try {
    const { getPricingForModel } = await import("@/lib/localDb.js");
    const pricing = await getPricingForModel(provider, model);

    if (!pricing) return 0;

    let cost = 0;

    const hasOpenAiShape = tokens.prompt_tokens !== undefined || tokens.prompt_tokens_details !== undefined;
    const inputTokens = tokens.prompt_tokens ?? tokens.input_tokens ?? 0;
    const cachedTokens = tokens.cached_tokens
      ?? tokens.prompt_tokens_details?.cached_tokens
      ?? tokens.cache_read_input_tokens
      ?? 0;
    const nonCachedInput = hasOpenAiShape ? Math.max(0, inputTokens - cachedTokens) : inputTokens;

    cost += (nonCachedInput * (pricing.input / 1000000));

    // Cached tokens
    if (cachedTokens > 0) {
      const cachedRate = pricing.cached || pricing.input; // Fallback to input rate
      cost += (cachedTokens * (cachedRate / 1000000));
    }

    // Output tokens
    const outputTokens = tokens.completion_tokens || tokens.output_tokens || 0;
    cost += (outputTokens * (pricing.output / 1000000));

    // Reasoning tokens
    const reasoningTokens = tokens.reasoning_tokens
      ?? tokens.completion_tokens_details?.reasoning_tokens
      ?? tokens.output_tokens_details?.reasoning_tokens
      ?? 0;
    if (reasoningTokens > 0) {
      const reasoningRate = pricing.reasoning || pricing.output; // Fallback to output rate
      cost += (reasoningTokens * (reasoningRate / 1000000));
    }

    // Cache creation tokens
    const cacheCreationTokens = tokens.cache_creation_input_tokens || 0;
    if (cacheCreationTokens > 0) {
      const cacheCreationRate = pricing.cache_creation || pricing.input; // Fallback to input rate
      cost += (cacheCreationTokens * (cacheCreationRate / 1000000));
    }

    return cost;
  } catch (error) {
    console.error("Error calculating cost:", error);
    return 0;
  }
}

const PERIOD_MS = { "24h": 86400000, "7d": 604800000, "30d": 2592000000, "60d": 5184000000 };

function countActiveMinutes(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return 0;
  const minuteBuckets = new Set();
  for (const entry of entries) {
    const ts = new Date(entry?.timestamp).getTime();
    if (!Number.isFinite(ts)) continue;
    minuteBuckets.add(Math.floor(ts / 60000));
  }
  return minuteBuckets.size;
}

/**
 * Get aggregated usage stats
 * @param {"24h"|"7d"|"30d"|"60d"|"all"} period - Time period to filter
 */
export async function getUsageStats(period = "all") {
  const db = await getUsageDb();
  if (typeof db.read === "function") {
    await db.read();
  }
  const history = db.data.history || [];
  const dailySummary = db.data.dailySummary || {};

  const { getProviderConnections, getApiKeys, getProviderNodes } = await import("@/lib/localDb.js");

  let allConnections = [];
  try { allConnections = await getProviderConnections(); } catch {}
  const connectionMap = {};
  for (const conn of allConnections) {
    connectionMap[conn.id] = conn.name || conn.email || conn.id;
  }

  const providerNodeNameMap = {};
  try {
    const nodes = await getProviderNodes();
    for (const node of nodes) {
      if (node.id && node.name) providerNodeNameMap[node.id] = node.name;
    }
  } catch {}

  let allApiKeys = [];
  try { allApiKeys = await getApiKeys(); } catch {}
  const apiKeyMap = {};
  for (const key of allApiKeys) {
    apiKeyMap[key.key] = { name: key.name, id: key.id, createdAt: key.createdAt };
  }

  // Recent requests (always from live history)
  const recentRequestsRaw = await Promise.all(
    [...history]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(async (e) => {
        const t = e.tokens || {};
        const existingCost = Number(e.cost || 0);
        const computedCost = existingCost > 0
          ? existingCost
          : await calculateCost(e.provider, e.model, t);
        return {
          timestamp: e.timestamp,
          model: e.model,
          provider: e.provider || "",
          promptTokens: t.prompt_tokens || t.input_tokens || 0,
          completionTokens: t.completion_tokens || t.output_tokens || 0,
          cost: computedCost,
          status: e.status || "ok",
        };
      })
  );

  const recentRequests = recentRequestsRaw
    .filter((e) => e.promptTokens > 0 || e.completionTokens > 0)
    .slice(0, 20);

  const lifetimeTotalRequests = typeof db.data.totalRequestsLifetime === "number"
    ? db.data.totalRequestsLifetime
    : history.length;

  const stats = {
    totalRequests: lifetimeTotalRequests,
    totalPromptTokens: 0, totalCompletionTokens: 0, totalCost: 0,
    rpm: 0,
    byProvider: {}, byModel: {}, byAccount: {}, byApiKey: {}, byEndpoint: {},
    last10Minutes: [],
    pending: pendingRequests,
    activeRequests: [],
    recentRequests,
    errorProvider: (Date.now() - lastErrorProvider.ts < 10000) ? lastErrorProvider.provider : "",
  };

  // Active requests from pending
  for (const [connectionId, models] of Object.entries(pendingRequests.byAccount)) {
    for (const [modelKey, count] of Object.entries(models)) {
      if (count > 0) {
        const accountName = connectionMap[connectionId] || `Account ${connectionId.slice(0, 8)}...`;
        const match = modelKey.match(/^(.*) \((.*)\)$/);
        stats.activeRequests.push({
          model: match ? match[1] : modelKey,
          provider: match ? match[2] : "unknown",
          account: accountName, count,
        });
      }
    }
  }

  // last10Minutes — always from live history
  const now = new Date();
  const currentMinuteStart = new Date(Math.floor(now.getTime() / 60000) * 60000);
  const tenMinutesAgo = new Date(currentMinuteStart.getTime() - 9 * 60 * 1000);
  const bucketMap = {};
  for (let i = 0; i < 10; i++) {
    const bucketKey = currentMinuteStart.getTime() - (9 - i) * 60 * 1000;
    bucketMap[bucketKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
    stats.last10Minutes.push(bucketMap[bucketKey]);
  }
  for (const entry of history) {
    const entryTime = new Date(entry.timestamp);
    if (entryTime >= tenMinutesAgo && entryTime <= now) {
      const entryMinuteStart = Math.floor(entryTime.getTime() / 60000) * 60000;
      if (bucketMap[entryMinuteStart]) {
        const pt = entry.tokens?.prompt_tokens || 0;
        const ct = entry.tokens?.completion_tokens || 0;
        bucketMap[entryMinuteStart].requests++;
        bucketMap[entryMinuteStart].promptTokens += pt;
        bucketMap[entryMinuteStart].completionTokens += ct;
        bucketMap[entryMinuteStart].cost += entry.cost || 0;
      }
    }
  }

  // Determine if we use dailySummary (7d/30d/60d/all) or live history (24h)
  const useDailySummary = period !== "24h";
  let periodTotalRequests = 0;

  if (useDailySummary) {
    // Collect relevant date keys
    const periodDays = { "7d": 7, "30d": 30, "60d": 60 };
    const maxDays = periodDays[period] || null; // null = all
    const today = new Date();
    const dateKeys = Object.keys(dailySummary).filter((dateKey) => {
      if (!maxDays) return true;
      const parts = dateKey.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
      return diffDays < maxDays;
    });

    for (const dateKey of dateKeys) {
      const day = dailySummary[dateKey];
      periodTotalRequests += day.requests || 0;
      stats.totalPromptTokens += day.promptTokens || 0;
      stats.totalCompletionTokens += day.completionTokens || 0;
      stats.totalCost += day.cost || 0;

      // Merge byProvider
      for (const [prov, pData] of Object.entries(day.byProvider || {})) {
        if (!stats.byProvider[prov]) stats.byProvider[prov] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
        stats.byProvider[prov].requests += pData.requests || 0;
        stats.byProvider[prov].promptTokens += pData.promptTokens || 0;
        stats.byProvider[prov].completionTokens += pData.completionTokens || 0;
        stats.byProvider[prov].cost += pData.cost || 0;
      }

      // Merge byModel (dailySummary key: "model|provider" → stats key: "model (provider)")
      for (const [mk, mData] of Object.entries(day.byModel || {})) {
        const rawModel = mData.rawModel || mk.split("|")[0];
        const provider = mData.provider || mk.split("|")[1] || "";
        const statsKey = provider ? `${rawModel} (${provider})` : rawModel;
        const providerDisplayName = providerNodeNameMap[provider] || provider;
        if (!stats.byModel[statsKey]) {
          stats.byModel[statsKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel, provider: providerDisplayName, lastUsed: dateKey };
        }
        stats.byModel[statsKey].requests += mData.requests || 0;
        stats.byModel[statsKey].promptTokens += mData.promptTokens || 0;
        stats.byModel[statsKey].completionTokens += mData.completionTokens || 0;
        stats.byModel[statsKey].cost += mData.cost || 0;
        if (dateKey > (stats.byModel[statsKey].lastUsed || "")) stats.byModel[statsKey].lastUsed = dateKey;
      }

      // Merge byAccount
      for (const [connId, aData] of Object.entries(day.byAccount || {})) {
        const accountName = connectionMap[connId] || `Account ${connId.slice(0, 8)}...`;
        const rawModel = aData.rawModel || "";
        const provider = aData.provider || "";
        const providerDisplayName = providerNodeNameMap[provider] || provider;
        const accountKey = `${rawModel} (${provider} - ${accountName})`;
        if (!stats.byAccount[accountKey]) {
          stats.byAccount[accountKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel, provider: providerDisplayName, connectionId: connId, accountName, lastUsed: dateKey };
        }
        stats.byAccount[accountKey].requests += aData.requests || 0;
        stats.byAccount[accountKey].promptTokens += aData.promptTokens || 0;
        stats.byAccount[accountKey].completionTokens += aData.completionTokens || 0;
        stats.byAccount[accountKey].cost += aData.cost || 0;
        if (dateKey > (stats.byAccount[accountKey].lastUsed || "")) stats.byAccount[accountKey].lastUsed = dateKey;
      }

      // Merge byApiKey
      for (const [akKey, akData] of Object.entries(day.byApiKey || {})) {
        const rawModel = akData.rawModel || "";
        const provider = akData.provider || "";
        const providerDisplayName = providerNodeNameMap[provider] || provider;
        const apiKeyVal = akData.apiKey;
        const keyInfo = apiKeyVal ? apiKeyMap[apiKeyVal] : null;
        const keyName = keyInfo?.name || (apiKeyVal ? apiKeyVal.slice(0, 8) + "..." : "Local (No API Key)");
        const apiKeyKey = apiKeyVal || "local-no-key";
        if (!stats.byApiKey[akKey]) {
          stats.byApiKey[akKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel, provider: providerDisplayName, apiKey: apiKeyVal, keyName, apiKeyKey, lastUsed: dateKey };
        }
        stats.byApiKey[akKey].requests += akData.requests || 0;
        stats.byApiKey[akKey].promptTokens += akData.promptTokens || 0;
        stats.byApiKey[akKey].completionTokens += akData.completionTokens || 0;
        stats.byApiKey[akKey].cost += akData.cost || 0;
        if (dateKey > (stats.byApiKey[akKey].lastUsed || "")) stats.byApiKey[akKey].lastUsed = dateKey;
      }

      // Merge byEndpoint
      for (const [epKey, epData] of Object.entries(day.byEndpoint || {})) {
        const endpoint = epData.endpoint || epKey.split("|")[0] || "Unknown";
        const rawModel = epData.rawModel || "";
        const provider = epData.provider || "";
        const providerDisplayName = providerNodeNameMap[provider] || provider;
        if (!stats.byEndpoint[epKey]) {
          stats.byEndpoint[epKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, endpoint, rawModel, provider: providerDisplayName, lastUsed: dateKey };
        }
        stats.byEndpoint[epKey].requests += epData.requests || 0;
        stats.byEndpoint[epKey].promptTokens += epData.promptTokens || 0;
        stats.byEndpoint[epKey].completionTokens += epData.completionTokens || 0;
        stats.byEndpoint[epKey].cost += epData.cost || 0;
        if (dateKey > (stats.byEndpoint[epKey].lastUsed || "")) stats.byEndpoint[epKey].lastUsed = dateKey;
      }
    }

    const fallbackCutoff = period === "all"
      ? 0
      : (Date.now() - (PERIOD_MS[period] || 0));

    if (periodTotalRequests === 0 && history.length > 0) {
      const fallbackEntries = history.filter((entry) => {
        if (!fallbackCutoff) return true;
        const ts = new Date(entry.timestamp).getTime();
        return Number.isFinite(ts) && ts >= fallbackCutoff;
      });

      periodTotalRequests = fallbackEntries.length;

      for (const entry of fallbackEntries) {
        const promptTokens = entry.tokens?.prompt_tokens || entry.tokens?.input_tokens || 0;
        const completionTokens = entry.tokens?.completion_tokens || entry.tokens?.output_tokens || 0;
        const entryCost = Number(entry.cost || 0);
        const providerDisplayName = providerNodeNameMap[entry.provider] || entry.provider;

        stats.totalPromptTokens += promptTokens;
        stats.totalCompletionTokens += completionTokens;
        stats.totalCost += entryCost;

        if (!stats.byProvider[entry.provider]) stats.byProvider[entry.provider] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
        stats.byProvider[entry.provider].requests++;
        stats.byProvider[entry.provider].promptTokens += promptTokens;
        stats.byProvider[entry.provider].completionTokens += completionTokens;
        stats.byProvider[entry.provider].cost += entryCost;

        const modelKey = entry.provider ? `${entry.model} (${entry.provider})` : entry.model;
        if (!stats.byModel[modelKey]) {
          stats.byModel[modelKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel: entry.model, provider: providerDisplayName, lastUsed: entry.timestamp };
        }
        stats.byModel[modelKey].requests++;
        stats.byModel[modelKey].promptTokens += promptTokens;
        stats.byModel[modelKey].completionTokens += completionTokens;
        stats.byModel[modelKey].cost += entryCost;
        if (new Date(entry.timestamp) > new Date(stats.byModel[modelKey].lastUsed)) stats.byModel[modelKey].lastUsed = entry.timestamp;

        if (entry.connectionId) {
          const accountName = connectionMap[entry.connectionId] || `Account ${entry.connectionId.slice(0, 8)}...`;
          const accountKey = `${entry.model} (${entry.provider} - ${accountName})`;
          if (!stats.byAccount[accountKey]) {
            stats.byAccount[accountKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel: entry.model, provider: providerDisplayName, connectionId: entry.connectionId, accountName, lastUsed: entry.timestamp };
          }
          stats.byAccount[accountKey].requests++;
          stats.byAccount[accountKey].promptTokens += promptTokens;
          stats.byAccount[accountKey].completionTokens += completionTokens;
          stats.byAccount[accountKey].cost += entryCost;
          if (new Date(entry.timestamp) > new Date(stats.byAccount[accountKey].lastUsed)) stats.byAccount[accountKey].lastUsed = entry.timestamp;
        }

        if (entry.apiKey && typeof entry.apiKey === "string") {
          const keyInfo = apiKeyMap[entry.apiKey];
          const keyName = keyInfo?.name || entry.apiKey.slice(0, 8) + "...";
          const apiKeyModelKey = `${entry.apiKey}|${entry.model}|${entry.provider || "unknown"}`;
          if (!stats.byApiKey[apiKeyModelKey]) {
            stats.byApiKey[apiKeyModelKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel: entry.model, provider: providerDisplayName, apiKey: entry.apiKey, keyName, apiKeyKey: entry.apiKey, lastUsed: entry.timestamp };
          }
          const ake = stats.byApiKey[apiKeyModelKey];
          ake.requests++; ake.promptTokens += promptTokens; ake.completionTokens += completionTokens; ake.cost += entryCost;
          if (new Date(entry.timestamp) > new Date(ake.lastUsed)) ake.lastUsed = entry.timestamp;
        } else {
          if (!stats.byApiKey["local-no-key"]) {
            stats.byApiKey["local-no-key"] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel: entry.model, provider: providerDisplayName, apiKey: null, keyName: "Local (No API Key)", apiKeyKey: "local-no-key", lastUsed: entry.timestamp };
          }
          const ake = stats.byApiKey["local-no-key"];
          ake.requests++; ake.promptTokens += promptTokens; ake.completionTokens += completionTokens; ake.cost += entryCost;
          if (new Date(entry.timestamp) > new Date(ake.lastUsed)) ake.lastUsed = entry.timestamp;
        }

        const endpoint = entry.endpoint || "Unknown";
        const endpointModelKey = `${endpoint}|${entry.model}|${entry.provider || "unknown"}`;
        if (!stats.byEndpoint[endpointModelKey]) {
          stats.byEndpoint[endpointModelKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, endpoint, rawModel: entry.model, provider: providerDisplayName, lastUsed: entry.timestamp };
        }
        const epe = stats.byEndpoint[endpointModelKey];
        epe.requests++; epe.promptTokens += promptTokens; epe.completionTokens += completionTokens; epe.cost += entryCost;
        if (new Date(entry.timestamp) > new Date(epe.lastUsed)) epe.lastUsed = entry.timestamp;
      }
    }

    // Overlay lastUsed with precise ISO timestamps from live history (dailySummary only has YYYY-MM-DD)
    const overlayCutoff = maxDays ? Date.now() - maxDays * 86400000 : 0;
    for (const entry of history) {
      const ts = entry.timestamp;
      if (!ts || new Date(ts).getTime() < overlayCutoff) continue;

      const modelKey = entry.provider ? `${entry.model} (${entry.provider})` : entry.model;
      if (stats.byModel[modelKey] && new Date(ts) > new Date(stats.byModel[modelKey].lastUsed)) {
        stats.byModel[modelKey].lastUsed = ts;
      }

      if (entry.connectionId) {
        const accountName = connectionMap[entry.connectionId] || `Account ${entry.connectionId.slice(0, 8)}...`;
        const accountKey = `${entry.model} (${entry.provider} - ${accountName})`;
        if (stats.byAccount[accountKey] && new Date(ts) > new Date(stats.byAccount[accountKey].lastUsed)) {
          stats.byAccount[accountKey].lastUsed = ts;
        }
      }

      const apiKeyKey = (entry.apiKey && typeof entry.apiKey === "string")
        ? `${entry.apiKey}|${entry.model}|${entry.provider || "unknown"}`
        : "local-no-key";
      if (stats.byApiKey[apiKeyKey] && new Date(ts) > new Date(stats.byApiKey[apiKeyKey].lastUsed)) {
        stats.byApiKey[apiKeyKey].lastUsed = ts;
      }

      const endpoint = entry.endpoint || "Unknown";
      const endpointKey = `${endpoint}|${entry.model}|${entry.provider || "unknown"}`;
      if (stats.byEndpoint[endpointKey] && new Date(ts) > new Date(stats.byEndpoint[endpointKey].lastUsed)) {
        stats.byEndpoint[endpointKey].lastUsed = ts;
      }
    }
  } else {
    // 24h: use live history (original logic)
    const cutoff = Date.now() - PERIOD_MS["24h"];
    const filtered = history.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
    periodTotalRequests = filtered.length;

    for (const entry of filtered) {
      const promptTokens = entry.tokens?.prompt_tokens || 0;
      const completionTokens = entry.tokens?.completion_tokens || 0;
      const entryCost = entry.cost || 0;
      const providerDisplayName = providerNodeNameMap[entry.provider] || entry.provider;

      stats.totalPromptTokens += promptTokens;
      stats.totalCompletionTokens += completionTokens;
      stats.totalCost += entryCost;

      // byProvider
      if (!stats.byProvider[entry.provider]) stats.byProvider[entry.provider] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0 };
      stats.byProvider[entry.provider].requests++;
      stats.byProvider[entry.provider].promptTokens += promptTokens;
      stats.byProvider[entry.provider].completionTokens += completionTokens;
      stats.byProvider[entry.provider].cost += entryCost;

      // byModel
      const modelKey = entry.provider ? `${entry.model} (${entry.provider})` : entry.model;
      if (!stats.byModel[modelKey]) {
        stats.byModel[modelKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel: entry.model, provider: providerDisplayName, lastUsed: entry.timestamp };
      }
      stats.byModel[modelKey].requests++;
      stats.byModel[modelKey].promptTokens += promptTokens;
      stats.byModel[modelKey].completionTokens += completionTokens;
      stats.byModel[modelKey].cost += entryCost;
      if (new Date(entry.timestamp) > new Date(stats.byModel[modelKey].lastUsed)) stats.byModel[modelKey].lastUsed = entry.timestamp;

      // byAccount
      if (entry.connectionId) {
        const accountName = connectionMap[entry.connectionId] || `Account ${entry.connectionId.slice(0, 8)}...`;
        const accountKey = `${entry.model} (${entry.provider} - ${accountName})`;
        if (!stats.byAccount[accountKey]) {
          stats.byAccount[accountKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel: entry.model, provider: providerDisplayName, connectionId: entry.connectionId, accountName, lastUsed: entry.timestamp };
        }
        stats.byAccount[accountKey].requests++;
        stats.byAccount[accountKey].promptTokens += promptTokens;
        stats.byAccount[accountKey].completionTokens += completionTokens;
        stats.byAccount[accountKey].cost += entryCost;
        if (new Date(entry.timestamp) > new Date(stats.byAccount[accountKey].lastUsed)) stats.byAccount[accountKey].lastUsed = entry.timestamp;
      }

      // byApiKey
      if (entry.apiKey && typeof entry.apiKey === "string") {
        const keyInfo = apiKeyMap[entry.apiKey];
        const keyName = keyInfo?.name || entry.apiKey.slice(0, 8) + "...";
        const apiKeyModelKey = `${entry.apiKey}|${entry.model}|${entry.provider || "unknown"}`;
        if (!stats.byApiKey[apiKeyModelKey]) {
          stats.byApiKey[apiKeyModelKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel: entry.model, provider: providerDisplayName, apiKey: entry.apiKey, keyName, apiKeyKey: entry.apiKey, lastUsed: entry.timestamp };
        }
        const ake = stats.byApiKey[apiKeyModelKey];
        ake.requests++; ake.promptTokens += promptTokens; ake.completionTokens += completionTokens; ake.cost += entryCost;
        if (new Date(entry.timestamp) > new Date(ake.lastUsed)) ake.lastUsed = entry.timestamp;
      } else {
        if (!stats.byApiKey["local-no-key"]) {
          stats.byApiKey["local-no-key"] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, rawModel: entry.model, provider: providerDisplayName, apiKey: null, keyName: "Local (No API Key)", apiKeyKey: "local-no-key", lastUsed: entry.timestamp };
        }
        const ake = stats.byApiKey["local-no-key"];
        ake.requests++; ake.promptTokens += promptTokens; ake.completionTokens += completionTokens; ake.cost += entryCost;
        if (new Date(entry.timestamp) > new Date(ake.lastUsed)) ake.lastUsed = entry.timestamp;
      }

      // byEndpoint
      const endpoint = entry.endpoint || "Unknown";
      const endpointModelKey = `${endpoint}|${entry.model}|${entry.provider || "unknown"}`;
      if (!stats.byEndpoint[endpointModelKey]) {
        stats.byEndpoint[endpointModelKey] = { requests: 0, promptTokens: 0, completionTokens: 0, cost: 0, endpoint, rawModel: entry.model, provider: providerDisplayName, lastUsed: entry.timestamp };
      }
      const epe = stats.byEndpoint[endpointModelKey];
      epe.requests++; epe.promptTokens += promptTokens; epe.completionTokens += completionTokens; epe.cost += entryCost;
      if (new Date(entry.timestamp) > new Date(epe.lastUsed)) epe.lastUsed = entry.timestamp;
    }
  }

  stats.totalRequests = period === "all" ? lifetimeTotalRequests : periodTotalRequests;

  let rpmEntries = history;
  if (period !== "all" && PERIOD_MS[period]) {
    const cutoff = Date.now() - PERIOD_MS[period];
    rpmEntries = history.filter((entry) => new Date(entry.timestamp).getTime() >= cutoff);
  }
  const activeMinutes = countActiveMinutes(rpmEntries);
  stats.rpm = activeMinutes > 0 ? stats.totalRequests / activeMinutes : 0;

  return stats;
}

/**
 * Get time-series chart data for a given period
 * @param {"24h"|"7d"|"30d"|"60d"|"all"} period
 * @returns {Promise<Array<{label: string, tokens: number, cost: number}>>}
 */
export async function getChartData(period = "7d") {
  const db = await getUsageDb();
  if (typeof db.read === "function") {
    await db.read();
  }
  const history = db.data.history || [];
  const dailySummary = db.data.dailySummary || {};
  const now = Date.now();

  if (period === "all") {
    return Object.keys(dailySummary)
      .sort()
      .map((dateKey) => {
        const dayData = dailySummary[dateKey] || {};
        const [year, month, day] = dateKey.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return {
          label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          tokens: (dayData.promptTokens || 0) + (dayData.completionTokens || 0),
          cost: dayData.cost || 0,
        };
      });
  }

  // 24h: bucket by hour from live history
  if (period === "24h") {
    const bucketCount = 24;
    const bucketMs = 3600000;
    const labelFn = (ts) => new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const startTime = now - bucketCount * bucketMs;
    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const ts = startTime + i * bucketMs;
      return { label: labelFn(ts), tokens: 0, cost: 0 };
    });

    for (const entry of history) {
      const entryTime = new Date(entry.timestamp).getTime();
      if (entryTime < startTime || entryTime > now) continue;
      const idx = Math.min(Math.floor((entryTime - startTime) / bucketMs), bucketCount - 1);
      buckets[idx].tokens += (entry.tokens?.prompt_tokens || 0) + (entry.tokens?.completion_tokens || 0);
      buckets[idx].cost += entry.cost || 0;
    }
    return buckets;
  }

  // 7d/30d/60d: bucket by day from dailySummary (local dates)
  const bucketCount = period === "7d" ? 7 : period === "30d" ? 30 : 60;
  const today = new Date();
  const labelFn = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (bucketCount - 1 - i));
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayData = dailySummary[dateKey];
    return {
      label: labelFn(d),
      tokens: dayData ? (dayData.promptTokens || 0) + (dayData.completionTokens || 0) : 0,
      cost: dayData ? (dayData.cost || 0) : 0,
    };
  });

  return buckets;
}

export async function getUsageDebugInfo(period = "7d") {
  const db = await getUsageDb();
  if (typeof db.read === "function") {
    await db.read();
  }

  const history = Array.isArray(db.data.history) ? db.data.history : [];
  const dailySummary = db.data.dailySummary && typeof db.data.dailySummary === "object" ? db.data.dailySummary : {};
  const summaryDays = Object.keys(dailySummary).length;
  const useDailySummary = period !== "24h";
  const fallbackCutoff = period === "all" ? 0 : (Date.now() - (PERIOD_MS[period] || 0));
  const relevantHistoryCount = history.filter((entry) => {
    if (!fallbackCutoff) return true;
    const ts = new Date(entry?.timestamp).getTime();
    return Number.isFinite(ts) && ts >= fallbackCutoff;
  }).length;

  let relevantSummaryDays = summaryDays;
  if (useDailySummary && period !== "all") {
    const periodDays = { "7d": 7, "30d": 30, "60d": 60 };
    const maxDays = periodDays[period] || null;
    const today = new Date();
    relevantSummaryDays = Object.keys(dailySummary).filter((dateKey) => {
      if (!maxDays) return true;
      const parts = dateKey.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const diffDays = Math.floor((today.getTime() - d.getTime()) / 86400000);
      return diffDays < maxDays;
    }).length;
  }

  return {
    period,
    useDailySummary,
    source: useDailySummary ? (relevantSummaryDays > 0 ? "dailySummary" : (relevantHistoryCount > 0 ? "history-fallback" : "empty")) : "history",
    hasHistory: history.length > 0,
    historyCount: history.length,
    relevantHistoryCount,
    dailySummaryDays: summaryDays,
    relevantSummaryDays,
    hasDataInPeriod: relevantSummaryDays > 0 || relevantHistoryCount > 0,
    totalRequestsLifetime: typeof db.data.totalRequestsLifetime === "number" ? db.data.totalRequestsLifetime : history.length,
  };
}

// Re-export request details functions from new SQLite-based module
export { saveRequestDetail, getRequestDetails, getRequestDetailById } from "./requestDetailsDb.js";

/**
 * Export usage database
 */
export async function exportUsageDb() {
  const db = await getUsageDb();
  if (typeof db.read === "function") {
    await db.read();
  }
  const history = db.data.history || [];
  const dailySummary = db.data.dailySummary || {};
  const totalRequestsLifetime = db.data.totalRequestsLifetime || 0;

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    history,
    dailySummary,
    totalRequestsLifetime,
    metadata: {
      historyCount: history.length,
      dailySummaryDays: Object.keys(dailySummary).length,
      totalRequests: totalRequestsLifetime,
    },
  };
}

/**
 * Import usage database
 */
export async function importUsageDb(payload) {
  const db = await getUsageDb();
  if (typeof db.read === "function") await db.read();

  const current = ensureUsageDataShape(db.data);
  const incomingHistory = Array.isArray(payload?.history) ? payload.history : null;
  const incomingDailySummary =
    typeof payload?.dailySummary === "object" && payload.dailySummary !== null && !Array.isArray(payload.dailySummary)
      ? payload.dailySummary
      : null;
  const incomingTotalRequestsLifetime =
    typeof payload?.totalRequestsLifetime === "number"
      ? payload.totalRequestsLifetime
      : null;

  db.data = ensureUsageDataShape({
    history: incomingHistory && incomingHistory.length > 0 ? incomingHistory : current.history,
    dailySummary: incomingDailySummary || current.dailySummary,
    totalRequestsLifetime: Math.max(
      incomingTotalRequestsLifetime ?? 0,
      current.totalRequestsLifetime || 0,
      current.history?.length || 0,
      incomingHistory?.length || 0
    ),
  });

  const hasHistory = Array.isArray(db.data.history) && db.data.history.length > 0;
  const hasDailySummary = db.data.dailySummary && Object.keys(db.data.dailySummary).length > 0;
  if (hasHistory && !hasDailySummary) {
    migrateHistoryToDailySummary(db);
  }

  await db.write();
}
