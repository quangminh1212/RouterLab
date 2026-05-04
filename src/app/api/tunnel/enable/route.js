import { NextResponse } from "next/server";
import { getOrCreateTotpSecret, verifyTotpCode } from "@/lib/auth/totp";

const DNS_WARMUP_DELAY_MS = 8000;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const oauthCode = typeof body.oauthCode === "string" ? body.oauthCode.trim() : "";

    if (!oauthCode) {
      return NextResponse.json({ error: "Authenticator code is required", code: "OAUTH_CODE_REQUIRED" }, { status: 400 });
    }

    const totpSecret = await getOrCreateTotpSecret();
    if (!verifyTotpCode(totpSecret, oauthCode)) {
      return NextResponse.json({ error: "Invalid authenticator code", code: "OAUTH_CODE_INVALID" }, { status: 401 });
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
