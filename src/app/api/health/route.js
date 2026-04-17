import { NextResponse } from "next/server";
import { getRuntimeHealth } from "@/lib/runtimeGuard";

function shouldReturnVerbose(request) {
  const envEnabled = String(process.env.HEALTH_VERBOSE || "").toLowerCase() === "true";
  if (!envEnabled) return false;

  const url = new URL(request.url);
  const verbose = String(url.searchParams.get("verbose") || "").toLowerCase();
  return verbose === "1" || verbose === "true";
}

export async function GET(request) {
  const runtime = getRuntimeHealth();

  const basePayload = {
    ok: true,
    status: runtime.status,
    degraded: runtime.status === "degraded",
    timestamp: runtime.timestamp,
  };

  if (shouldReturnVerbose(request)) {
    return NextResponse.json({
      ...basePayload,
      runtime,
    });
  }

  return NextResponse.json(basePayload);
}
