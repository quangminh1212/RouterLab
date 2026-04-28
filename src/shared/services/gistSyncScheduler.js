import { getSettings, updateSettings } from "@/lib/localDb";
import { backupToGist } from "@/lib/gistBackup";

const DEFAULT_INTERVAL_MS = 60 * 1000;

const state = global.__gistSyncScheduler ??= {
  interval: null,
  running: false,
  lastSyncedAt: 0,
};

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

    if (gistBackup.enabled !== true || !gistBackup.token) {
      return;
    }

    const passphrase = buildStableGistPassphrase(gistBackup);
    const result = await backupToGist({
      token: gistBackup.token,
      gistId: gistBackup.gistId || "",
      passphrase,
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
