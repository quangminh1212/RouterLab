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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}