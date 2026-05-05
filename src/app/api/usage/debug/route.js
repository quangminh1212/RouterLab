import { NextResponse } from "next/server";
import { getUsageDebugInfo } from "@/lib/usageDb";

const VALID_PERIODS = new Set(["24h", "7d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const debug = await getUsageDebugInfo(period);
    return NextResponse.json(debug);
  } catch (error) {
    console.error("[API] Failed to get usage debug info:", error);
    return NextResponse.json({ error: "Failed to fetch usage debug info" }, { status: 500 });
  }
}
