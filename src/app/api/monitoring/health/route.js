import { NextResponse } from "next/server";
import { getProviderConnections, getSettings } from "@/lib/localDb";
import { APP_CONFIG } from "@/shared/constants/config";

const MODEL_LOCK_PREFIX = "modelLock_";

function getConnectionLabel(connection) {
  return connection.name || connection.displayName || connection.email || connection.id;
}

function getActiveLocks(connection, now = Date.now()) {
  return Object.entries(connection)
    .filter(([key, value]) => key.startsWith(MODEL_LOCK_PREFIX) && value)
    .map(([key, value]) => ({
      key,
      model: key.slice(MODEL_LOCK_PREFIX.length) || "__all",
      until: value,
      untilMs: new Date(value).getTime(),
    }))
    .filter((lock) => Number.isFinite(lock.untilMs) && lock.untilMs > now)
    .sort((left, right) => left.untilMs - right.untilMs);
}

function summarizeProvider(provider, connections, now = Date.now()) {
  const summary = {
    provider,
    status: "healthy",
    totalConnections: connections.length,
    activeConnections: 0,
    cooldownConnections: 0,
    unavailableConnections: 0,
    inactiveConnections: 0,
    activeModelLocks: 0,
    earliestRetryAfter: null,
    lastErrors: [],
    connections: [],
  };

  for (const connection of connections) {
    const activeLocks = getActiveLocks(connection, now);
    const isInactive = connection.isActive === false;
    const isCooldown = activeLocks.length > 0;
    const isUnavailable = connection.testStatus === "unavailable" && !isCooldown;

    if (isInactive) summary.inactiveConnections += 1;
    else if (isCooldown) summary.cooldownConnections += 1;
    else if (isUnavailable) summary.unavailableConnections += 1;
    else summary.activeConnections += 1;

    summary.activeModelLocks += activeLocks.length;

    const earliestConnectionRetry = activeLocks[0]?.until || null;
    if (earliestConnectionRetry && (!summary.earliestRetryAfter || earliestConnectionRetry < summary.earliestRetryAfter)) {
      summary.earliestRetryAfter = earliestConnectionRetry;
    }

    if (connection.lastError) {
      summary.lastErrors.push({
        connectionId: connection.id,
        connectionName: getConnectionLabel(connection),
        errorCode: connection.errorCode || null,
        lastError: connection.lastError,
        lastErrorAt: connection.lastErrorAt || null,
      });
    }

    summary.connections.push({
      id: connection.id,
      name: getConnectionLabel(connection),
      isActive: connection.isActive !== false,
      status: isInactive ? "inactive" : (isCooldown ? "cooldown" : (isUnavailable ? "unavailable" : "active")),
      modelLocks: activeLocks.map((lock) => ({ model: lock.model, until: lock.until })),
      lastError: connection.lastError || null,
      lastErrorAt: connection.lastErrorAt || null,
      errorCode: connection.errorCode || null,
      backoffLevel: connection.backoffLevel || 0,
    });
  }

  if (summary.unavailableConnections > 0 && summary.activeConnections === 0 && summary.cooldownConnections === 0) {
    summary.status = "unavailable";
  } else if (summary.cooldownConnections > 0 || summary.unavailableConnections > 0) {
    summary.status = "degraded";
  }

  summary.lastErrors = summary.lastErrors
    .sort((left, right) => String(right.lastErrorAt || "").localeCompare(String(left.lastErrorAt || "")))
    .slice(0, 5);

  return summary;
}

export async function GET() {
  try {
    const [settings, connections] = await Promise.all([
      getSettings(),
      getProviderConnections(),
    ]);

    const grouped = connections.reduce((acc, connection) => {
      const provider = connection.provider || "unknown";
      if (!acc.has(provider)) acc.set(provider, []);
      acc.get(provider).push(connection);
      return acc;
    }, new Map());

    const providers = Array.from(grouped.entries())
      .map(([provider, providerConnections]) => summarizeProvider(provider, providerConnections))
      .sort((left, right) => left.provider.localeCompare(right.provider));

    const totals = providers.reduce((acc, provider) => {
      acc.providers += 1;
      acc.connections += provider.totalConnections;
      acc.activeConnections += provider.activeConnections;
      acc.cooldownConnections += provider.cooldownConnections;
      acc.unavailableConnections += provider.unavailableConnections;
      acc.inactiveConnections += provider.inactiveConnections;
      acc.activeModelLocks += provider.activeModelLocks;
      return acc;
    }, {
      providers: 0,
      connections: 0,
      activeConnections: 0,
      cooldownConnections: 0,
      unavailableConnections: 0,
      inactiveConnections: 0,
      activeModelLocks: 0,
    });

    const overallStatus =
      totals.unavailableConnections > 0 && totals.activeConnections === 0 && totals.cooldownConnections === 0
        ? "unavailable"
        : (totals.cooldownConnections > 0 || totals.unavailableConnections > 0 ? "degraded" : "healthy");

    return NextResponse.json({
      status: overallStatus,
      app: {
        name: APP_CONFIG.name,
        version: APP_CONFIG.version,
      },
      settings: {
        requireApiKey: settings.requireApiKey || false,
        requireLogin: settings.requireLogin !== false,
        fallbackStrategy: settings.fallbackStrategy || "fill-first",
        observabilityEnabled: settings.observabilityEnabled !== false,
      },
      totals,
      providers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to build monitoring health payload:", error);
    return NextResponse.json(
      { status: "error", error: "Failed to build monitoring health payload" },
      { status: 500 },
    );
  }
}
