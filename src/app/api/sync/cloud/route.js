import { NextResponse } from "next/server";
import {
  getApiKeys,
  getProviderConnections,
  getSettings,
  getProviderNodes,
  getCombos,
} from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";

export const dynamic = "force-dynamic";

function getCloudBaseUrl(settings) {
  const raw = (
    settings?.tunnelUrl ||
    settings?.cloudflare?.tunnelPublicUrl ||
    process.env.CLOUDFLARE_TUNNEL_PUBLIC_URL ||
    ""
  ).replace(/\/$/, "");

  return raw.replace(/\/v1$/i, "");
}

async function buildSyncPayload() {
  const [providers, apiKeys, providerNodes, combos] = await Promise.all([
    getProviderConnections(),
    getApiKeys(),
    getProviderNodes(),
    getCombos().catch(() => []),
  ]);

  const modelAliases = {};
  for (const node of providerNodes || []) {
    if (node?.prefix) {
      modelAliases[node.prefix] = node;
    }
  }

  return {
    providers: providers || [],
    modelAliases,
    combos: combos || [],
    apiKeys: apiKeys || [],
  };
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const settings = await getSettings();
    const machineId = body?.machineId || await getConsistentMachineId();
    const cloudBaseUrl = getCloudBaseUrl(settings);

    if (!cloudBaseUrl) {
      return NextResponse.json({ error: "Cloud URL is not configured" }, { status: 400 });
    }

    const payload = await buildSyncPayload();
    const response = await fetch(`${cloudBaseUrl}/sync/${encodeURIComponent(machineId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return NextResponse.json({ error: "Cloud sync failed", status: response.status, details: responseData }, { status: 502 });
    }

    return NextResponse.json({ success: true, machineId, cloudBaseUrl, result: responseData });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Cloud sync failed" }, { status: 500 });
  }
}
