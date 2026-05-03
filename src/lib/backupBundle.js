import { exportDb, importDb, getSettings } from "@/lib/localDb";
import { exportUsageDb, importUsageDb } from "@/lib/usageDb";
import { importRequestDetailsDb } from "@/lib/requestDetailsDb";
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

function stripRequestDataFromDatabase(database) {
  if (!database || typeof database !== "object" || Array.isArray(database)) return database;

  if (database.requestDetailsData && typeof database.requestDetailsData === "object" && !Array.isArray(database.requestDetailsData)) {
    database.requestDetailsData.records = [];
  }

  return database;
}

function stripRequestDataFromUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return usage;
  return {
    ...usage,
    history: [],
  };
}

function stripRequestDataFromBundle(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;

  if (payload.database && typeof payload.database === "object" && !Array.isArray(payload.database)) {
    stripRequestDataFromDatabase(payload.database);
    if (payload.database.usageData && typeof payload.database.usageData === "object" && !Array.isArray(payload.database.usageData)) {
      payload.database.usageData.history = [];
    }
  }
  if (payload.usage && typeof payload.usage === "object" && !Array.isArray(payload.usage)) {
    payload.usage = stripRequestDataFromUsage(payload.usage);
  }
  delete payload.requestDetails;

  if (payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)) {
    payload.metadata.includesRequestDetails = false;
  }

  return payload;
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

export async function createBackupBundle(options = {}) {
  const includeUsage = options.includeUsage !== false;

  const [database, usage, toolBackups] = await Promise.all([
    exportDb(),
    includeUsage ? exportUsageDb() : Promise.resolve(undefined),
    exportToolBackups(),
  ]);

  const payload = {
    version: 4,
    exportedAt: new Date().toISOString(),
    database: stripRequestDataFromDatabase(database),
    ...(includeUsage && usage ? { usage: stripRequestDataFromUsage(usage) } : {}),
    ...toolBackups,
    metadata: {
      includesUsage: includeUsage,
      includesRequestDetails: false,
      includesClaudeCli: true,
      includesCodexCli: true,
      includesOpenCodeCli: true,
      includesOpenClawCli: true,
      includesDroidCli: true,
      includesCopilotCli: true,
    },
  };

  return stripRequestDataFromBundle(payload);
}

export async function restoreBackupBundle(payload) {
  stripRequestDataFromBundle(payload);

  let importMode = "database";
  let importedDb = false;

  if (isBackupBundle(payload)) {
    await importDb(payload.database);
    importedDb = true;
    importMode = "bundle";

    if (payload.usage && typeof payload.usage === "object") {
      await importUsageDb(payload.usage);
    }

    await importRequestDetailsDb(
      payload.requestDetails && typeof payload.requestDetails === "object"
        ? payload.requestDetails
        : { records: [] }
    );

    await restoreToolBackups(payload);
  } else if (isUsageBackupPayload(payload)) {
    await importUsageDb(stripRequestDataFromUsage(payload));
    importMode = "usage";
  } else {
    await importDb(stripRequestDataFromDatabase(payload));
    importedDb = true;
    importMode = "database";
    await restoreToolBackups(payload);
  }

  if (importedDb) {
    await reapplyImportedRuntimeSettings();
  }

  return { success: true, importMode };
}


