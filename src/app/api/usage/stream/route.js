import { getUsageStats, statsEmitter, getActiveRequests } from "@/lib/usageDb";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const SUPPORT_REFRESH_PAYLOAD = { support_refresh: true };
const REFRESH_PAYLOAD = { refresh: true };

function enqueueJson(controller, encoder, payload) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

export async function GET(request) {
  const encoder = new TextEncoder();
  const traceId = request.headers.get("x-debug-trace-id") || logger.dashboardPerf.traceId("usage-stream");
  const state = {
    closed: false,
    keepalive: null,
    send: null,
    sendUpdate: null,
    sendPending: null,
    cachedStats: null,
    updateCount: 0,
    pendingCount: 0,
  };

  logger.dashboardPerf.debug("USAGE_STREAM", "stream:open", { traceId }, { verbose: true });

  const stream = new ReadableStream({
    async start(controller) {
      // Full stats refresh (heavy) + immediate lightweight push
      state.send = async () => {
        if (state.closed) return;
        const start = Date.now();
        state.updateCount += 1;
        try {
          let quickDurationMs = 0;
          if (state.cachedStats) {
            const quickStart = Date.now();
            const { activeRequests, recentRequests, errorProvider } = await getActiveRequests();
            quickDurationMs = Date.now() - quickStart;
            const quickStats = { ...state.cachedStats, activeRequests, recentRequests, errorProvider };
            enqueueJson(controller, encoder, quickStats);
          }

          const statsStart = Date.now();
          const stats = await getUsageStats();
          const statsDurationMs = Date.now() - statsStart;
          state.cachedStats = stats;
          enqueueJson(controller, encoder, stats);

          logger.dashboardPerf.info("USAGE_STREAM", "stream:send", {
            traceId,
            durationMs: Date.now() - start,
            quickDurationMs,
            statsDurationMs,
            updateCount: state.updateCount,
          });
        } catch (error) {
          logger.dashboardPerf.error("USAGE_STREAM", "stream:send:error", {
            traceId,
            durationMs: Date.now() - start,
            error: error.message,
          }, { force: true });
          state.closed = true;
          statsEmitter.off("update", state.sendUpdate);
          statsEmitter.off("pending", state.sendPending);
          clearInterval(state.keepalive);
        }
      };

      // Lightweight push: only refresh activeRequests + recentRequests on pending changes
      state.sendPending = async () => {
        if (state.closed || !state.cachedStats) return;
        const start = Date.now();
        state.pendingCount += 1;
        try {
          const { activeRequests, recentRequests, errorProvider } = await getActiveRequests();
          const stats = { ...state.cachedStats, activeRequests, recentRequests, errorProvider };
          enqueueJson(controller, encoder, stats);

          logger.dashboardPerf.debug("USAGE_STREAM", "stream:pending", {
            traceId,
            durationMs: Date.now() - start,
            pendingCount: state.pendingCount,
            activeRequests: Array.isArray(activeRequests) ? activeRequests.length : 0,
          }, { verbose: true });
        } catch (error) {
          logger.dashboardPerf.error("USAGE_STREAM", "stream:pending:error", {
            traceId,
            durationMs: Date.now() - start,
            error: error.message,
          }, { force: true });
          state.closed = true;
          statsEmitter.off("update", state.sendUpdate);
          statsEmitter.off("pending", state.sendPending);
          clearInterval(state.keepalive);
        }
      };

      state.sendUpdate = () => {
        if (!state.closed) enqueueJson(controller, encoder, REFRESH_PAYLOAD);
        state.send();
      };

      enqueueJson(controller, encoder, SUPPORT_REFRESH_PAYLOAD);
      await state.send();

      statsEmitter.on("update", state.sendUpdate);
      statsEmitter.on("pending", state.sendPending);

      state.keepalive = setInterval(() => {
        if (state.closed) {
          clearInterval(state.keepalive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          state.closed = true;
          clearInterval(state.keepalive);
        }
      }, 25000);
    },

    cancel() {
      logger.dashboardPerf.debug("USAGE_STREAM", "stream:close", {
        traceId,
        updateCount: state.updateCount,
        pendingCount: state.pendingCount,
      }, { verbose: true });
      state.closed = true;
      statsEmitter.off("update", state.sendUpdate);
      statsEmitter.off("pending", state.sendPending);
      clearInterval(state.keepalive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
