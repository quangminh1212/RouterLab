import { NextResponse } from "next/server";

const DNS_WARMUP_DELAY_MS = 8000;

export async function POST(request) {
  try {
    const { enableTunnel } = await import("@/lib/tunnel/tunnelManager");
    const body = await request.json().catch(() => ({}));
    const provider = body.provider || "cloudflare";
    const result = await enableTunnel(1212, provider);
    
    if (provider === "cloudflare") {
      await new Promise((r) => setTimeout(r, DNS_WARMUP_DELAY_MS));
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tunnel enable error:", error);
    const status = error.code === "TUNNEL_LEASE_CONFLICT" ? 409 : /Local origin is not ready/i.test(error.message || "") ? 503 : 500;
    return NextResponse.json({ error: error.message, code: error.code, lease: error.lease }, { status });
  }
}
