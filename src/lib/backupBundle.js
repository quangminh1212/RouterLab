import { exportDb, importDb, getSettings } from "@/lib/localDb";
import { exportUsageDb, importUsageDb } from "@/lib/usageDb";
import { exportRequestDetailsDb, importRequestDetailsDb } from "@/lib/requestDetailsDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";
import { getClaudeSettingsBackup, restoreClaudeSettingsBackup } from "@/app/api/cli-tools/claude-settings/route";
import { getCodexSettingsBackup, restoreCodexSettingsBackup } from "@/app/api/cli-tools/codex-settings/route";
import { getOpenCodeSettingsBackup, restoreOpenCodeSettingsBackup } from "@/app/api/cli-tools/opencode-settings/route";
import { getOpenClawSettingsBackup, restoreOpenClawSettingsBackup } from "@/app/api/cli-tools/openclaw-settings/route";
import { getDroidSettingsBackup, restoreDroidSettingsBackup } from "@/app/api/cli-tools/droid-settings/route";
import { getCopilotSettingsBackup, restoreCopilotSettingsBackup } from "@/app/api/cli-tools/copilot-settings/route";

export function isBackupBundle(payload) {
  return !!(
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    payload.database &&
    typeof payload.database === "object"
  );
}

export function isUsageBackupPayload(payload) {
  return !!(
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    (Array.isArray(payload.history) ||
      (typeof payload.dailySummary === "object" && payload.dailySummary !== null) ||
      typeof payload.totalRequestsLifetime === "number")
  );
}

async function exportToolBackups() {
  const [claudeCli, codexCli, openCodeCli, openClawCli, droidCli, copilotCli] = await Promise.all([
    getClaudeSettingsBackup(),
    getCodexSettingsBackup(),
    getOpenCodeSettingsBackup(),
    getOpenClawSettingsBackup(),
    getDroidSettingsBackup(),
    getCopilotSettingsBackup(),
  ]);

  return {
    claudeCli,
    codexCli,
    openCodeCli,
    openClawCli,
    droidCli,
    copilotCli,
  };
}

async function restoreToolBackups(payload) {
  const restoreTasks = [];

  if (payload?.claudeCli && typeof payload.claudeCli === "object" && !Array.isArray(payload.claudeCli)) {
    restoreTasks.push(restoreClaudeSettingsBackup(payload.claudeCli));
  }
  if (payload?.codexCli && typeof payload.codexCli === "object" && !Array.isArray(payload.codexCli)) {
    restoreTasks.push(restoreCodexSettingsBackup(payload.codexCli));
  }
  if (payload?.openCodeCli && typeof payload.openCodeCli === "object" && !Array.isArray(payload.openCodeCli)) {
    restoreTasks.push(restoreOpenCodeSettingsBackup(payload.openCodeCli));
  }
  if (payload?.openClawCli && typeof payload.openClawCli === "object" && !Array.isArray(payload.openClawCli)) {
    restoreTasks.push(restoreOpenClawSettingsBackup(payload.openClawCli));
  }
  if (payload?.droidCli && typeof payload.droidCli === "object" && !Array.isArray(payload.droidCli)) {
    restoreTasks.push(restoreDroidSettingsBackup(payload.droidCli));
  }
  if (payload?.copilotCli && typeof payload.copilotCli === "object" && !Array.isArray(payload.copilotCli)) {
    restoreTasks.push(restoreCopilotSettingsBackup(payload.copilotCli));
  }

  await Promise.all(restoreTasks);
}

async function reapplyImportedRuntimeSettings() {
  try {
    const settings = await getSettings();
    applyOutboundProxyEnv(settings);
  } catch (err) {
    console.warn("[Settings][DatabaseImport] Failed to re-apply outbound proxy env:", err);
  }
}

export async function createBackupBundle() {
  const [database, usage, requestDetails, toolBackups] = await Promise.all([
    exportDb(),
    exportUsageDb(),
    exportRequestDetailsDb(),
    exportToolBackups(),
  ]);

  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    database,
    usage,
    requestDetails,
    ...toolBackups,
    metadata: {
      includesUsage: true,
      includesRequestDetails: true,
      includesClaudeCli: true,
      includesCodexCli: true,
      includesOpenCodeCli: true,
      includesOpenClawCli: true,
      includesDroidCli: true,
      includesCopilotCli: true,
    },
  };
}

export async function restoreBackupBundle(payload) {
  let importMode = "database";
  let importedDb = false;

  if (isBackupBundle(payload)) {
    await importDb(payload.database);
    importedDb = true;
    importMode = "bundle";

    if (payload.usage && typeof payload.usage === "object") {
      await importUsageDb(payload.usage);
    }

    if (payload.requestDetails && typeof payload.requestDetails === "object") {
      await importRequestDetailsDb(payload.requestDetails);
    }

    await restoreToolBackups(payload);
  } else if (isUsageBackupPayload(payload)) {
    await importUsageDb(payload);
    importMode = "usage";
  } else {
    await importDb(payload);
    importedDb = true;
    importMode = "database";
    await restoreToolBackups(payload);
  }

  if (importedDb) {
    await reapplyImportedRuntimeSettings();
  }

  return { success: true, importMode };
}
