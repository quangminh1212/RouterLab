import { NextResponse } from "next/server";
import { getApiKeys, getSettings } from "@/lib/localDb";
import { getTunnelStatus, getTailscaleStatus } from "@/lib/tunnel/tunnelManager";
import { getDownloadStatus } from "@/lib/tunnel/cloudflared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [keys, settings, tunnel, tailscale] = await Promise.all([
      getApiKeys(),
      getSettings(),
      getTunnelStatus(),
      getTailscaleStatus(),
    ]);

    return NextResponse.json({
      keys,
      settings: {
        requireApiKey: settings.requireApiKey || false,
        requireLogin: settings.requireLogin !== false,
        hasPassword: !!settings.password,
        tunnelDashboardAccess: settings.tunnelDashboardAccess || false,
      },
      tunnel: {
        tunnel,
        tailscale,
        download: getDownloadStatus(),
      },
    });
  } catch (error) {
    console.log("Error getting dashboard bootstrap:", error);
    return NextResponse.json({ error: "Failed to load dashboard bootstrap" }, { status: 500 });
  }
}
