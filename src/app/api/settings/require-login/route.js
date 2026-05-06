import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

function isLocalhostRequest(request) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function parseHostnameFromUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isTunnelLikeRequest(request, settings) {
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  if (!host || host === "localhost" || host === "127.0.0.1" || host === "::1") return false;

  const tunnelHost = parseHostnameFromUrl(settings?.tunnelUrl || "");
  const tailscaleHost = parseHostnameFromUrl(settings?.tailscaleUrl || "");
  if ((tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost)) return true;

  const cfDomain = String(settings?.cloudflare?.domain || "").trim().toLowerCase();
  if (cfDomain && (host === cfDomain || host.endsWith(`.${cfDomain}`))) return true;

  return false;
}

export async function GET(request) {
  try {
    const settings = await getSettings();
    const requireLogin = isLocalhostRequest(request)
      ? false
      : (isTunnelLikeRequest(request, settings) ? true : settings.requireLogin !== false);
    const tunnelDashboardAccess = settings.tunnelDashboardAccess !== false;
    const tunnelUrl = settings.tunnelUrl || "";
    const tailscaleUrl = settings.tailscaleUrl || "";
    const hasPassword = false;
    return NextResponse.json({ requireLogin, tunnelDashboardAccess, tunnelUrl, tailscaleUrl, hasPassword });
  } catch (error) {
    return NextResponse.json({ requireLogin: true }, { status: 200 });
  }
}
