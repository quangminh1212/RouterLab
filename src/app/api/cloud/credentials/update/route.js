import { NextResponse } from "next/server";
import { validateApiKey, getProviderConnections, updateProviderConnection, parseBearerToken } from "@/models";

function cloudError(message, status = 400, type = "invalid_request_error") {
  return NextResponse.json({ error: { message, type } }, { status });
}

// Update provider credentials (for cloud token refresh)
export async function PUT(request) {
  try {
    const apiKey = parseBearerToken(request.headers.get("Authorization"));
    if (!apiKey) {
      return cloudError("Missing API key", 401, "authentication_error");
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return cloudError("Invalid JSON body");
    }
    const provider = String(body?.provider || "").trim();
    if (/[^ -~]/.test(provider)) {
      return cloudError("Invalid provider", 400, "invalid_request_error");
    }
    const credentials = body?.credentials;

    if (!provider || !credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
      return cloudError("Provider and credentials required");
    }

    // Validate API key
    const isValid = await validateApiKey(apiKey);
    if (!isValid) {
      return cloudError("Invalid API key", 401, "authentication_error");
    }

    // Find active connection for provider
    const connections = await getProviderConnections({ provider, isActive: true });
    const connection = connections[0];

    if (!connection) {
      return cloudError(`No active connection found for provider: ${provider}`, 404, "not_found");
    }

    // Update credentials
    const updateData = {};
    if (typeof credentials.accessToken === "string" && credentials.accessToken.trim()) {
      updateData.accessToken = credentials.accessToken.trim();
    }
    if (typeof credentials.refreshToken === "string" && credentials.refreshToken.trim()) {
      updateData.refreshToken = credentials.refreshToken.trim();
    }
    if (Number.isFinite(Number(credentials.expiresIn)) && Number(credentials.expiresIn) > 0) {
      updateData.expiresAt = new Date(Date.now() + Number(credentials.expiresIn) * 1000).toISOString();
    }

    if (Object.keys(updateData).length === 0) {
      return cloudError("No valid credential fields provided");
    }

    await updateProviderConnection(connection.id, updateData);

    return NextResponse.json({ 
      success: true, 
      message: `Credentials updated for provider: ${provider}` 
    });

  } catch (error) {
    console.log("Update credentials error:", error);
    return cloudError("Failed to update credentials", 500, "server_error");
  }
}
