import { NextResponse } from "next/server";
import { getRuntimeHealth } from "@/lib/runtimeGuard";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const runtime = getRuntimeHealth();
    const isOk = runtime?.status !== "error";

    if (!isOk) {
      return NextResponse.json(
        { status: "error", error: "runtime_unhealthy" },
        { status: 503, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      },
    );
  } catch (error) {
    console.error("[ping] Unexpected error in GET /api/health/ping:", error);
    return NextResponse.json(
      { status: "error", error: "ping_failed" },
      { status: 503, headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  }
}
