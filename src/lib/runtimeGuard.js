import { monitorEventLoopDelay } from "perf_hooks";
import { logger } from "@/lib/logger";

function toPositiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

const CONFIG = {
  sampleIntervalMs: toPositiveNumber(process.env.RUNTIME_MONITOR_SAMPLE_MS, 5000),
  eventLoopLagDegradedMs: toPositiveNumber(process.env.RUNTIME_EVENT_LOOP_LAG_DEGRADED_MS, 400),
  eventLoopLagDegradedSamples: Math.max(1, Math.floor(toPositiveNumber(process.env.RUNTIME_EVENT_LOOP_LAG_DEGRADED_SAMPLES, 2))),
  eventLoopLagHardRejectMs: toPositiveNumber(process.env.RUNTIME_EVENT_LOOP_LAG_HARD_REJECT_MS, 2000),
  heapUsageDegradedRatio: Math.min(
    0.99,
    Math.max(0.5, Number(process.env.RUNTIME_HEAP_DEGRADED_RATIO) || 0.9),
  ),
  maxInFlight: toPositiveNumber(process.env.RUNTIME_MAX_INFLIGHT, 80),
  maxInFlightDegraded: toPositiveNumber(process.env.RUNTIME_MAX_INFLIGHT_DEGRADED, 16),
  overloadQueueWaitMs: toPositiveNumber(process.env.RUNTIME_OVERLOAD_QUEUE_WAIT_MS, 3000),
  timeoutTripThreshold: Math.max(1, Math.floor(toPositiveNumber(process.env.RUNTIME_TIMEOUT_TRIP_THRESHOLD, 2))),
  circuitOpenMs: toPositiveNumber(process.env.RUNTIME_CIRCUIT_OPEN_MS, 15000),
  slowRouteWarnMs: toPositiveNumber(process.env.RUNTIME_SLOW_ROUTE_WARN_MS, 5000),
  slowRouteWarnCooldownMs: toPositiveNumber(process.env.RUNTIME_SLOW_ROUTE_WARN_COOLDOWN_MS, 30000),
};

const runtimeState =
  globalThis.__runtimeGuardState ||
  (globalThis.__runtimeGuardState = {
    initialized: false,
    monitor: null,
    sampler: null,
    lastEventLoopLagMs: 0,
    degradedLagSamples: 0,
    inFlight: 0,
    routes: {},
  });

function getRouteState(routeName) {
  if (!runtimeState.routes[routeName]) {
    runtimeState.routes[routeName] = {
      consecutiveTimeouts: 0,
      totalTimeouts: 0,
      totalSuccess: 0,
      avgLatencyMs: 0,
      lastLatencyMs: 0,
      circuitOpenUntil: 0,
      lastErrorAt: 0,
      lastTimeoutAt: 0,
      lastSlowWarnAt: 0,
    };
  }
  return runtimeState.routes[routeName];
}

function sampleEventLoopLag() {
  if (!runtimeState.monitor) return;
  try {
    const percentile = runtimeState.monitor.percentile(99);
    runtimeState.lastEventLoopLagMs = Number.isFinite(percentile)
      ? Number((percentile / 1_000_000).toFixed(2))
      : 0;
    runtimeState.degradedLagSamples = runtimeState.lastEventLoopLagMs >= CONFIG.eventLoopLagDegradedMs
      ? runtimeState.degradedLagSamples + 1
      : 0;
    runtimeState.monitor.reset();
  } catch {
    runtimeState.lastEventLoopLagMs = 0;
    runtimeState.degradedLagSamples = 0;
  }
}

function ensureRuntimeMonitor() {
  if (runtimeState.initialized) return;
  runtimeState.initialized = true;

  try {
    runtimeState.monitor = monitorEventLoopDelay({ resolution: 20 });
    runtimeState.monitor.enable();

    runtimeState.sampler = setInterval(sampleEventLoopLag, CONFIG.sampleIntervalMs);
    if (runtimeState.sampler.unref) runtimeState.sampler.unref();

    logger.info("RUNTIME_GUARD", "Runtime monitor initialized", {
      sampleIntervalMs: CONFIG.sampleIntervalMs,
      eventLoopLagDegradedMs: CONFIG.eventLoopLagDegradedMs,
      eventLoopLagDegradedSamples: CONFIG.eventLoopLagDegradedSamples,
      eventLoopLagHardRejectMs: CONFIG.eventLoopLagHardRejectMs,
      heapUsageDegradedRatio: CONFIG.heapUsageDegradedRatio,
      maxInFlight: CONFIG.maxInFlight,
      maxInFlightDegraded: CONFIG.maxInFlightDegraded,
    });
  } catch (error) {
    logger.warn("RUNTIME_GUARD", "Event loop monitor unavailable", { message: error?.message });
    runtimeState.monitor = null;
  }
}

function getMemorySnapshot() {
  const mem = process.memoryUsage();
  const heapUsedMb = Number((mem.heapUsed / 1024 / 1024).toFixed(2));
  const heapTotalMb = Number((mem.heapTotal / 1024 / 1024).toFixed(2));
  const rssMb = Number((mem.rss / 1024 / 1024).toFixed(2));
  const heapUsageRatio = mem.heapTotal > 0 ? mem.heapUsed / mem.heapTotal : 0;

  return { heapUsedMb, heapTotalMb, rssMb, heapUsageRatio };
}

function getDegradedReasons() {
  const reasons = [];
  const { heapUsageRatio } = getMemorySnapshot();

  if (runtimeState.degradedLagSamples >= CONFIG.eventLoopLagDegradedSamples) {
    reasons.push(`event_loop_lag_${runtimeState.lastEventLoopLagMs}ms`);
  }
  if (heapUsageRatio >= CONFIG.heapUsageDegradedRatio) {
    reasons.push(`heap_usage_${Math.round(heapUsageRatio * 100)}pct`);
  }

  return reasons;
}

function getSlowRouteReason(durationMs, timeoutMs) {
  const reasons = [];
  if (durationMs >= timeoutMs * 0.8) reasons.push("near_timeout");
  if (runtimeState.inFlight >= CONFIG.maxInFlightDegraded) reasons.push("high_inflight");
  if (runtimeState.lastEventLoopLagMs >= CONFIG.eventLoopLagDegradedMs) reasons.push("event_loop_lag");
  return reasons.length > 0 ? reasons.join(",") : "latency";
}

function isSystemDegraded() {
  return getDegradedReasons().length > 0;
}

function buildJsonResponse(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      ...extraHeaders,
    },
  });
}

function buildOpenAIErrorResponse(status, message, code, extra = {}, extraHeaders = {}) {
  return buildJsonResponse(
    status,
    {
      error: {
        message,
        type: status === 504 ? "timeout_error" : "server_error",
        code,
        ...extra,
      },
    },
    extraHeaders,
  );
}

function createRejectionResponse(routeName, reason, status = 503) {
  const retryAfterSeconds = 2;
  logger.warn("RUNTIME_GUARD", `Rejecting request: ${routeName}`, { reason, inFlight: runtimeState.inFlight });
  return buildJsonResponse(
    status,
    {
      error: "Service temporarily overloaded",
      code: "RUNTIME_GUARD_REJECTED",
      route: routeName,
      reason,
      retryAfterSeconds,
    },
    {
      "Retry-After": String(retryAfterSeconds),
    },
  );
}

function shouldRejectRoute(routeName) {
  const routeState = getRouteState(routeName);
  const now = Date.now();

  if (routeState.circuitOpenUntil > now) {
    return {
      reject: true,
      response: createRejectionResponse(routeName, "circuit_open"),
    };
  }

  const degraded = isSystemDegraded();
  const limit = degraded ? CONFIG.maxInFlightDegraded : CONFIG.maxInFlight;

  if (runtimeState.inFlight >= limit) {
    return {
      reject: true,
      response: createRejectionResponse(routeName, degraded ? "degraded_overload" : "inflight_overload"),
    };
  }

  if (runtimeState.lastEventLoopLagMs >= CONFIG.eventLoopLagHardRejectMs) {
    return {
      reject: true,
      response: createRejectionResponse(routeName, "event_loop_hard_lag"),
    };
  }

  return { reject: false };
}

async function waitForRuntimeSlot(routeName) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < CONFIG.overloadQueueWaitMs) {
    const decision = shouldRejectRoute(routeName);
    if (!decision.reject) return { reject: false };

    if (decision.response && getRouteState(routeName).circuitOpenUntil > Date.now()) {
      return decision;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return shouldRejectRoute(routeName);
}

class RouteTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Route timed out after ${timeoutMs}ms`);
    this.name = "RouteTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

async function runWithTimeout(promise, timeoutMs) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new RouteTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function updateLatency(routeState, durationMs) {
  routeState.lastLatencyMs = durationMs;
  routeState.totalSuccess += 1;

  if (routeState.totalSuccess === 1) {
    routeState.avgLatencyMs = durationMs;
    return;
  }

  const prevAvg = routeState.avgLatencyMs;
  const n = routeState.totalSuccess;
  routeState.avgLatencyMs = Number(((prevAvg * (n - 1) + durationMs) / n).toFixed(2));
}

function handleTimeout(routeName, timeoutMs) {
  const routeState = getRouteState(routeName);
  routeState.consecutiveTimeouts += 1;
  routeState.totalTimeouts += 1;
  routeState.lastTimeoutAt = Date.now();
  routeState.lastErrorAt = Date.now();

  if (routeState.consecutiveTimeouts >= CONFIG.timeoutTripThreshold) {
    routeState.circuitOpenUntil = Date.now() + CONFIG.circuitOpenMs;
    logger.warn("RUNTIME_GUARD", `Circuit opened for ${routeName}`, {
      timeoutMs,
      consecutiveTimeouts: routeState.consecutiveTimeouts,
      openForMs: CONFIG.circuitOpenMs,
    });
  }
}

export function withRouteGuard(routeName, handler, options = {}) {
  const timeoutMs = toPositiveNumber(options.timeoutMs, 120000);

  return async function guardedRoute(...args) {
    ensureRuntimeMonitor();

    const decision = await waitForRuntimeSlot(routeName);
    if (decision.reject) return decision.response;

    runtimeState.inFlight += 1;
    const routeState = getRouteState(routeName);
    const startedAt = Date.now();

    try {
      const response = await runWithTimeout(Promise.resolve(handler(...args)), timeoutMs);
      routeState.consecutiveTimeouts = 0;
      routeState.circuitOpenUntil = 0;
      const durationMs = Date.now() - startedAt;
      updateLatency(routeState, durationMs);
      const shouldLogSlowRoute = durationMs >= CONFIG.slowRouteWarnMs
        && Date.now() - routeState.lastSlowWarnAt >= CONFIG.slowRouteWarnCooldownMs;
      if (shouldLogSlowRoute) {
        routeState.lastSlowWarnAt = Date.now();
        logger.warn("RUNTIME_GUARD", "Slow route detected", {
          route: routeName,
          durationMs,
          timeoutMs,
          inFlight: runtimeState.inFlight,
          eventLoopLagMsP99: runtimeState.lastEventLoopLagMs,
          reason: getSlowRouteReason(durationMs, timeoutMs),
        });
      }
      return response;
    } catch (error) {
      if (error instanceof RouteTimeoutError) {
        handleTimeout(routeName, timeoutMs);
        return buildOpenAIErrorResponse(
          504,
          `Request timed out after ${timeoutMs}ms`,
          "RUNTIME_GUARD_TIMEOUT",
          { route: routeName, timeoutMs },
          { "Retry-After": "2" },
        );
      }

      routeState.lastErrorAt = Date.now();
      throw error;
    } finally {
      runtimeState.inFlight = Math.max(0, runtimeState.inFlight - 1);
    }
  };
}

export function getRuntimeHealth() {
  ensureRuntimeMonitor();
  const degradedReasons = getDegradedReasons();
  const memory = getMemorySnapshot();

  const routeStates = Object.entries(runtimeState.routes).reduce((acc, [route, state]) => {
    acc[route] = {
      consecutiveTimeouts: state.consecutiveTimeouts,
      totalTimeouts: state.totalTimeouts,
      totalSuccess: state.totalSuccess,
      avgLatencyMs: state.avgLatencyMs,
      lastLatencyMs: state.lastLatencyMs,
      circuitOpen: state.circuitOpenUntil > Date.now(),
      circuitOpenUntil: state.circuitOpenUntil || null,
      lastTimeoutAt: state.lastTimeoutAt || null,
      lastErrorAt: state.lastErrorAt || null,
    };
    return acc;
  }, {});

  return {
    status: degradedReasons.length > 0 ? "degraded" : "ok",
    degradedReasons,
    inFlight: runtimeState.inFlight,
    eventLoopLagMsP99: runtimeState.lastEventLoopLagMs,
    memory,
    limits: {
      maxInFlight: CONFIG.maxInFlight,
      maxInFlightDegraded: CONFIG.maxInFlightDegraded,
      timeoutTripThreshold: CONFIG.timeoutTripThreshold,
      circuitOpenMs: CONFIG.circuitOpenMs,
      eventLoopLagDegradedMs: CONFIG.eventLoopLagDegradedMs,
      eventLoopLagHardRejectMs: CONFIG.eventLoopLagHardRejectMs,
      heapUsageDegradedRatio: CONFIG.heapUsageDegradedRatio,
    },
    routes: routeStates,
    timestamp: new Date().toISOString(),
  };
}
