import { NextResponse } from "next/server";
import { getUsageStats } from "@/lib/usageDb";

const VALID_PERIODS = new Set(["24h", "7d", "30d", "60d", "all"]);
const CACHE_TTL_MS = 3000;
const statsCache = new Map();

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const now = Date.now();
    const cached = statsCache.get(period);

    if (cached?.data && now - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } });
    }

    if (cached?.promise) {
      const stats = await cached.promise;
      return NextResponse.json(stats, { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } });
    }

    const promise = getUsageStats(period);
    statsCache.set(period, { ts: now, data: cached?.data || null, promise });
    const stats = await promise;
    statsCache.set(period, { ts: Date.now(), data: stats, promise: null });

    return NextResponse.json(stats, { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } });
  } catch (error) {
    console.error("[API] Failed to get usage stats:", error);
    return NextResponse.json({ error: "Failed to fetch usage stats" }, { status: 500 });
  }
}
