import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { switchCloudflareToThisMachine } = await import("@/lib/tunnel/tunnelManager");
    const result = await switchCloudflareToThisMachine(1212);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Cloudflare switch-host error:", error);
    return NextResponse.json({ error: error.message || "Failed to switch Cloudflare host" }, { status: 500 });
  }
}
