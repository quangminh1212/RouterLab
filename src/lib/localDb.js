import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { v4 as uuidv4 } from "uuid";
import path from "node:path";
import fs from "node:fs";
import lockfile from "proper-lockfile";
import { DATA_DIR } from "@/lib/dataDir.js";
import { logger } from "@/lib/logger.js";

const DEFAULT_MITM_ROUTER_BASE = "http://localhost:1212";
const LEGACY_CLOUD_HOST_REGEX = /(^|\.)9router\.com$/i;
const REPLACEMENT_CLOUD_HOST = "xlabrouter.com";

function normalizeCloudUrl(url) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (LEGACY_CLOUD_HOST_REGEX.test(parsed.hostname)) {
      parsed.hostname = REPLACEMENT_CLOUD_HOST;
      return parsed.toString().replace(/\/$/, "");
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

const isCloud = typeof caches !== 'undefined' || typeof caches === 'object';
const DB_FILE = isCloud ? null : path.join(DATA_DIR, "db.json");

if (!isCloud && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_SETTINGS = {
  cloudEnabled: false,
  tunnelEnabled: false,
  tunnelUrl: "",
  tunnelProvider: "cloudflare",
  tailscaleEnabled: false,
  tailscaleUrl: "",
  stickyRoundRobinLimit: 3,
  providerStrategies: {},
  comboStrategy: "fallback",
  comboStrategies: {},
  requireLogin: true,
  tunnelDashboardAccess: true,
  observabilityEnabled: true,
  observabilityMaxRecords: 1000,
  observabilityBatchSize: 20,
  observabilityFlushIntervalMs: 5000,
  observabilityMaxJsonSize: 1024,
  outboundProxyEnabled: false,
  outboundProxyUrl: "",
  outboundNoProxy: "",
  aiIntegrations: {
    enabled: false,
    autoConnect: false,
    mcpServers: [
      {
        id: "openai-docs",
        name: "OpenAI Developer Docs",
        source: "documentation",
        command: "",
        args: [],
        env: {},
        headers: {},
        endpoint: "https://developers.openai.com/mcp",
        apiKey: "",
        enabled: false,
      },
      {
        id: "context7",
        name: "Context7 Docs",
        source: "documentation",
        command: "npx",
        args: ["-y", "@upstash/context7-mcp@latest"],
        env: {},
        headers: {},
        endpoint: "",
        apiKey: "",
        enabled: false,
      },
      {
        id: "tavily",
        name: "Tavily Search",
        source: "web-search",
        command: "npx",
        args: ["-y", "tavily-mcp@latest"],
        env: { "TAVILY_API_KEY": "" },
        headers: {},
        endpoint: "",
        apiKey: "",
        enabled: false,
      },
      {
        id: "playwright",
        name: "Playwright Browser",
        source: "browser",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest"],
        env: {},
        headers: {},
        endpoint: "",
        apiKey: "",
        enabled: false,
      },
    ],
    plugins: [
      {
        id: "claude-official-store",
        name: "Claude Official Store",
        source: "builtin",
        marketplace: "claude-plugins-official",
        endpoint: "",
        repo: "anthropics/claude-plugins-official",
        ref: "main",
        path: ".claude-plugin/marketplace.json",
        apiKey: "",
        enabled: true,
      },
      {
        id: "community-github-store",
        name: "Community GitHub Store",
        source: "github",
        marketplace: "community",
        endpoint: "",
        repo: "owner/plugin-marketplace",
        ref: "main",
        path: ".claude-plugin/marketplace.json",
        apiKey: "",
        enabled: false,
      },
      {
        id: "custom-team-store",
        name: "Custom Team Store",
        source: "url",
        marketplace: "team",
        endpoint: "https://plugins.example.com/marketplace.json",
        repo: "",
        ref: "",
        path: "",
        apiKey: "",
        enabled: false,
      },
    ],
  },
  mitmRouterBaseUrl: DEFAULT_MITM_ROUTER_BASE,
  rtkEnabled: false,
};

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function cloneDefaultData() {
  return {
    providerConnections: [],
    providerNodes: [],
    proxyPools: [],
    modelAliases: {},
    mitmAlias: {},
    combos: [],
    apiKeys: [],
    settings: cloneDefaultSettings(),
    pricing: {},
  };
}

if (!isCloud && DB_FILE && !fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(cloneDefaultData(), null, 2));
}

function ensureDbShape(data) {
  const defaults = cloneDefaultData();
  const next = data && typeof data === "object" ? data : {};
  let changed = false;

  for (const [key, defaultValue] of Object.entries(defaults)) {
    if (next[key] === undefined || next[key] === null) {
      next[key] = defaultValue;
      changed = true;
      continue;
    }

    if (key === "settings" && (typeof next.settings !== "object" || Array.isArray(next.settings))) {
      next.settings = cloneDefaultSettings();
      changed = true;
      continue;
    }

    if (key === "settings" && typeof next.settings === "object" && !Array.isArray(next.settings)) {
      for (const [settingKey, settingDefault] of Object.entries(defaultValue)) {
        if (next.settings[settingKey] === undefined) {
          // Backward-compat: if proxy URL was saved, default outboundProxyEnabled to true
          if (
            settingKey === "outboundProxyEnabled" &&
            typeof next.settings.outboundProxyUrl === "string" &&
            next.settings.outboundProxyUrl.trim()
          ) {
            next.settings.outboundProxyEnabled = true;
          } else {
            next.settings[settingKey] = settingDefault;
          }
          changed = true;
        }
      }

      const defaultAiIntegrations = defaultValue.aiIntegrations;
      const currentAiIntegrations = next.settings.aiIntegrations;
      if (!currentAiIntegrations || typeof currentAiIntegrations !== "object" || Array.isArray(currentAiIntegrations)) {
        next.settings.aiIntegrations = JSON.parse(JSON.stringify(defaultAiIntegrations));
        changed = true;
      } else {
        if (typeof currentAiIntegrations.enabled !== "boolean") {
          currentAiIntegrations.enabled = defaultAiIntegrations.enabled;
          changed = true;
        }
        if (typeof currentAiIntegrations.autoConnect !== "boolean") {
          currentAiIntegrations.autoConnect = defaultAiIntegrations.autoConnect;
          changed = true;
        }
        if (!Array.isArray(currentAiIntegrations.mcpServers)) {
          currentAiIntegrations.mcpServers = JSON.parse(JSON.stringify(defaultAiIntegrations.mcpServers));
          changed = true;
        } else {
          const defaultMcpById = new Map(defaultAiIntegrations.mcpServers.map((server) => [server.id, server]));
          const existingMcpIds = new Set();
          currentAiIntegrations.mcpServers = currentAiIntegrations.mcpServers.map((server) => {
            if (!server || typeof server !== "object" || Array.isArray(server)) return server;
            existingMcpIds.add(server.id);
            const defaultServer = defaultMcpById.get(server.id);
            if (!defaultServer) return server;
            const mergedServer = { ...defaultServer, ...server };
            if (!Array.isArray(mergedServer.args)) mergedServer.args = defaultServer.args || [];
            if (!mergedServer.env || typeof mergedServer.env !== "object" || Array.isArray(mergedServer.env)) {
              mergedServer.env = defaultServer.env || {};
            }
            if (!mergedServer.headers || typeof mergedServer.headers !== "object" || Array.isArray(mergedServer.headers)) {
              mergedServer.headers = defaultServer.headers || {};
            }
            if (JSON.stringify(mergedServer) !== JSON.stringify(server)) changed = true;
            return mergedServer;
          });

          for (const defaultServer of defaultAiIntegrations.mcpServers) {
            if (!existingMcpIds.has(defaultServer.id)) {
              currentAiIntegrations.mcpServers.push(JSON.parse(JSON.stringify(defaultServer)));
              changed = true;
            }
          }
        }
        if (!Array.isArray(currentAiIntegrations.plugins)) {
          currentAiIntegrations.plugins = JSON.parse(JSON.stringify(defaultAiIntegrations.plugins));
          changed = true;
        } else {
          const defaultPluginById = new Map(defaultAiIntegrations.plugins.map((plugin) => [plugin.id, plugin]));
          const existingPluginIds = new Set();
          currentAiIntegrations.plugins = currentAiIntegrations.plugins.map((plugin) => {
            if (!plugin || typeof plugin !== "object" || Array.isArray(plugin)) return plugin;
            existingPluginIds.add(plugin.id);
            const defaultPlugin = defaultPluginById.get(plugin.id);
            if (!defaultPlugin) {
              if (plugin.marketplace === undefined) plugin.marketplace = "";
              if (plugin.repo === undefined) plugin.repo = "";
              if (plugin.ref === undefined) plugin.ref = "";
              if (plugin.path === undefined) plugin.path = "";
              return plugin;
            }

            const mergedPlugin = { ...defaultPlugin, ...plugin };
            if (JSON.stringify(mergedPlugin) !== JSON.stringify(plugin)) changed = true;
            return mergedPlugin;
          });

          for (const defaultPlugin of defaultAiIntegrations.plugins) {
            if (!existingPluginIds.has(defaultPlugin.id)) {
              currentAiIntegrations.plugins.push(JSON.parse(JSON.stringify(defaultPlugin)));
              changed = true;
            }
          }
        }
      }

      const normalizedCloudUrl = normalizeCloudUrl(next.settings.cloudUrl);
      if ((next.settings.cloudUrl || "") !== normalizedCloudUrl) {
        next.settings.cloudUrl = normalizedCloudUrl;
        changed = true;
      }
    }

    // Migrate existing API keys to have isActive and limits
    if (key === "apiKeys" && Array.isArray(next.apiKeys)) {
      for (const apiKey of next.apiKeys) {
        if (apiKey.isActive === undefined || apiKey.isActive === null) {
          apiKey.isActive = true;
          changed = true;
        }

        if (apiKey.costLimit === undefined) {
          apiKey.costLimit = null;
          changed = true;
        } else if (apiKey.costLimit !== null) {
          const normalizedLimit = Number(apiKey.costLimit);
          if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
            apiKey.costLimit = null;
            changed = true;
          } else if (normalizedLimit !== apiKey.costLimit) {
            apiKey.costLimit = Number(normalizedLimit.toFixed(2));
            changed = true;
          }
        }

        if (apiKey.allowedModels === undefined) {
          apiKey.allowedModels = null;
          changed = true;
        } else if (apiKey.allowedModels !== null) {
          if (!Array.isArray(apiKey.allowedModels)) {
            apiKey.allowedModels = null;
            changed = true;
          } else {
            const sanitizedModels = apiKey.allowedModels
              .map((m) => (typeof m === "string" ? m.trim() : ""))
              .filter(Boolean);
            if (sanitizedModels.length !== apiKey.allowedModels.length) {
              apiKey.allowedModels = sanitizedModels.length > 0 ? sanitizedModels : null;
              changed = true;
            }
          }
        }

        if (apiKey.rpmLimit === undefined) {
          apiKey.rpmLimit = null;
          changed = true;
        } else if (apiKey.rpmLimit !== null) {
          const normalizedRpm = Number(apiKey.rpmLimit);
          if (!Number.isFinite(normalizedRpm) || normalizedRpm <= 0) {
            apiKey.rpmLimit = null;
            changed = true;
          } else {
            const normalizedInt = Math.floor(normalizedRpm);
            if (normalizedInt !== apiKey.rpmLimit) {
              apiKey.rpmLimit = normalizedInt;
              changed = true;
            }
          }
        }
      }
    }
  }

  return { data: next, changed };
}

let dbInstance = null;
let dbLastReadAt = 0;
let dbHydrated = false;
let settingsCache = null;
let settingsCacheAt = 0;
let settingsCachePromise = null;
let settingsRefreshPromise = null;
let dbRefreshPromise = null;

function getDbRefreshIntervalMs() {
  const raw = Number(process.env.DB_REFRESH_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw < 0) return 30000; // was 5000ms — refresh less frequently
  return raw;
}

function getDbBlockingRefreshIntervalMs() {
  const raw = Number(process.env.DB_BLOCKING_REFRESH_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw < 0) return 3000;
  return raw;
}

function getSettingsCacheTtlMs() {
  const raw = Number(process.env.SETTINGS_CACHE_TTL_MS);
  if (!Number.isFinite(raw) || raw < 0) return 300000; // was 60000ms (1min) — now 5min (settings rarely change)
  return raw;
}

function getDbSlowLockWarnMs() {
  const raw = Number(process.env.DB_SLOW_LOCK_WARN_MS);
  if (!Number.isFinite(raw) || raw < 0) return 80;
  return raw;
}

const LOCK_OPTIONS = {
  retries: { retries: 15, minTimeout: 50, maxTimeout: 1000 }, // was 3000ms — faster lock recovery
  stale: 10000,
};

const RPM_WINDOW_SECONDS = 60;

if (!global._apiKeyRpmState) {
  global._apiKeyRpmState = new Map();
}

const apiKeyRpmState = global._apiKeyRpmState;

function getOrCreateApiKeyRpmBuckets(apiKey) {
  let state = apiKeyRpmState.get(apiKey);
  if (!state) {
    state = {
      counts: new Array(RPM_WINDOW_SECONDS).fill(0),
      slots: new Array(RPM_WINDOW_SECONDS).fill(0),
      total: 0,
      lastSeenSec: 0,
    };
    apiKeyRpmState.set(apiKey, state);
  }
  return state;
}

function cleanupApiKeyRpmBucket(state, nowSec) {
  for (let i = 0; i < RPM_WINDOW_SECONDS; i++) {
    const slotSec = state.slots[i];
    if (!slotSec || nowSec - slotSec < RPM_WINDOW_SECONDS) continue;
    if (state.counts[i] > 0) {
      state.total -= state.counts[i];
      state.counts[i] = 0;
    }
    state.slots[i] = 0;
  }
  if (state.total < 0) state.total = 0;
}

function maybeCleanupApiKeyRpmMap(nowSec) {
  if (apiKeyRpmState.size <= 500) return;
  for (const [apiKey, state] of apiKeyRpmState.entries()) {
    if (state.total > 0) continue;
    if (nowSec - (state.lastSeenSec || 0) < 3600) continue;
    apiKeyRpmState.delete(apiKey);
  }
}

class LocalMutex {
  constructor() {
    this._queue = [];
    this._locked = false;
  }

  async acquire() {
    if (!this._locked) {
      this._locked = true;
      return () => this._release();
    }
    return new Promise((resolve) => {
      this._queue.push(() => resolve(() => this._release()));
    });
  }

  tryAcquire() {
    if (this._locked) return null;
    this._locked = true;
    return () => this._release();
  }

  _release() {
    const next = this._queue.shift();
    if (next) next();
    else this._locked = false;
  }
}

const localMutex = new LocalMutex();

async function withFileLock(db, operation) {
  if (isCloud) {
    await operation();
    return;
  }

  const startedAt = Date.now();
  const releaseLocal = await localMutex.acquire();
  const queueWaitMs = Date.now() - startedAt;
  let release = null;
  let fileLockWaitMs = 0;
  let operationMs = 0;
  try {
    logger.debug("DB", "Acquiring file lock");
    const fileLockStartedAt = Date.now();
    release = await lockfile.lock(DB_FILE, LOCK_OPTIONS);
    fileLockWaitMs = Date.now() - fileLockStartedAt;

    const operationStartedAt = Date.now();
    await operation();
    operationMs = Date.now() - operationStartedAt;
    logger.debug("DB", "File lock operation completed");
  } catch (error) {
    if (error.code === "ELOCKED") {
      logger.warn("DB", "File is locked, retrying...");
    }
    throw error;
  } finally {
    if (release) {
      try { await release(); } catch (_) { }
    }
    releaseLocal();

    const durationMs = Date.now() - startedAt;
    if (durationMs >= getDbSlowLockWarnMs()) {
      logger.warn("DB", "Slow DB lock operation", {
        durationMs,
        queueWaitMs,
        fileLockWaitMs,
        operationMs,
        refreshIntervalMs: getDbRefreshIntervalMs(),
      });
    }
  }
}

async function safeRead(db) {
  await withFileLock(db, () => db.read());
  dbLastReadAt = Date.now();
  dbHydrated = true;
}

async function refreshDbSnapshot(db, { force = false } = {}) {
  const now = Date.now();
  if (!force && dbHydrated && now - dbLastReadAt < getDbRefreshIntervalMs()) {
    return;
  }

  if (dbRefreshPromise) {
    await dbRefreshPromise;
    return;
  }

  dbRefreshPromise = (async () => {
    const refreshNow = Date.now();
    const shouldRefresh = force || refreshNow - dbLastReadAt >= getDbRefreshIntervalMs();
    if (!shouldRefresh) return;

    if (dbHydrated) {
      const refreshed = await tryRefreshReadNonBlocking(db);
      if (!refreshed) {
        dbLastReadAt = refreshNow;
        logger.debug("DB", "Skip refresh due to active DB lock, using in-memory snapshot");
      }
      return;
    }

    const shouldUseNonBlockingBootstrap = !force && (refreshNow - dbLastReadAt) >= getDbBlockingRefreshIntervalMs();
    if (shouldUseNonBlockingBootstrap) {
      const refreshed = await tryRefreshReadNonBlocking(db);
      if (refreshed) return;

      logger.warn("DB", "Bootstrap refresh skipped due to active DB lock, serving in-memory snapshot");
      return;
    }

    await safeRead(db);
  })();

  try {
    await dbRefreshPromise;
  } finally {
    dbRefreshPromise = null;
  }
}

async function tryRefreshReadNonBlocking(db) {
  if (isCloud) {
    await db.read();
    dbLastReadAt = Date.now();
    dbHydrated = true;
    return true;
  }

  const releaseLocal = localMutex.tryAcquire();
  if (!releaseLocal) return false;

  let release = null;
  try {
    release = await lockfile.lock(DB_FILE, { ...LOCK_OPTIONS, retries: 0 });
    await db.read();
    dbLastReadAt = Date.now();
    dbHydrated = true;
    return true;
  } catch (error) {
    if (error?.code === "ELOCKED") return false;
    throw error;
  } finally {
    if (release) {
      try { await release(); } catch (_) { }
    }
    releaseLocal();
  }
}

async function safeWrite(db) {
  await withFileLock(db, () => db.write());
  dbLastReadAt = Date.now();
  dbHydrated = true;
}

export async function getDb() {
  if (isCloud) {
    if (!dbInstance) {
      logger.info("DB", "Initializing cloud DB instance");
      const data = cloneDefaultData();
      dbInstance = new Low({ read: async () => { }, write: async () => { } }, data);
      dbInstance.data = data;
    }
    return dbInstance;
  }

  if (!dbInstance) {
    logger.info("DB", "Initializing local DB instance", { file: DB_FILE });
    dbInstance = new Low(new JSONFile(DB_FILE), cloneDefaultData());
  }

  try {
    await refreshDbSnapshot(dbInstance);
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.warn("DB", "Corrupt JSON detected, resetting to defaults");
      dbInstance.data = cloneDefaultData();
      await safeWrite(dbInstance);
    } else {
      throw error;
    }
  }

  if (!dbInstance.data) {
    logger.warn("DB", "DB data is null, initializing with defaults");
    dbInstance.data = cloneDefaultData();
    await safeWrite(dbInstance);
  } else {
    const { data, changed } = ensureDbShape(dbInstance.data);
    dbInstance.data = data;
    if (changed) {
      logger.info("DB", "DB schema updated, writing changes");
      await safeWrite(dbInstance);
    }
  }

  return dbInstance;
}

export async function getProviderConnections(filter = {}) {
  const db = await getDb();
  let connections = db.data.providerConnections || [];

  if (filter.provider) connections = connections.filter(c => c.provider === filter.provider);
  if (filter.isActive !== undefined) connections = connections.filter(c => c.isActive === filter.isActive);

  connections.sort((a, b) => (a.priority || 999) - (b.priority || 999));
  return connections;
}

export async function getProviderNodes(filter = {}) {
  const db = await getDb();
  let nodes = db.data.providerNodes || [];
  if (filter.type) nodes = nodes.filter((node) => node.type === filter.type);
  return nodes;
}

export async function getProviderNodeById(id) {
  const db = await getDb();
  return db.data.providerNodes.find((node) => node.id === id) || null;
}

export async function createProviderNode(data) {
  const db = await getDb();
  if (!db.data.providerNodes) db.data.providerNodes = [];

  const now = new Date().toISOString();
  const node = {
    id: data.id || uuidv4(),
    type: data.type,
    name: data.name,
    prefix: data.prefix,
    apiType: data.apiType,
    baseUrl: data.baseUrl,
    createdAt: now,
    updatedAt: now,
  };

  db.data.providerNodes.push(node);
  await safeWrite(db);
  return node;
}

export async function updateProviderNode(id, data) {
  const db = await getDb();
  if (!db.data.providerNodes) db.data.providerNodes = [];

  const index = db.data.providerNodes.findIndex((node) => node.id === id);
  if (index === -1) return null;

  db.data.providerNodes[index] = {
    ...db.data.providerNodes[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await safeWrite(db);
  return db.data.providerNodes[index];
}

export async function deleteProviderNode(id) {
  const db = await getDb();
  if (!db.data.providerNodes) db.data.providerNodes = [];

  const index = db.data.providerNodes.findIndex((node) => node.id === id);
  if (index === -1) return null;

  const [removed] = db.data.providerNodes.splice(index, 1);
  await safeWrite(db);
  return removed;
}

export async function getProxyPools(filter = {}) {
  const db = await getDb();
  let pools = db.data.proxyPools || [];

  if (filter.isActive !== undefined) pools = pools.filter((pool) => pool.isActive === filter.isActive);
  if (filter.testStatus) pools = pools.filter((pool) => pool.testStatus === filter.testStatus);

  return pools.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

export async function getProxyPoolById(id) {
  const db = await getDb();
  return (db.data.proxyPools || []).find((pool) => pool.id === id) || null;
}

export async function createProxyPool(data) {
  const db = await getDb();
  if (!db.data.proxyPools) db.data.proxyPools = [];

  const now = new Date().toISOString();
  const pool = {
    id: data.id || uuidv4(),
    name: data.name,
    proxyUrl: data.proxyUrl,
    noProxy: data.noProxy || "",
    type: data.type || "http",
    isActive: data.isActive !== undefined ? data.isActive : true,
    strictProxy: data.strictProxy === true,
    testStatus: data.testStatus || "unknown",
    lastTestedAt: data.lastTestedAt || null,
    lastError: data.lastError || null,
    createdAt: now,
    updatedAt: now,
  };

  db.data.proxyPools.push(pool);
  await safeWrite(db);
  return pool;
}

export async function updateProxyPool(id, data) {
  const db = await getDb();
  if (!db.data.proxyPools) db.data.proxyPools = [];

  const index = db.data.proxyPools.findIndex((pool) => pool.id === id);
  if (index === -1) return null;

  db.data.proxyPools[index] = {
    ...db.data.proxyPools[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await safeWrite(db);
  return db.data.proxyPools[index];
}

export async function deleteProxyPool(id) {
  const db = await getDb();
  if (!db.data.proxyPools) db.data.proxyPools = [];

  const index = db.data.proxyPools.findIndex((pool) => pool.id === id);
  if (index === -1) return null;

  const [removed] = db.data.proxyPools.splice(index, 1);
  await safeWrite(db);
  return removed;
}

export async function deleteProviderConnectionsByProvider(providerId) {
  const db = await getDb();
  const beforeCount = db.data.providerConnections.length;
  db.data.providerConnections = db.data.providerConnections.filter(
    (connection) => connection.provider !== providerId
  );
  const deletedCount = beforeCount - db.data.providerConnections.length;
  await safeWrite(db);
  return deletedCount;
}

export async function getProviderConnectionById(id) {
  const db = await getDb();
  return db.data.providerConnections.find(c => c.id === id) || null;
}

export async function createProviderConnection(data) {
  const db = await getDb();
  const now = new Date().toISOString();

  // Upsert: check existing by provider + email (oauth) or provider + name (apikey)
  let existingIndex = -1;
  if (data.authType === "oauth" && data.email) {
    existingIndex = db.data.providerConnections.findIndex(
      c => c.provider === data.provider && c.authType === "oauth" && c.email === data.email
    );
  } else if (data.authType === "apikey" && data.name) {
    existingIndex = db.data.providerConnections.findIndex(
      c => c.provider === data.provider && c.authType === "apikey" && c.name === data.name
    );
  }

  if (existingIndex !== -1) {
    db.data.providerConnections[existingIndex] = {
      ...db.data.providerConnections[existingIndex],
      ...data,
      updatedAt: now,
    };
    await safeWrite(db);
    return db.data.providerConnections[existingIndex];
  }

  let connectionName = data.name || null;
  if (!connectionName && data.authType === "oauth") {
    if (data.displayName) {
      connectionName = data.displayName;
    } else if (data.email) {
      connectionName = data.email;
    } else {
      const existingCount = db.data.providerConnections.filter(
        c => c.provider === data.provider
      ).length;
      connectionName = `Account ${existingCount + 1}`;
    }
  }

  let connectionPriority = data.priority;
  if (!connectionPriority) {
    const providerConnections = db.data.providerConnections.filter(c => c.provider === data.provider);
    const maxPriority = providerConnections.reduce((max, c) => Math.max(max, c.priority || 0), 0);
    connectionPriority = maxPriority + 1;
  }

  const connection = {
    id: uuidv4(),
    provider: data.provider,
    authType: data.authType || "oauth",
    name: connectionName,
    priority: connectionPriority,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdAt: now,
    updatedAt: now,
  };

  const optionalFields = [
    "displayName", "email", "globalPriority", "defaultModel",
    "accessToken", "refreshToken", "expiresAt", "tokenType",
    "scope", "idToken", "projectId", "apiKey", "testStatus",
    "lastTested", "lastError", "lastErrorAt", "rateLimitedUntil", "expiresIn", "errorCode",
    "consecutiveUseCount"
  ];

  for (const field of optionalFields) {
    if (data[field] !== undefined && data[field] !== null) {
      connection[field] = data[field];
    }
  }

  if (data.providerSpecificData && Object.keys(data.providerSpecificData).length > 0) {
    connection.providerSpecificData = data.providerSpecificData;
  }

  db.data.providerConnections.push(connection);
  await safeWrite(db);
  await reorderProviderConnections(data.provider);

  return connection;
}

export async function updateProviderConnection(id, data) {
  const db = await getDb();
  const index = db.data.providerConnections.findIndex(c => c.id === id);
  if (index === -1) return null;

  const providerId = db.data.providerConnections[index].provider;

  db.data.providerConnections[index] = {
    ...db.data.providerConnections[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await safeWrite(db);
  if (data.priority !== undefined) await reorderProviderConnections(providerId);

  return db.data.providerConnections[index];
}

export async function deleteProviderConnection(id) {
  const db = await getDb();
  const index = db.data.providerConnections.findIndex(c => c.id === id);
  if (index === -1) return false;

  const providerId = db.data.providerConnections[index].provider;
  db.data.providerConnections.splice(index, 1);
  await safeWrite(db);
  await reorderProviderConnections(providerId);

  return true;
}

export async function reorderProviderConnections(providerId) {
  const db = await getDb();
  if (!db.data.providerConnections) return;

  const providerConnections = db.data.providerConnections
    .filter(c => c.provider === providerId)
    .sort((a, b) => {
      const pDiff = (a.priority || 0) - (b.priority || 0);
      if (pDiff !== 0) return pDiff;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

  providerConnections.forEach((conn, index) => {
    conn.priority = index + 1;
  });

  await safeWrite(db);
}

export async function getModelAliases() {
  const db = await getDb();
  return db.data.modelAliases || {};
}

export async function setModelAlias(alias, model) {
  const db = await getDb();
  db.data.modelAliases[alias] = model;
  await safeWrite(db);
}

export async function deleteModelAlias(alias) {
  const db = await getDb();
  delete db.data.modelAliases[alias];
  await safeWrite(db);
}

export async function getCustomModels() {
  const db = await getDb();
  return db.data.customModels || [];
}

export async function addCustomModel({ providerAlias, id, type, name }) {
  const db = await getDb();
  if (!db.data.customModels) db.data.customModels = [];
  const model = { providerAlias, id, type: type || "llm", name: name || id };
  db.data.customModels.push(model);
  await safeWrite(db);
  return model;
}

export async function deleteCustomModel({ providerAlias, id, type }) {
  const db = await getDb();
  if (!db.data.customModels) return;
  db.data.customModels = db.data.customModels.filter(
    (m) => !(m.providerAlias === providerAlias && m.id === id && m.type === (type || "llm"))
  );
  await safeWrite(db);
}

export async function getMitmAlias(toolName) {
  const db = await getDb();
  const all = db.data.mitmAlias || {};
  if (toolName) return all[toolName] || {};
  return all;
}

export async function setMitmAliasAll(toolName, mappings) {
  const db = await getDb();
  if (!db.data.mitmAlias) db.data.mitmAlias = {};
  db.data.mitmAlias[toolName] = mappings || {};
  await safeWrite(db);
}

export async function getCombos() {
  const db = await getDb();
  return db.data.combos || [];
}

export async function getComboById(id) {
  const db = await getDb();
  return (db.data.combos || []).find(c => c.id === id) || null;
}

export async function getComboByName(name) {
  const db = await getDb();
  return (db.data.combos || []).find(c => c.name === name) || null;
}

export async function createCombo(data) {
  const db = await getDb();
  if (!db.data.combos) db.data.combos = [];

  const now = new Date().toISOString();
  const combo = {
    id: uuidv4(),
    name: data.name,
    models: data.models || [],
    createdAt: now,
    updatedAt: now,
  };

  db.data.combos.push(combo);
  await safeWrite(db);
  return combo;
}

export async function updateCombo(id, data) {
  const db = await getDb();
  if (!db.data.combos) db.data.combos = [];

  const index = db.data.combos.findIndex(c => c.id === id);
  if (index === -1) return null;

  db.data.combos[index] = {
    ...db.data.combos[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };

  await safeWrite(db);
  return db.data.combos[index];
}

export async function deleteCombo(id) {
  const db = await getDb();
  if (!db.data.combos) return false;

  const index = db.data.combos.findIndex(c => c.id === id);
  if (index === -1) return false;

  db.data.combos.splice(index, 1);
  await safeWrite(db);
  return true;
}

export async function getApiKeys() {
  const db = await getDb();
  return db.data.apiKeys || [];
}

function generateShortKey() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createApiKey(name, machineId, costLimit = null, allowedModels = null, rpmLimit = null) {
  if (!machineId) throw new Error("machineId is required");

  const db = await getDb();
  const now = new Date().toISOString();

  const { generateApiKeyWithMachine } = await import("@/shared/utils/apiKey");
  const result = generateApiKeyWithMachine(machineId);

  const apiKey = {
    id: uuidv4(),
    name: name,
    key: result.key,
    machineId: machineId,
    isActive: true,
    costLimit: costLimit, // null = unlimited, number = USD
    allowedModels: Array.isArray(allowedModels) && allowedModels.length > 0 ? allowedModels : null,
    rpmLimit: Number.isFinite(Number(rpmLimit)) && Number(rpmLimit) > 0 ? Math.floor(Number(rpmLimit)) : null,
    createdAt: now,
  };

  db.data.apiKeys.push(apiKey);
  await safeWrite(db);
  return apiKey;
}

export async function deleteApiKey(id) {
  const db = await getDb();
  const index = db.data.apiKeys.findIndex(k => k.id === id);
  if (index === -1) return false;

  db.data.apiKeys.splice(index, 1);
  await safeWrite(db);
  return true;
}

export async function getApiKeyById(id) {
  const db = await getDb();
  return db.data.apiKeys.find(k => k.id === id) || null;
}

export async function updateApiKey(id, data) {
  const db = await getDb();
  const index = db.data.apiKeys.findIndex(k => k.id === id);
  if (index === -1) return null;
  db.data.apiKeys[index] = { ...db.data.apiKeys[index], ...data };
  await safeWrite(db);
  return db.data.apiKeys[index];
}

const API_KEY_COST_CACHE_TTL_MS = 15000;
let apiKeyCostCache = {
  timestamp: 0,
  costByApiKey: new Map(),
};

function isApiKeyCostCacheFresh(now = Date.now()) {
  return now - apiKeyCostCache.timestamp < API_KEY_COST_CACHE_TTL_MS;
}

export function invalidateApiKeyCostCache(apiKey, costDelta) {
  const normalizedDelta = Number(costDelta);
  if (!apiKey || !Number.isFinite(normalizedDelta) || normalizedDelta <= 0) return;

  const now = Date.now();
  if (!isApiKeyCostCacheFresh(now)) return;

  const prev = Number(apiKeyCostCache.costByApiKey.get(apiKey) || 0);
  apiKeyCostCache.costByApiKey.set(apiKey, prev + normalizedDelta);
}

async function getApiKeySpentCost(apiKey) {
  const now = Date.now();
  if (isApiKeyCostCacheFresh(now)) {
    return apiKeyCostCache.costByApiKey.get(apiKey) || 0;
  }

  const { getUsageStats } = await import("@/lib/usageDb");
  const stats = await getUsageStats("all");
  const map = new Map();

  for (const entry of Object.values(stats?.byApiKey || {})) {
    if (!entry?.apiKey) continue;
    const prev = map.get(entry.apiKey) || 0;
    map.set(entry.apiKey, prev + Number(entry.cost || 0));
  }

  apiKeyCostCache = {
    timestamp: now,
    costByApiKey: map,
  };

  return map.get(apiKey) || 0;
}

export async function validateApiKey(key, requestContext = {}) {
  const db = await getDb();
  const found = db.data.apiKeys.find(k => k.key === key);
  if (!found || found.isActive === false) return false;

  // Check model whitelist
  if (requestContext.model && Array.isArray(found.allowedModels) && found.allowedModels.length > 0) {
    if (!found.allowedModels.includes(requestContext.model)) {
      return false;
    }
  }

  // Check RPM limit (before recording)
  if (found.rpmLimit && Number.isFinite(found.rpmLimit) && found.rpmLimit > 0) {
    const recentCount = getApiKeyRequestCountLastMinute(key);
    if (recentCount >= found.rpmLimit) {
      return false;
    }
  }

  // costLimit: null/undefined => unlimited
  const limit = Number(found.costLimit);
  const hasLimit = Number.isFinite(limit) && limit > 0;
  if (hasLimit) {
    const spent = await getApiKeySpentCost(key);
    if (spent >= limit) return false;
  }

  // Passed all checks — record request immediately
  recordApiKeyRequest(key);
  return true;
}

function getApiKeyRequestCountLastMinute(apiKey) {
  const nowSec = Math.floor(Date.now() / 1000);
  const state = getOrCreateApiKeyRpmBuckets(apiKey);
  cleanupApiKeyRpmBucket(state, nowSec);
  state.lastSeenSec = nowSec;
  maybeCleanupApiKeyRpmMap(nowSec);
  return state.total;
}

export function recordApiKeyRequest(apiKey, timestamp = Date.now()) {
  if (!apiKey) return;
  const nowSec = Math.floor(timestamp / 1000);
  const state = getOrCreateApiKeyRpmBuckets(apiKey);
  cleanupApiKeyRpmBucket(state, nowSec);

  const index = nowSec % RPM_WINDOW_SECONDS;
  if (state.slots[index] !== nowSec) {
    if (state.counts[index] > 0) {
      state.total -= state.counts[index];
    }
    state.slots[index] = nowSec;
    state.counts[index] = 0;
  }

  state.counts[index] += 1;
  state.total += 1;
  state.lastSeenSec = nowSec;
  maybeCleanupApiKeyRpmMap(nowSec);
}

export function rollbackApiKeyRequest(apiKey, timestamp = Date.now()) {
  if (!apiKey) return;
  const nowSec = Math.floor(timestamp / 1000);
  const state = apiKeyRpmState.get(apiKey);
  if (!state) return;

  cleanupApiKeyRpmBucket(state, nowSec);
  const index = nowSec % RPM_WINDOW_SECONDS;
  if (state.slots[index] !== nowSec || state.counts[index] <= 0) return;

  state.counts[index] -= 1;
  state.total -= 1;
  if (state.total < 0) state.total = 0;
  state.lastSeenSec = nowSec;
}

export function clearApiKeyRequestWindow(apiKey) {
  if (!apiKey) return;
  apiKeyRpmState.delete(apiKey);
}

export function hydrateApiKeyRequestWindow(apiKey, timestamps = []) {
  if (!apiKey || !Array.isArray(timestamps) || timestamps.length === 0) return;
  clearApiKeyRequestWindow(apiKey);
  for (const timestamp of timestamps) {
    const numericTs = Number(timestamp);
    if (!Number.isFinite(numericTs)) continue;
    recordApiKeyRequest(apiKey, numericTs);
  }
}

export function getApiKeyRpmSnapshot(apiKey) {
  if (!apiKey) return 0;
  return getApiKeyRequestCountLastMinute(apiKey);
}

export function preloadApiKeyRequestWindow(apiKey, count = 0) {
  if (!apiKey || !Number.isFinite(count) || count <= 0) return;
  const nowSec = Math.floor(Date.now() / 1000);
  const state = getOrCreateApiKeyRpmBuckets(apiKey);
  cleanupApiKeyRpmBucket(state, nowSec);
  const index = nowSec % RPM_WINDOW_SECONDS;
  if (state.slots[index] !== nowSec) {
    if (state.counts[index] > 0) {
      state.total -= state.counts[index];
    }
    state.slots[index] = nowSec;
    state.counts[index] = 0;
  }
  state.counts[index] += count;
  state.total += count;
  state.lastSeenSec = nowSec;
}

export async function cleanupProviderConnections() {
  const db = await getDb();
  const fieldsToCheck = [
    "displayName", "email", "globalPriority", "defaultModel",
    "accessToken", "refreshToken", "expiresAt", "tokenType",
    "scope", "idToken", "projectId", "apiKey", "testStatus",
    "lastTested", "lastError", "lastErrorAt", "rateLimitedUntil", "expiresIn",
    "consecutiveUseCount"
  ];

  let cleaned = 0;
  for (const connection of db.data.providerConnections) {
    for (const field of fieldsToCheck) {
      if (connection[field] === null || connection[field] === undefined) {
        delete connection[field];
        cleaned++;
      }
    }
    if (connection.providerSpecificData && Object.keys(connection.providerSpecificData).length === 0) {
      delete connection.providerSpecificData;
      cleaned++;
    }
  }

  if (cleaned > 0) await safeWrite(db);
  return cleaned;
}

function cloneSettingsSnapshot(settings) {
  if (!settings || typeof settings !== "object") {
    return cloneDefaultSettings();
  }
  return JSON.parse(JSON.stringify(settings));
}

async function refreshSettingsSnapshot() {
  const db = await getDb();
  settingsCache = cloneSettingsSnapshot(db.data.settings || DEFAULT_SETTINGS);
  settingsCacheAt = Date.now();
  return settingsCache;
}

function refreshSettingsSnapshotInBackground() {
  if (settingsRefreshPromise) return settingsRefreshPromise;

  settingsRefreshPromise = refreshSettingsSnapshot()
    .catch((error) => {
      logger.debug("DB", "Background settings refresh skipped", {
        message: error?.message || String(error),
      });
      return settingsCache;
    })
    .finally(() => {
      settingsRefreshPromise = null;
    });

  return settingsRefreshPromise;
}

export async function getSettings() {
  const now = Date.now();
  if (settingsCache && now - settingsCacheAt < getSettingsCacheTtlMs()) {
    return cloneSettingsSnapshot(settingsCache);
  }

  if (settingsCache) {
    refreshSettingsSnapshotInBackground();
    return cloneSettingsSnapshot(settingsCache);
  }

  if (settingsCachePromise) {
    const settings = await settingsCachePromise;
    return cloneSettingsSnapshot(settings);
  }

  settingsCachePromise = refreshSettingsSnapshot();

  try {
    const settings = await settingsCachePromise;
    return cloneSettingsSnapshot(settings);
  } finally {
    settingsCachePromise = null;
  }
}

export async function updateSettings(updates) {
  const db = await getDb();
  db.data.settings = { ...db.data.settings, ...updates };
  await safeWrite(db);

  settingsCache = cloneSettingsSnapshot(db.data.settings);
  settingsCacheAt = Date.now();
  return db.data.settings;
}

export async function exportDb() {
  const db = await getDb();
  return db.data || cloneDefaultData();
}

export async function importDb(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid database payload");
  }

  const nextData = {
    ...cloneDefaultData(),
    ...payload,
    settings: {
      ...cloneDefaultData().settings,
      ...(payload.settings && typeof payload.settings === "object" && !Array.isArray(payload.settings)
        ? payload.settings
        : {}),
    },
  };

  const { data: normalized } = ensureDbShape(nextData);
  const db = await getDb();
  db.data = normalized;
  await safeWrite(db);

  settingsCache = db.data.settings || { cloudEnabled: false };
  settingsCacheAt = Date.now();
  return db.data;
}

export async function isCloudEnabled() {
  const settings = await getSettings();
  return settings.cloudEnabled === true;
}

export async function getCloudUrl() {
  const settings = await getSettings();
  return normalizeCloudUrl(settings.cloudUrl) || normalizeCloudUrl(process.env.CLOUD_URL) || normalizeCloudUrl(process.env.NEXT_PUBLIC_CLOUD_URL) || "";
}

export async function getPricing() {
  const db = await getDb();
  const userPricing = db.data.pricing || {};
  const { PROVIDER_PRICING } = await import("@/shared/constants/pricing.js");

  const merged = {};

  for (const [provider, models] of Object.entries(PROVIDER_PRICING)) {
    merged[provider] = { ...models };
    if (userPricing[provider]) {
      for (const [model, pricing] of Object.entries(userPricing[provider])) {
        merged[provider][model] = merged[provider][model]
          ? { ...merged[provider][model], ...pricing }
          : pricing;
      }
    }
  }

  for (const [provider, models] of Object.entries(userPricing)) {
    if (!merged[provider]) {
      merged[provider] = { ...models };
    } else {
      for (const [model, pricing] of Object.entries(models)) {
        if (!merged[provider][model]) merged[provider][model] = pricing;
      }
    }
  }

  return merged;
}

export async function getPricingForModel(provider, model) {
  if (!model) return null;

  const db = await getDb();
  const userPricing = db.data.pricing || {};

  if (provider && userPricing[provider]?.[model]) {
    return userPricing[provider][model];
  }

  const { getPricingForModel: resolve } = await import("@/shared/constants/pricing.js");
  return resolve(provider, model);
}

export async function updatePricing(pricingData) {
  const db = await getDb();
  if (!db.data.pricing) db.data.pricing = {};

  for (const [provider, models] of Object.entries(pricingData)) {
    if (!db.data.pricing[provider]) db.data.pricing[provider] = {};
    for (const [model, pricing] of Object.entries(models)) {
      db.data.pricing[provider][model] = pricing;
    }
  }

  await safeWrite(db);
  return db.data.pricing;
}

export async function resetPricing(provider, model) {
  const db = await getDb();
  if (!db.data.pricing) db.data.pricing = {};

  if (model) {
    if (db.data.pricing[provider]) {
      delete db.data.pricing[provider][model];
      if (Object.keys(db.data.pricing[provider]).length === 0) {
        delete db.data.pricing[provider];
      }
    }
  } else {
    delete db.data.pricing[provider];
  }

  await safeWrite(db);
  return db.data.pricing;
}

export async function resetAllPricing() {
  const db = await getDb();
  db.data.pricing = {};
  await safeWrite(db);
  return db.data.pricing;
}
