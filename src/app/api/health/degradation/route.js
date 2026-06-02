import { NextResponse } from "next/server";
import { getRuntimeHealth } from "@/lib/runtimeGuard";

function buildSummary(runtime) {
  const status = runtime?.status || "unknown";
  return {
    runtimeStatus: status,
    degraded: status === "degraded" || status === "error",
    timestamp: runtime?.timestamp || new Date().toISOString(),
  };
}

export async function GET(request) {
  try {
    const runtime = getRuntimeHealth();
    const summary = buildSummary(runtime);
    const url = new URL(request.url);

    if (url.searchParams.get("summary") === "true") {
      return NextResponse.json({
        summary,
        isDegraded: summary.degraded,
      });
    }

    return NextResponse.json({
      active: summary.degraded,
      summary,
      features: {
        runtime: {
          status: runtime?.status || "unknown",
          timestamp: runtime?.timestamp || summary.timestamp,
        },
      },
    });
  } catch (error) {
    console.error("[API ERROR] /api/health/degradation GET:", error);
    return NextResponse.json({ error: "Failed to fetch degradation report." }, { status: 500 });
  }
}
