import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { disableTailscale } = await import("@/lib/tunnel/tunnelManager");
    const result = await disableTailscale();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tailscale disable error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}