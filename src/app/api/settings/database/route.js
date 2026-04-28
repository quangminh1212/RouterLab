import { NextResponse } from "next/server";
import { createBackupBundle, restoreBackupBundle } from "@/lib/backupBundle";

export async function GET() {
  try {
    const payload = await createBackupBundle();
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
