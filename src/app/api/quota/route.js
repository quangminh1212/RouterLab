// Compatibility route: /api/quota
// Legacy clients may call /api/quota; this route returns a simplified quota view derived from usage stats.

import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "30d";

    let stats;
    try {
      stats = await getUsageStats(period);
    } catch (dbError) {
      console.error("[API] getUsageStats failed in /api/quota:", dbError.message);
      // Return minimal fallback shape when DB unavailable
      return NextResponse.json({
        period,
        totalCost: 0,
        totalRequests: 0,
        providers: [],
        models: [],
        timestamp: new Date().toISOString(),
        error: "Usage database unavailable"
      }, {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache",
          "X-Compat-Route": "quota-to-usage-stats-fallback"
        }
      });
    }

    // Build a simplified quota response shape for legacy compatibility
    const quota = {
      period,
      totalCost: stats?.totalCost || 0,
      totalRequests: stats?.totalRequests || 0,
      providers: stats?.providers || [],
      models: stats?.models || [],
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(quota, {
      headers: {
        "Cache-Control": "private, max-age=5, stale-while-revalidate=10",
        "X-Compat-Route": "quota-to-usage-stats"
      }
    });
  } catch (error) {
    console.error("[API] Failed to get quota:", error);
    return NextResponse.json({ error: "Failed to fetch quota" }, { status: 500 });
  }
}
