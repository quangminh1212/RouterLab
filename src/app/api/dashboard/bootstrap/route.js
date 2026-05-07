import { NextResponse } from "next/server";
import { getApiKeys, getSettings } from "@/lib/localDb";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const BOOTSTRAP_CACHE_TTL_MS = 3000;
let bootstrapCache = { ts: 0, data: null, promise: null };

async function timedStep(name, fn) {
  const start = Date.now();
  const result = await fn();
  return { name, durationMs: Date.now() - start, result };
}

export async function GET(request) {
  const traceId = request.headers.get("x-debug-trace-id") || logger.dashboardPerf.traceId("dashboard-bootstrap");
  const start = Date.now();
  const now = Date.now();

  logger.dashboardPerf.debug("DASHBOARD_API", "bootstrap:start", { traceId }, { verbose: true });

  if (bootstrapCache.data && now - bootstrapCache.ts < BOOTSTRAP_CACHE_TTL_MS) {
    return NextResponse.json(bootstrapCache.data, {
      headers: {
        "Cache-Control": "private, max-age=2, stale-while-revalidate=4",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  }

  if (bootstrapCache.promise) {
    try {
      const payload = await bootstrapCache.promise;
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "private, max-age=2, stale-while-revalidate=4",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    } catch {}
  }

  bootstrapCache.promise = (async () => {
    const [keysStep, settingsStep] = await Promise.all([
      timedStep("keys", () => getApiKeys()),
      timedStep("settings", () => getSettings()),
    ]);

    const settings = settingsStep.result;
    const keys = keysStep.result;

    const payload = {
      keys,
      settings: {
        requireApiKey: settings.requireApiKey || false,
        requireLogin: settings.requireLogin !== false,
        hasPassword: false,
        tunnelDashboardAccess: settings.tunnelDashboardAccess || false,
      },
    };

    logger.dashboardPerf.info("DASHBOARD_API", "bootstrap:done", {
      traceId,
      durationMs: Date.now() - start,
      keysCount: Array.isArray(keys) ? keys.length : 0,
      steps: {
        keysMs: keysStep.durationMs,
        settingsMs: settingsStep.durationMs,
      },
      cacheHit: false,
    });

    bootstrapCache = { ts: Date.now(), data: payload, promise: null };
    return payload;
  })();

  try {
    const payload = await bootstrapCache.promise;
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=2, stale-while-revalidate=4",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    bootstrapCache.promise = null;
    logger.dashboardPerf.error("DASHBOARD_API", "bootstrap:error", {
      traceId,
      durationMs: Date.now() - start,
      error: error.message,
    }, { force: true });
    return NextResponse.json({ error: "Failed to load dashboard bootstrap" }, { status: 500 });
  }
}
