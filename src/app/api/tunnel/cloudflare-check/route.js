import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

const DNS_PERMISSIONS = ["Zone DNS Read", "Zone DNS Edit"];
const CONNECTOR_PERMISSIONS = ["Cloudflare Tunnel Read", "Cloudflare Tunnel Write", "Cloudflare One Connectors Write"];

function getAuthHeaders(cf) {
  const apiKey = cf.apiKey || process.env.CLOUDFLARE_API_KEY || "";
  const email = cf.email || process.env.CLOUDFLARE_EMAIL || "";
  const token = cf.apiToken || process.env.CLOUDFLARE_API_TOKEN || "";
  if (apiKey && email) {
    return { "X-Auth-Key": apiKey, "X-Auth-Email": email, "Content-Type": "application/json" };
  }
  if (token) {
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }
  return null;
}

async function cloudflareRequest(pathname, headers) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    headers,
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
    const headers = getAuthHeaders(cf);
    const zoneId = cf.zoneId || process.env.CLOUDFLARE_ZONE_ID || "";
    const tunnelId = cf.tunnelId || process.env.CLOUDFLARE_TUNNEL_ID || "";

    if (!headers || !zoneId) {
      return NextResponse.json({
        ok: false,
        error: "Missing Cloudflare credentials or CLOUDFLARE_ZONE_ID",
        requiredPermissions: [...DNS_PERMISSIONS, ...CONNECTOR_PERMISSIONS],
      });
    }

    const zone = await cloudflareRequest(`/zones/${zoneId}`, headers);
    const accountId = zone.payload?.result?.account?.id || cf.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || "";
    const dnsOk = zone.ok && Array.isArray(zone.payload?.result?.permissions)
      && zone.payload.result.permissions.includes("#dns_records:edit")
      && zone.payload.result.permissions.includes("#dns_records:read");

    let connector = { ok: false, skipped: true, reason: "missing_tunnel_or_account" };
    if (accountId && tunnelId) {
      const response = await cloudflareRequest(`/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`, headers);
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
