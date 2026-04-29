import { NextResponse } from "next/server";
import { getTunnelStatus, getTailscaleStatus, getTunnelProviderStatuses } from "@/lib/tunnel/tunnelManager";
import { getDownloadStatus } from "@/lib/tunnel/cloudflared";

export async function GET() {
  try {
    const [tunnel, tailscale, providers] = await Promise.all([getTunnelStatus(), getTailscaleStatus(), getTunnelProviderStatuses()]);
    const download = getDownloadStatus();
    return NextResponse.json({ tunnel, tailscale, providers, download });
  } catch (error) {
    console.error("Tunnel status error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
