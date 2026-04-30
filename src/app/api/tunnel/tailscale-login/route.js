import { NextResponse } from "next/server";

function normalizeLoginUrl(url) {
  if (!url) return "";
  if (/login\.tailscale\.com\/admin\//i.test(url)) {
    return "https://login.tailscale.com/start";
  }
  return url;
}

export async function POST() {
  try {
    const { getTailscaleAuthUrl, startLogin, triggerTailscaleSystemLogin } = await import("@/lib/tunnel/tailscale");
    const login = await startLogin();
    if (login?.alreadyLoggedIn) {
      return NextResponse.json({ success: true, alreadyLoggedIn: true });
    }

    const authFromUp = normalizeLoginUrl(login?.authUrl || "");
    if (authFromUp) {
      return NextResponse.json({ success: false, needsLogin: true, authUrl: authFromUp });
    }

    const immediateUrl = normalizeLoginUrl(getTailscaleAuthUrl());
    if (immediateUrl) {
      return NextResponse.json({ success: false, needsLogin: true, authUrl: immediateUrl });
    }

    triggerTailscaleSystemLogin();
    return NextResponse.json({ success: false, needsLogin: true });
  } catch (error) {
    console.error("Tailscale login error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}