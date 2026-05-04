import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { enableTailscale } = await import("@/lib/tunnel/tunnelManager");
    const result = await enableTailscale();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tailscale enable error:", error);
    const status = error.code === "TUNNEL_LEASE_CONFLICT" ? 409 : /Local origin is not ready/i.test(error.message || "") ? 503 : 500;
    return NextResponse.json({ error: error.message, code: error.code, lease: error.lease }, { status });
  }
}
