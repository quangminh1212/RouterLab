import { NextResponse } from "next/server";
import { getProviderConnections, getSettings } from "@/lib/localDb";
import { getRuntimeHealth } from "@/lib/runtimeGuard";
import { APP_CONFIG } from "@/shared/constants/config";
import { getComboPerformanceSnapshot } from "open-sse/services/combo.js";

function normalizeHost(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "::1" || raw === "[::1]") return "::1";
  if (raw.startsWith("[::1]:")) return "::1";
  return raw.split(":")[0];
}

function isLocalRequest(request) {
  return [
    request.nextUrl?.hostname,
    request.headers.get("host"),
  ].some((value) => {
    const host = normalizeHost(value);
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  });
}

function deny() {
  return NextResponse.json({ error: "Management API is restricted to localhost" }, { status: 403 });
}

function sanitizeMappings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [key, target] of Object.entries(value)) {
    const source = String(key || "").trim();
    const mapped = typeof target === "string" ? target.trim() : "";
    if (!source || !mapped || !mapped.includes("/")) continue;
    out[source] = mapped;
  }
  return out;
}

function summarizeConnections(connections = []) {
  const totals = {
    total: 0,
    active: 0,
    inactive: 0,
    unavailable: 0,
  };

  const byProvider = connections.reduce((map, connection) => {
    const provider = connection.provider || "unknown";
    const bucket = map.get(provider) || { provider, total: 0, active: 0, inactive: 0, unavailable: 0 };
    bucket.total += 1;
    totals.total += 1;

    if (connection.isActive === false) {
      bucket.inactive += 1;
      totals.inactive += 1;
    } else if (connection.testStatus === "unavailable") {
      bucket.unavailable += 1;
      totals.unavailable += 1;
    } else {
      bucket.active += 1;
      totals.active += 1;
    }

    map.set(provider, bucket);
    return map;
  }, new Map());

  return {
    totals,
    providers: Array.from(byProvider.values()).sort((left, right) => left.provider.localeCompare(right.provider)),
  };
}

export async function GET(request) {
  if (!isLocalRequest(request)) return deny();

  const [settings, connections] = await Promise.all([
    getSettings(),
    getProviderConnections(),
  ]);

  const runtime = getRuntimeHealth();
  const comboPerformance = getComboPerformanceSnapshot();
  const summary = summarizeConnections(connections);
  const mappings = sanitizeMappings(settings.forcedModelMappings);

  return NextResponse.json({
    app: {
      name: APP_CONFIG.name,
      version: APP_CONFIG.version,
    },
    runtime: {
      status: runtime.status,
      degraded: runtime.status === "degraded",
      timestamp: runtime.timestamp,
    },
    auth: {
      requireApiKey: settings.requireApiKey || false,
      requireLogin: settings.requireLogin !== false,
    },
    routing: {
      fallbackStrategy: settings.fallbackStrategy || "fill-first",
      comboStrategy: settings.comboStrategy || "fallback",
      stickyRoundRobinLimit: settings.stickyRoundRobinLimit || 0,
      forceModelMappings: settings.forceModelMappings === true,
      forcedModelMappingsCount: Object.keys(mappings).length,
      comboPerformance,
    },
    observability: {
      enabled: settings.observabilityEnabled !== false,
      maxRecords: settings.observabilityMaxRecords || 0,
    },
    connections: summary,
    modelMappings: {
      forceEnabled: settings.forceModelMappings === true,
      mappings,
    },
    generatedAt: new Date().toISOString(),
  });
}
