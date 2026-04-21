import { NextResponse } from "next/server";
import { getRequestDetails } from "@/lib/requestDetailsDb";
import { getProviderNodes } from "@/lib/localDb";
import { AI_PROVIDERS, getProviderByAlias } from "@/shared/constants/providers";
import { logger } from "@/lib/logger";

/**
 * GET /api/usage/providers
 * Returns list of unique providers from request details
 */
export async function GET(request) {
  const traceId = request.headers.get("x-debug-trace-id") || logger.dashboardPerf.traceId("usage-providers");
  const start = Date.now();

  try {
    const detailsStart = Date.now();
    const { details } = await getRequestDetails({ pageSize: 9999 });
    const detailsDurationMs = Date.now() - detailsStart;

    // Extract unique providers
    const providerIds = [...new Set(details.map(r => r.provider).filter(Boolean))].sort();

    const nodesStart = Date.now();
    const providerNodes = await getProviderNodes();
    const nodesDurationMs = Date.now() - nodesStart;
    const nodeMap = {};
    for (const node of providerNodes) {
      nodeMap[node.id] = node.name;
    }

    const providers = providerIds.map(providerId => {
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
    });

    return NextResponse.json({ providers });
  } catch (error) {
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
