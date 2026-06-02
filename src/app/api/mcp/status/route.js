import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

function getConfiguredServers(settings) {
  const servers = settings?.aiIntegrations?.mcpServers;
  return Array.isArray(servers) ? servers : [];
}

function isServerEnabled(server) {
  return server?.enabled === true;
}

function getTransport(server) {
  if (server?.endpoint) return "http";
  if (server?.command) return "stdio";
  return "unknown";
}

export async function GET() {
  try {
    const settings = await getSettings();
    const servers = getConfiguredServers(settings);
    const enabledServers = servers.filter(isServerEnabled);
    const online = settings?.aiIntegrations?.enabled === true && enabledServers.length > 0;

    return NextResponse.json({
      status: online ? "configured" : "offline",
      online,
      enabled: settings?.aiIntegrations?.enabled === true,
      transport: enabledServers.some((server) => getTransport(server) === "http") ? "http" : "stdio",
      scopesEnforced: false,
      heartbeatPath: null,
      heartbeat: null,
      httpTransport: {
        enabled: enabledServers.some((server) => getTransport(server) === "http"),
        activeSessions: 0,
      },
      activity: {
        totalCalls24h: 0,
        successRate: null,
        avgDurationMs: null,
        topTools: [],
        lastCallAt: null,
        lastCallTool: null,
      },
      servers: servers.map((server) => ({
        id: server.id,
        name: server.name || server.id,
        source: server.source || "custom",
        enabled: isServerEnabled(server),
        transport: getTransport(server),
        configured: Boolean(server.endpoint || server.command || server.npmPackage),
      })),
    });
  } catch (error) {
    const message = error?.message || "Failed to load MCP status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
