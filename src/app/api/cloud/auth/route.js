import { NextResponse } from "next/server";
import { validateApiKey, getProviderConnections, getModelAliases, parseBearerToken } from "@/models";

function cloudError(message, status = 400, type = "invalid_request_error") {
  return NextResponse.json({ error: { message, type } }, { status });
}

function sortObjectByKey(input) {
  return Object.fromEntries(Object.entries(input || {}).sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function sortConnections(connections) {
  return [...(connections || [])].sort((left, right) => {
    const providerDiff = String(left?.provider || "").localeCompare(String(right?.provider || ""));
    if (providerDiff !== 0) return providerDiff;
    return String(left?.authType || "").localeCompare(String(right?.authType || ""));
  });
}

// Verify API key and return provider credentials
export async function POST(request) {
  try {
    const apiKey = parseBearerToken(request.headers.get("Authorization"));
    if (!apiKey) {
      return cloudError("Missing API key", 401, "authentication_error");
    }

    // Validate API key
    const isValid = await validateApiKey(apiKey);
    if (!isValid) {
      return cloudError("Invalid API key", 401, "authentication_error");
    }

    // Get active provider connections
    const connections = await getProviderConnections({ isActive: true });

    // Map connections
    const mappedConnections = connections.map(conn => ({
      provider: conn.provider,
      authType: conn.authType,
      apiKey: conn.apiKey || null,
      accessToken: conn.accessToken || null,
      refreshToken: conn.refreshToken || null,
      projectId: conn.projectId || null,
      expiresAt: conn.expiresAt,
      priority: conn.priority,
      globalPriority: conn.globalPriority,
      defaultModel: conn.defaultModel,
      isActive: conn.isActive
    }));

    // Get model aliases
    const modelAliases = await getModelAliases();

    return NextResponse.json({
      connections: sortConnections(mappedConnections),
      modelAliases: sortObjectByKey(modelAliases)
    });

  } catch (error) {
    console.log("Cloud auth error:", error);
    return cloudError("Internal error", 500, "server_error");
  }
}
