import { importDb, getSettings } from "@/lib/localDb";
import { importUsageDb } from "@/lib/usageDb";
import { importRequestDetailsDb } from "@/lib/requestDetailsDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";
import { restoreClaudeSettingsBackup } from "@/app/api/cli-tools/claude-settings/route";
import { restoreCodexSettingsBackup } from "@/app/api/cli-tools/codex-settings/route";
import { restoreOpenCodeSettingsBackup } from "@/app/api/cli-tools/opencode-settings/route";
import { restoreOpenClawSettingsBackup } from "@/app/api/cli-tools/openclaw-settings/route";
import { restoreDroidSettingsBackup } from "@/app/api/cli-tools/droid-settings/route";
import { restoreCopilotSettingsBackup } from "@/app/api/cli-tools/copilot-settings/route";

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

export async function createBackupBundle(options = {}) {
  const includeUsage = options.includeUsage !== false;
  const includeRequestDetails = options.includeRequestDetails !== false;

  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    backupDataStored: false,
    metadata: {
      includesUsage: false,
      includesRequestDetails: false,
      includesClaudeCli: false,
      includesCodexCli: false,
      includesOpenCodeCli: false,
      includesOpenClawCli: false,
      includesDroidCli: false,
      includesCopilotCli: false,
      requestedUsage: includeUsage,
      requestedRequestDetails: includeRequestDetails,
      omittedReason: "backup-data-disabled",
    },
  };
}

export async function restoreBackupBundle(payload) {
  if (payload?.backupDataStored === false) {
    throw new Error("This backup does not contain any restorable data");
  }

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

