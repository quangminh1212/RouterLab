import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [{ getTunnelStatus, getTailscaleStatus, getTunnelProviderStatuses }, { getDownloadStatus }] = await Promise.all([
      import("@/lib/tunnel/tunnelManager"),
      import("@/lib/tunnel/cloudflared"),
    ]);
    const [tunnel, tailscale, providers] = await Promise.all([getTunnelStatus(), getTailscaleStatus(), getTunnelProviderStatuses()]);
    const download = getDownloadStatus();
    return NextResponse.json({ tunnel, tailscale, providers, download });
  } catch (error) {
    console.error("Tunnel status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}