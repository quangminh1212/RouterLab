import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

const SOURCE_SCOPES = {
  documentation: ["read:docs"],
  "web-search": ["read:web"],
  browser: ["use:browser"],
  "local-files": ["read:files"],
  "dev-tools": ["use:dev-tools"],
  database: ["read:database"],
};

function getConfiguredServers(settings) {
  const servers = settings?.aiIntegrations?.mcpServers;
  return Array.isArray(servers) ? servers : [];
}

function describeServer(server) {
  const source = server.source || "custom";
  return {
    name: `mcp_${server.id || "server"}`,
    description: server.name ? `Connect to ${server.name}` : "Connect to configured MCP server",
    scopes: SOURCE_SCOPES[source] || ["use:mcp"],
    phase: server.enabled === true ? "configured" : "available",
    auditLevel: "standard",
    sourceEndpoints: [server.endpoint || server.sourceUrl || server.npmPackage || server.command || "local"],
  };
}

export async function GET() {
  try {
    const tools = getConfiguredServers(await getSettings()).map(describeServer);
    return NextResponse.json({
      total: tools.length,
      mappedTotal: tools.length,
      tools,
    });
  } catch (error) {
    const message = error?.message || "Failed to load MCP tools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
