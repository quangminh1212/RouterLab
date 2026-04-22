import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/localDb";

const BASE64_BLOCK_SIZE = 4;

function extractAccountLabelFromAccessToken(accessToken) {
  try {
    if (!accessToken || typeof accessToken !== "string") return undefined;
    const parts = accessToken.split(".");
    if (parts.length !== 3) return undefined;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const missingPadding = (BASE64_BLOCK_SIZE - (base64.length % BASE64_BLOCK_SIZE)) % BASE64_BLOCK_SIZE;
    const padded = base64 + "=".repeat(missingPadding);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return (
      payload.email ||
      payload.preferred_username ||
      payload.username ||
      payload["https://api.openai.com/profile"]?.email ||
      payload.sub ||
      undefined
    );
  } catch {
    return undefined;
  }
}

function getFallbackConnectionLabel(connection) {
  if (connection.provider === "kiro") {
    return connection.providerSpecificData?.profileArn || connection.name;
  }

  return connection.name;
}

function isGenericAccountName(name) {
  return typeof name === "string" && /^Account\s+\d+$/i.test(name.trim());
}

// GET /api/providers/client - List all connections for client (includes sensitive fields for sync)
export async function GET() {
  try {
    const connections = await getProviderConnections();

    // Include sensitive fields for sync to cloud (only accessible from same origin)
    const clientConnections = connections.map((c) => {
      const inferredLabel = extractAccountLabelFromAccessToken(c.accessToken);
      const fallbackLabel = getFallbackConnectionLabel(c);
      const displayName = isGenericAccountName(c.name)
        ? c.email || c.displayName || c.username || inferredLabel || fallbackLabel
        : c.email || c.displayName || c.username || c.name;

      return {
        ...c,
        email: c.email || inferredLabel,
        displayName,
        // Don't hide sensitive fields here since this is for internal sync
      };
    });

    return NextResponse.json({ connections: clientConnections });
  } catch (error) {
    console.log("Error fetching providers for client:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}
