import { NextResponse } from "next/server";
import { createBackupBundle, restoreBackupBundle } from "@/lib/backupBundle";

export async function GET() {
  try {
    const payload = await createBackupBundle({ includeUsage: true, includeRequestDetails: false });

    // Ensure request details are not exported.
    if (payload && typeof payload === "object") {
      delete payload.requestDetails;
      if (payload.metadata && typeof payload.metadata === "object") {
        payload.metadata.includesRequestDetails = false;
      }
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.log("Error exporting database:", error);
    return NextResponse.json({ error: "Failed to export database" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();

    if (payload?.format === "xlabrouter-gist-backup") {
      return NextResponse.json(
        { error: "Encrypted Gist backup file is not supported here. Use GitHub Gist Restore instead of Import Backup." },
        { status: 400 }
      );
    }

    // Enforce lightweight restore: never import heavy per-request logs.
    if (payload && typeof payload === "object") {
      if (payload.database && typeof payload.database === "object") {
        if (payload.database.requestDetailsData && typeof payload.database.requestDetailsData === "object") {
          payload.database.requestDetailsData.records = [];
        }
      }

      delete payload.requestDetails;
    }

    const result = await restoreBackupBundle(payload);
    return NextResponse.json(result);
  } catch (error) {
    console.log("Error importing database:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import database" },
      { status: 400 }
    );
  }
}

