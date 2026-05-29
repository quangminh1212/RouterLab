import { NextResponse } from "next/server";
import { getRuntimeHealth } from "@/lib/runtimeGuard";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = getRuntimeHealth();

  return NextResponse.json({
    ok: true,
    status: runtime.status,
    degraded: runtime.status === "degraded",
    timestamp: runtime.timestamp,
    route: "/health",
  });
}
