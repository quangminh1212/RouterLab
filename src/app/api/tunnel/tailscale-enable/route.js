import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { enableTailscale } = await import("@/lib/tunnel/tunnelManager");
    const result = await enableTailscale();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tailscale enable error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}