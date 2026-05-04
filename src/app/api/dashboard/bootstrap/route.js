import { NextResponse } from "next/server";
import { getApiKeys, getSettings } from "@/lib/localDb";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function timedStep(name, fn) {
  const start = Date.now();
  const result = await fn();
  return { name, durationMs: Date.now() - start, result };
}

export async function GET(request) {
  const traceId = request.headers.get("x-debug-trace-id") || logger.dashboardPerf.traceId("dashboard-bootstrap");
  const start = Date.now();

  logger.dashboardPerf.debug("DASHBOARD_API", "bootstrap:start", { traceId }, { verbose: true });

  try {
    const [keysStep, settingsStep] = await Promise.all([
      timedStep("keys", () => getApiKeys()),
      timedStep("settings", () => getSettings()),
    ]);

    const settings = settingsStep.result;

    const durationMs = Date.now() - start;
    const keys = keysStep.result;

    logger.dashboardPerf.info("DASHBOARD_API", "bootstrap:done", {
      traceId,
      durationMs,
      keysCount: Array.isArray(keys) ? keys.length : 0,
      steps: {
        keysMs: keysStep.durationMs,
        settingsMs: settingsStep.durationMs,
      },
    });

    return NextResponse.json({
      keys,
      settings: {
        requireApiKey: settings.requireApiKey || false,
        requireLogin: settings.requireLogin !== false,
        hasPassword: false,
        tunnelDashboardAccess: settings.tunnelDashboardAccess || false,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    logger.dashboardPerf.error("DASHBOARD_API", "bootstrap:error", {
      traceId,
      durationMs: Date.now() - start,
      error: error.message,
    }, { force: true });
    return NextResponse.json({ error: "Failed to load dashboard bootstrap" }, { status: 500 });
  }
}
