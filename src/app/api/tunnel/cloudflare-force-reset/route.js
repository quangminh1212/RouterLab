import { NextResponse } from "next/server";

const DNS_WARMUP_DELAY_MS = 8000;

export async function POST() {
  try {
    const { forceResetCloudflareTunnel } = await import("@/lib/tunnel/tunnelManager");
    const result = await forceResetCloudflareTunnel(1212);
    await new Promise((resolve) => setTimeout(resolve, DNS_WARMUP_DELAY_MS));
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cloudflare force reset error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
