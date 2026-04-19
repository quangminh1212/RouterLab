import { NextResponse } from "next/server";
import { exportDb, getSettings, importDb } from "@/lib/localDb";
import { exportUsageDb, importUsageDb } from "@/lib/usageDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";

function isBackupBundle(payload) {
  return !!(
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    payload.database &&
    typeof payload.database === "object"
  );
}

function isUsageBackupPayload(payload) {
  return !!(
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    (Array.isArray(payload.history) ||
      (typeof payload.dailySummary === "object" && payload.dailySummary !== null) ||
      typeof payload.totalRequestsLifetime === "number")
  );
}

export async function GET() {
  try {
    const [database, usage] = await Promise.all([exportDb(), exportUsageDb()]);

    return NextResponse.json({
      version: 2,
      exportedAt: new Date().toISOString(),
      database,
      usage,
      metadata: {
        includesUsage: true,
      },
    });
  } catch (error) {
    console.log("Error exporting database:", error);
    return NextResponse.json({ error: "Failed to export database" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    let importMode = "database";
    let importedDb = false;

    if (isBackupBundle(payload)) {
      await importDb(payload.database);
      importedDb = true;
      importMode = "bundle";

      if (payload.usage && typeof payload.usage === "object") {
        await importUsageDb(payload.usage);
      }
    } else if (isUsageBackupPayload(payload)) {
      await importUsageDb(payload);
      importMode = "usage";
    } else {
      await importDb(payload);
      importedDb = true;
      importMode = "database";
    }

    // Ensure proxy settings take effect immediately after a DB import.
    if (importedDb) {
      try {
        const settings = await getSettings();
        applyOutboundProxyEnv(settings);
      } catch (err) {
        console.warn("[Settings][DatabaseImport] Failed to re-apply outbound proxy env:", err);
      }
    }

    return NextResponse.json({ success: true, importMode });
  } catch (error) {
    console.log("Error importing database:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import database" },
      { status: 400 }
    );
  }
}
