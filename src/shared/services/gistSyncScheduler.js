import { getSettings, updateSettings } from "@/lib/localDb";
import { restoreFromGist } from "@/lib/gistBackup";

const DEFAULT_INTERVAL_MS = 60 * 1000;

const state = global.__gistSyncScheduler ??= {
  interval: null,
  running: false,
  lastSyncedAt: 0,
};

async function fetchGistUpdatedAt(token, gistId) {
  if (!token || !gistId) return null;
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data?.updated_at || null;
  } catch {
    return null;
  }
}

function buildStableGistPassphrase(gistBackup) {
  const login = String(gistBackup?.githubLogin || "").trim().toLowerCase();
  const token = String(gistBackup?.token || "");
  if (!login) return token;
  return `xlabrouter-gist-sync:${login}`;
}

async function runAutoRestoreOnce() {
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

    const remoteUpdatedAt = await fetchGistUpdatedAt(gistBackup.token, gistBackup.gistId || "");
    const localUpdatedAt = gistBackup.updatedAt || "";
    if (remoteUpdatedAt && localUpdatedAt && new Date(remoteUpdatedAt).getTime() <= new Date(localUpdatedAt).getTime()) {
      return;
    }

    const passphrase = buildStableGistPassphrase(gistBackup);
    const result = await restoreFromGist({
      token: gistBackup.token,
      gistId: gistBackup.gistId || "",
      passphrase,
      passphrases: [passphrase, gistBackup.token],
    });

    state.lastSyncedAt = Date.now();

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
    console.log("[GistSync] Auto restore failed:", error.message);
  } finally {
    state.running = false;
  }
}

export async function startGistSyncScheduler(intervalMs = DEFAULT_INTERVAL_MS) {
  if (state.interval) return state;

  state.interval = setInterval(() => {
    runAutoRestoreOnce().catch(() => {});
  }, intervalMs);

  if (state.interval.unref) state.interval.unref();

  setTimeout(() => {
    runAutoRestoreOnce().catch(() => {});
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
  await runAutoRestoreOnce();
}

export default startGistSyncScheduler;
