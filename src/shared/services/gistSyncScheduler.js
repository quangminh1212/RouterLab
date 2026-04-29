import { getSettings, updateSettings } from "@/lib/localDb";
import { backupToGist } from "@/lib/gistBackup";
import { createBackupBundle } from "@/lib/backupBundle";
import crypto from "node:crypto";

const DEFAULT_INTERVAL_MS = 60 * 1000;
const USAGE_SYNC_INTERVAL_MS = 60 * 60 * 1000;

const state = global.__gistSyncScheduler ??= {
  interval: null,
  running: false,
  lastSyncedAt: 0,
  lastCoreHash: "",
  lastUsageHash: "",
  lastUsageSyncedAt: 0,
};

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortObject(value[key]);
    }
    return sorted;
  }
  return value;
}

function hashPayload(value) {
  const canonical = JSON.stringify(sortObject(value));
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function computeCoreHash(bundle) {
  const core = { ...bundle };
  delete core.exportedAt;
  delete core.usage;
  delete core.requestDetails;
  return hashPayload(core);
}

function computeUsageHash(bundle) {
  return hashPayload({
    usage: bundle?.usage || null,
    requestDetails: bundle?.requestDetails || null,
  });
}

function buildStableGistPassphrase(gistBackup) {
  const login = String(gistBackup?.githubLogin || "").trim().toLowerCase();
  const token = String(gistBackup?.token || "");
  if (!login) return token;
  return `xlabrouter-gist-sync:${login}`;
}

async function runBackupOnce() {
  if (state.running) return;
  state.running = true;

  try {
    const settings = await getSettings();
    const gistBackup = settings?.gistBackup || {};

    if (gistBackup.enabled !== true || !gistBackup.token || gistBackup.autoSyncEnabled === false) {
      return;
    }

    const intervalMinutes = Math.min(60, Math.max(1, Number(gistBackup.syncIntervalMinutes || 1)));
    const minGapMs = intervalMinutes * 60 * 1000;
    if (state.lastSyncedAt && Date.now() - state.lastSyncedAt < minGapMs) {
      return;
    }

    const now = Date.now();
    const includeUsage = now - state.lastUsageSyncedAt >= USAGE_SYNC_INTERVAL_MS;
    const includeRequestDetails = includeUsage;

    const bundle = await createBackupBundle({ includeUsage, includeRequestDetails });
    const nextCoreHash = computeCoreHash(bundle);
    const nextUsageHash = includeUsage ? computeUsageHash(bundle) : state.lastUsageHash;

    const coreChanged = nextCoreHash !== state.lastCoreHash;
    const usageChanged = includeUsage && nextUsageHash !== state.lastUsageHash;
    if (!coreChanged && !usageChanged) {
      return;
    }

    const passphrase = buildStableGistPassphrase(gistBackup);
    const result = await backupToGist({
      token: gistBackup.token,
      gistId: gistBackup.gistId || "",
      passphrase,
      payload: bundle,
    });

    state.lastSyncedAt = Date.now();
    state.lastCoreHash = nextCoreHash;
    if (includeUsage) {
      state.lastUsageHash = nextUsageHash;
      state.lastUsageSyncedAt = now;
    }

    await updateSettings({
      gistBackup: {
        ...gistBackup,
        enabled: true,
        gistId: result.gistId,
        htmlUrl: result.htmlUrl,
        updatedAt: result.updatedAt,
      },
    });
  } catch (error) {
    console.log("[GistSync] Scheduled backup failed:", error.message);
  } finally {
    state.running = false;
  }
}

export async function startGistSyncScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (state.interval) return state;

  state.interval = setInterval(() => {
    runBackupOnce().catch(() => {});
  }, intervalMs);

  if (state.interval.unref) state.interval.unref();

  setTimeout(() => {
    runBackupOnce().catch(() => {});
  }, 15 * 1000).unref?.();

  return state;
}

export function stopGistSyncScheduler() {
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = null;
  }
}

export async function runGistSyncNow() {
  await runBackupOnce();
}

export default startGistSyncScheduler;
