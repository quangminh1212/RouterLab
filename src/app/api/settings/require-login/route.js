import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

function isLocalhostRequest(request) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export async function GET(request) {
  try {
    const settings = await getSettings();
    const requireLogin = isLocalhostRequest(request) ? false : settings.requireLogin !== false;
    const tunnelDashboardAccess = settings.tunnelDashboardAccess !== false;
    const tunnelUrl = settings.tunnelUrl || "";
    const tailscaleUrl = settings.tailscaleUrl || "";
    const hasPassword = false;
    return NextResponse.json({ requireLogin, tunnelDashboardAccess, tunnelUrl, tailscaleUrl, hasPassword });
  } catch (error) {
    return NextResponse.json({ requireLogin: true }, { status: 200 });
  }
}
