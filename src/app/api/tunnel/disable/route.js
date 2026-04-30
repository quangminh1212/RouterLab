import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { disableTunnel } = await import("@/lib/tunnel/tunnelManager");
    const result = await disableTunnel();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Tunnel disable error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
