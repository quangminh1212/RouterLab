// Ensure proxyFetch is loaded to patch globalThis.fetch
import "open-sse/index.js";

import { getProviderConnectionById, updateProviderConnection } from "@/lib/localDb";
import { getUsageForProvider } from "open-sse/services/usage.js";
import { getExecutor } from "open-sse/executors/index.js";
import { logger } from "@/lib/logger";

// Detect auth-expired messages returned by usage providers instead of throwing
const AUTH_EXPIRED_PATTERNS = [
  "expired",
  "authentication",
  "unauthorized",
  "401",
  "re-authorize",
  "rejected the current token",
  "authentication expired",
];
function isAuthExpiredMessage(usage) {
  if (!usage?.message) return false;
  const msg = usage.message.toLowerCase();
  return AUTH_EXPIRED_PATTERNS.some((p) => msg.includes(p));
}

/**
 * Refresh credentials using executor and update database
 * @param {boolean} force - Skip needsRefresh check and always attempt refresh
 * @returns Promise<{ connection, refreshed: boolean }>
 */
async function refreshAndUpdateCredentials(connection, force = false, traceId = null) {
  const start = Date.now();
  const executor = getExecutor(connection.provider);

  // Build credentials object from connection
  const credentials = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt || connection.tokenExpiresAt,
    providerSpecificData: connection.providerSpecificData,
    // For GitHub
    copilotToken: connection.providerSpecificData?.copilotToken,
    copilotTokenExpiresAt: connection.providerSpecificData?.copilotTokenExpiresAt,
  };

  // Check if refresh is needed (skip when force=true)
  const needsRefresh = force || executor.needsRefresh(credentials);

  if (!needsRefresh) {
    logger.dashboardPerf.debug("DASHBOARD_API", "usageConnection:refresh:skip", {
      traceId,
      provider: connection.provider,
      durationMs: Date.now() - start,
      force,
    }, { verbose: true });
    return { connection, refreshed: false };
  }

  logger.dashboardPerf.debug("DASHBOARD_API", "usageConnection:refresh:start", {
    traceId,
    provider: connection.provider,
    force,
  }, { verbose: true });

  // Use executor's refreshCredentials method
  const refreshResult = await executor.refreshCredentials(credentials, console);

  if (!refreshResult) {
    // Refresh failed but we still have an accessToken — try with existing token
    if (connection.accessToken) {
      logger.dashboardPerf.warn("DASHBOARD_API", "usageConnection:refresh:fallback", {
        traceId,
        provider: connection.provider,
        durationMs: Date.now() - start,
      });
      return { connection, refreshed: false };
    }
    throw new Error("Failed to refresh credentials. Please re-authorize the connection.");
  }

  // Build update object
  const now = new Date().toISOString();
  const updateData = {
    updatedAt: now,
  };

  // Update accessToken if present
  if (refreshResult.accessToken) {
    updateData.accessToken = refreshResult.accessToken;
  }

  // Update refreshToken if present
  if (refreshResult.refreshToken) {
    updateData.refreshToken = refreshResult.refreshToken;
  }

  // Update token expiry
  if (refreshResult.expiresIn) {
    updateData.expiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString();
  } else if (refreshResult.expiresAt) {
    updateData.expiresAt = refreshResult.expiresAt;
  }

  // Handle provider-specific data (copilotToken for GitHub, etc.)
  if (refreshResult.copilotToken || refreshResult.copilotTokenExpiresAt) {
    updateData.providerSpecificData = {
      ...connection.providerSpecificData,
      copilotToken: refreshResult.copilotToken,
      copilotTokenExpiresAt: refreshResult.copilotTokenExpiresAt,
    };
  }

  // Update database
  await updateProviderConnection(connection.id, updateData);

  logger.dashboardPerf.info("DASHBOARD_API", "usageConnection:refresh:done", {
    traceId,
    provider: connection.provider,
    durationMs: Date.now() - start,
    force,
  });

  // Return updated connection
  const updatedConnection = {
    ...connection,
    ...updateData,
  };

  return {
    connection: updatedConnection,
    refreshed: true,
  };
}

/**
 * GET /api/usage/[connectionId] - Get usage data for a specific connection
 */
export async function GET(request, { params }) {
  const traceId = request.headers.get("x-debug-trace-id") || logger.dashboardPerf.traceId("usage-connection");
  const start = Date.now();
  let connection;
  try {
    const { connectionId } = await params;

    // Get connection from database
    connection = await getProviderConnectionById(connectionId);
    if (!connection) {
      logger.dashboardPerf.warn("DASHBOARD_API", "usageConnection:notFound", {
        traceId,
        durationMs: Date.now() - start,
      });
      return Response.json({ error: "Connection not found" }, { status: 404 });
    }

    // Only OAuth connections have usage APIs
    if (connection.authType !== "oauth") {
      logger.dashboardPerf.debug("DASHBOARD_API", "usageConnection:skipNonOauth", {
        traceId,
        provider: connection.provider,
        durationMs: Date.now() - start,
      }, { verbose: true });
      return Response.json({ message: "Usage not available for API key connections" });
    }

    // Refresh credentials if needed using executor
    try {
      const result = await refreshAndUpdateCredentials(connection, false, traceId);
      connection = result.connection;
    } catch (refreshError) {
      logger.dashboardPerf.error("DASHBOARD_API", "usageConnection:refresh:error", {
        traceId,
        provider: connection.provider,
        durationMs: Date.now() - start,
        error: refreshError.message,
      }, { force: true });
      return Response.json({
        error: `Credential refresh failed: ${refreshError.message}`
      }, { status: 401 });
    }

    // Fetch usage from provider API
    const usageStart = Date.now();
    let usage = await getUsageForProvider(connection);
    let retried = false;

    // If provider returned an auth-expired message instead of throwing,
    // force-refresh token and retry once
    if (isAuthExpiredMessage(usage) && connection.refreshToken) {
      retried = true;
      try {
        const retryResult = await refreshAndUpdateCredentials(connection, true, traceId);
        connection = retryResult.connection;
        usage = await getUsageForProvider(connection);
      } catch (retryError) {
        logger.dashboardPerf.warn("DASHBOARD_API", "usageConnection:retryRefresh:error", {
          traceId,
          provider: connection.provider,
          durationMs: Date.now() - start,
          error: retryError.message,
        });
      }
    }

    logger.dashboardPerf.info("DASHBOARD_API", "usageConnection:done", {
      traceId,
      provider: connection.provider,
      durationMs: Date.now() - start,
      usageFetchDurationMs: Date.now() - usageStart,
      retried,
      hasMessage: Boolean(usage?.message),
    });

    return Response.json(usage);
  } catch (error) {
    const provider = connection?.provider ?? "unknown";
    logger.dashboardPerf.error("DASHBOARD_API", "usageConnection:error", {
      traceId,
      provider,
      durationMs: Date.now() - start,
      error: error.message,
    }, { force: true });
    return Response.json({ error: error.message }, { status: 500 });
  }
}
