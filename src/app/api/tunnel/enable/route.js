import { NextResponse } from "next/server";
import { getGoogleSession } from "@/lib/googleDriveSync";

const DNS_WARMUP_DELAY_MS = 8000;

async function hasOAuthSession() {
  const session = await getGoogleSession();
  return Boolean(session.accessToken || session.refreshToken);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const oauthCode = typeof body.oauthCode === "string" ? body.oauthCode.trim() : "";
    const session = await getGoogleSession();

    if (!await hasOAuthSession()) {
      return NextResponse.json({ error: "OAuth verification required before enabling tunnel", code: "OAUTH_REQUIRED" }, { status: 401 });
    }

    if (!oauthCode) {
      return NextResponse.json({ error: "OAuth code is required", code: "OAUTH_CODE_REQUIRED" }, { status: 400 });
    }

    if (!session.email || oauthCode.toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: "Invalid OAuth code", code: "OAUTH_CODE_INVALID" }, { status: 401 });
    }

    const { enableTunnel } = await import("@/lib/tunnel/tunnelManager");
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
