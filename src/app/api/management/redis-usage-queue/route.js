import { NextResponse } from "next/server";

/**
 * GET /api/management/redis-usage-queue
 * Status of optional CLIProxyAPI-parity RESP usage queue.
 */
export async function GET() {
  try {
    const { getRedisUsageQueueStatus, startRedisUsageQueue } = await import(
      "open-sse/services/redisUsageQueue.js"
    );
    // Allow enabling via query ?start=1&port=6379 when env not set
    // (dev convenience only; production should use env)
    return NextResponse.json({
      ok: true,
      status: getRedisUsageQueueStatus(),
      hint: "Set REDIS_USAGE_QUEUE_PORT=6379 and restart to enable. SUBSCRIBE usage | error via redis-cli.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const port = Number(body?.port || process.env.REDIS_USAGE_QUEUE_PORT || 6379);
    const { startRedisUsageQueue, getRedisUsageQueueStatus } = await import(
      "open-sse/services/redisUsageQueue.js"
    );
    await startRedisUsageQueue(port);
    return NextResponse.json({ ok: true, status: getRedisUsageQueueStatus() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error?.message || String(error) },
      { status: 500 },
    );
  }
}
