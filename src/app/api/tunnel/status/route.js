import { NextResponse } from "next/server";

const CACHE_TTL_MS = 2000;
let statusCache = { ts: 0, data: null, promise: null };

export async function GET() {
  const now = Date.now();
  if (statusCache.data && now - statusCache.ts < CACHE_TTL_MS) {
    return NextResponse.json(statusCache.data, { headers: { "Cache-Control": "private, max-age=1, stale-while-revalidate=2" } });
  }
  if (statusCache.promise) {
    try { return NextResponse.json(await statusCache.promise, { headers: { "Cache-Control": "private, max-age=1, stale-while-revalidate=2" } }); } catch {}
  }
  statusCache.promise = (async () => {
    try {
      const [{ getTunnelStatus, getTailscaleStatus, getTunnelProviderStatuses }, { getDownloadStatus }] = await Promise.all([
        import("@/lib/tunnel/tunnelManager"),
        import("@/lib/tunnel/cloudflared"),
      ]);
      const [tunnel, tailscale, providers] = await Promise.all([getTunnelStatus(), getTailscaleStatus(), getTunnelProviderStatuses()]);
      const download = getDownloadStatus();
      const data = { tunnel, tailscale, providers, download };
      statusCache = { ts: Date.now(), data, promise: null };
      return data;
    } catch (error) {
      statusCache.promise = null;
      throw error;
    }
  })();
  try {
    const data = await statusCache.promise;
    return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=1, stale-while-revalidate=2" } });
  } catch (error) {
    console.error("Tunnel status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}