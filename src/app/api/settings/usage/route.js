import { NextResponse } from "next/server";
import { exportUsageDb, importUsageDb } from "@/lib/usageDb";
import { logger } from "@/lib/logger";

function invalidJsonResponse() {
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}

export async function GET() {
  try {
    logger.info("API:USAGE", "Exporting usage database");
    const payload = await exportUsageDb();
    return NextResponse.json(payload);
  } catch (error) {
    logger.error("API:USAGE", "Error exporting usage database", error);
    return NextResponse.json({ error: "Failed to export usage database" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    logger.info("API:USAGE", "Importing usage database");
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return invalidJsonResponse();
    }
    await importUsageDb(payload);
    logger.info("API:USAGE", "Usage database imported successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("API:USAGE", "Error importing usage database", error);
    return NextResponse.json(
      { error: error?.message || "Failed to import usage database" },
      { status: 400 }
    );
  }
}
