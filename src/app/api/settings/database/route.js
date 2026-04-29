import { NextResponse } from "next/server";
import { createBackupBundle, restoreBackupBundle } from "@/lib/backupBundle";

export async function GET() {
  try {
    const payload = await createBackupBundle({ includeUsage: true, includeRequestDetails: false });

    // Keep backup lightweight: remove usage.history, keep dailySummary + totals.
    if (payload?.usage && typeof payload.usage === "object") {
      payload.usage = {
        ...payload.usage,
        history: [],
      };
    }

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
