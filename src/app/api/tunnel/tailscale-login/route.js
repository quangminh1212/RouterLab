import { NextResponse } from "next/server";
import { getTailscaleAuthUrl, triggerTailscaleSystemLogin } from "@/lib/tunnel/tailscale";

export async function POST() {
  try {
    const immediateUrl = getTailscaleAuthUrl();
    if (immediateUrl) {
      return NextResponse.json({ success: false, needsLogin: true, authUrl: immediateUrl });
    }

    // Trigger native/system login flow first so user sees login immediately.
    triggerTailscaleSystemLogin();
    // Return immediately to avoid UI hang; client will poll login status.
    return NextResponse.json({ success: false, needsLogin: true });
  } catch (error) {
    console.error("Tailscale login error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
