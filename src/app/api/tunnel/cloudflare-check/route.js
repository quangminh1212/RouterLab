import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

const DNS_PERMISSIONS = ["Zone DNS Read", "Zone DNS Edit"];
const CONNECTOR_PERMISSIONS = ["Cloudflare Tunnel Read", "Cloudflare Tunnel Write", "Cloudflare One Connectors Write"];

async function cloudflareRequest(pathname, token) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { ok: response.ok && payload?.success !== false, status: response.status, payload };
}

export async function GET() {
  try {
    const settings = await getSettings();
    const cf = settings.cloudflare || {};
    const token = cf.apiToken || process.env.CLOUDFLARE_API_TOKEN || "";
    const zoneId = cf.zoneId || process.env.CLOUDFLARE_ZONE_ID || "";
    const tunnelId = cf.tunnelId || process.env.CLOUDFLARE_TUNNEL_ID || "";

    if (!token || !zoneId) {
      return NextResponse.json({
        ok: false,
        error: "Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID",
        requiredPermissions: [...DNS_PERMISSIONS, ...CONNECTOR_PERMISSIONS],
      });
    }

    const zone = await cloudflareRequest(`/zones/${zoneId}`, token);
    const accountId = zone.payload?.result?.account?.id || cf.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || "";
    const dnsOk = zone.ok && Array.isArray(zone.payload?.result?.permissions)
      && zone.payload.result.permissions.includes("#dns_records:edit")
      && zone.payload.result.permissions.includes("#dns_records:read");

    let connector = { ok: false, skipped: true, reason: "missing_tunnel_or_account" };
    if (accountId && tunnelId) {
      const response = await cloudflareRequest(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`, token);
      connector = {
        ok: response.ok,
        skipped: false,
        status: response.status,
        error: response.payload?.errors?.[0]?.message || "",
      };
    }

    return NextResponse.json({
      ok: dnsOk && connector.ok,
      dns: { ok: dnsOk, requiredPermissions: DNS_PERMISSIONS, status: zone.status },
      connector: { ...connector, requiredPermissions: CONNECTOR_PERMISSIONS },
      accountId,
      tunnelId,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
