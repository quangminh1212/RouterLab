import { NextResponse } from "next/server";
import { getChartData } from "@/lib/usageDb";

const VALID_PERIODS = new Set(["24h", "7d", "30d", "60d", "all"]);
const CACHE_TTL_MS = 3000;
const chartCache = new Map();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const now = Date.now();
    const cached = chartCache.get(period);

    if (cached?.data && now - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json(cached.data, { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } });
    }

    if (cached?.promise) {
      const data = await cached.promise;
      return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } });
    }

    const promise = getChartData(period);
    chartCache.set(period, { ts: now, data: cached?.data || null, promise });
    const data = await promise;
    chartCache.set(period, { ts: Date.now(), data, promise: null });

    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=4" } });
  } catch (error) {
    console.error("[API] Failed to get chart data:", error);
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
