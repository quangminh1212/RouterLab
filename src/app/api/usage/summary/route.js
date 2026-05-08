// Compatibility alias: /api/usage/summary → /api/usage/stats
// Legacy clients may call /api/usage/summary; this route redirects to the current /api/usage/stats endpoint.

import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";

const VALID_PERIODS = new Set(["24h", "7d", "30d", "60d", "all"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    let stats;
    try {
      stats = await getUsageStats(period);
    } catch (dbError) {
      console.error("[API] getUsageStats failed in /api/usage/summary:", dbError.message);
      // Return minimal fallback shape when DB unavailable
      return NextResponse.json({
        totalRequests: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCost: 0,
        byProvider: {},
        byModel: {},
        recentRequests: [],
        error: "Usage database unavailable"
      }, {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache",
          "X-Compat-Route": "usage-summary-to-usage-stats-fallback"
        }
      });
    }

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "private, max-age=2, stale-while-revalidate=4",
        "X-Compat-Route": "usage-summary-to-usage-stats"
      }
    });
  } catch (error) {
    console.error("[API] Failed to get usage summary:", error);
    return NextResponse.json({ error: "Failed to fetch usage summary" }, { status: 500 });
  }
}
