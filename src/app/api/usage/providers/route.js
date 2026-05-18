import { NextResponse } from "next/server";
import { getRequestDetails } from "@/lib/requestDetailsDb";
import { getProviderNodes } from "@/lib/localDb";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";
import { logger } from "@/lib/logger";

const CACHE_TTL_MS = 30000;
let providersCache = { ts: 0, data: null, promise: null };

/**
 * GET /api/usage/providers
 * Returns list of unique providers from request details
 */
export async function GET(request) {
  const traceId = request.headers.get("x-debug-trace-id") || logger.dashboardPerf.traceId("usage-providers");
  const start = Date.now();
  const now = Date.now();

  if (providersCache.data && now - providersCache.ts < CACHE_TTL_MS) {
    return NextResponse.json(
      { providers: providersCache.data },
      { headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=5" } }
    );
  }

  if (providersCache.promise) {
    try {
      const providers = await providersCache.promise;
      return NextResponse.json(
        { providers },
        { headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=5" } }
      );
    } catch {}
  }

  providersCache.promise = (async () => {
    const detailsStart = Date.now();
    const { details } = await getRequestDetails({ pageSize: 2000 });
    const detailsDurationMs = Date.now() - detailsStart;

    const providerIds = [...new Set(details.map((r) => r.provider).filter(Boolean))].sort();

    const nodesStart = Date.now();
    const providerNodes = await getProviderNodes();
    const nodesDurationMs = Date.now() - nodesStart;
    const nodeMap = {};
    for (const node of providerNodes) {
      nodeMap[node.id] = node.name;
    }

    const providers = providerIds.map((providerId) => {
      let name = providerId;
      if (nodeMap[providerId]) {
        name = nodeMap[providerId];
      } else {
        const providerConfig = getProviderByAlias(providerId) || AI_PROVIDERS[providerId];
        if (providerConfig?.name) name = providerConfig.name;
      }
      return { id: providerId, name };
    });

    logger.dashboardPerf.info("DASHBOARD_API", "usageProviders:done", {
      traceId,
      durationMs: Date.now() - start,
      detailsDurationMs,
      nodesDurationMs,
      detailsCount: Array.isArray(details) ? details.length : 0,
      providersCount: providers.length,
      cacheHit: false,
    });

    providersCache = { ts: Date.now(), data: providers, promise: null };
    return providers;
  })();

  try {
    const providers = await providersCache.promise;
    return NextResponse.json(
      { providers },
      { headers: { "Cache-Control": "private, max-age=3, stale-while-revalidate=5" } }
    );
  } catch (error) {
    providersCache.promise = null;
    logger.dashboardPerf.error("DASHBOARD_API", "usageProviders:error", {
      traceId,
      durationMs: Date.now() - start,
      error: error.message,
    }, { force: true });
    return NextResponse.json(
      { error: "Failed to fetch providers" },
      { status: 500 }
    );
  }
}
