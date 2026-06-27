import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";
import { activeSessions } from "../sse/route.js";

async function forwardToHttpServer(server, toolName, args) {
  if (!server.endpoint) return { error: "Server has no HTTP endpoint configured" };
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: { name: toolName, arguments: args || {} },
  });
  try {
    const headers = { "Content-Type": "application/json" };
    if (server.apiKey) headers["Authorization"] = `Bearer ${server.apiKey}`;
    if (server.headers) Object.assign(headers, server.headers);
    const res = await fetch(server.endpoint, { method: "POST", headers, body });
    if (!res.ok) return { error: `MCP server returned ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: err.message || "Failed to reach MCP server" };
  }
}

export async function POST(request) {
  const settings = await getSettings();
  if (!settings?.aiIntegrations?.enabled) {
    return NextResponse.json({ error: "MCP integrations are disabled" }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const { method, params, id } = body;
  const sessionId = request.headers.get("x-session-id") || params?.sessionId;
  const servers = settings.aiIntegrations?.mcpServers?.filter((s) => s.enabled) || [];

  if (method === "tools/list") {
    const tools = servers.flatMap((srv) => {
      const prefix = srv.id || "server";
      return [
        {
          name: `${prefix}_list_tools`,
          description: `List available tools from ${srv.name || srv.id}`,
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: `${prefix}_call_tool`,
          description: `Call a tool on ${srv.name || srv.id}`,
          inputSchema: {
            type: "object",
            properties: {
              tool: { type: "string" },
              arguments: { type: "object" },
            },
            required: ["tool"],
          },
        },
      ];
    });
    return NextResponse.json({ jsonrpc: "2.0", id, result: { tools } });
  }

  if (method === "tools/call") {
    const toolName = params?.name || "";
    const args = params?.arguments || {};

    const matchingServer = servers.find((srv) => toolName.startsWith(`${srv.id}_`));
    if (!matchingServer) {
      return NextResponse.json(
        { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } },
        { status: 404 }
      );
    }

    const actualTool = toolName.replace(`${matchingServer.id}_`, "");

    if (actualTool === "call_tool") {
      const result = await forwardToHttpServer(matchingServer, args.tool || "", args.arguments || {});
      if (result.error) {
        return NextResponse.json({ jsonrpc: "2.0", id, error: { code: -32603, message: result.error } });
      }
      const session = sessionId ? activeSessions.get(sessionId) : null;
      if (session?.alive) {
        const encoder = new TextEncoder();
        const event = JSON.stringify({ jsonrpc: "2.0", method: "notifications/tool/result", params: { tool: toolName, result } });
        try { session.controller.enqueue(encoder.encode(`event: message\ndata: ${event}\n\n`)); } catch {}
      }
      return NextResponse.json({ jsonrpc: "2.0", id, result: result.result || result });
    }

    if (actualTool === "list_tools") {
      const result = await forwardToHttpServer(matchingServer, "__list_tools", {});
      return NextResponse.json({ jsonrpc: "2.0", id, result: result.result || result });
    }

    return NextResponse.json(
      { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown action: ${actualTool}` } },
      { status: 404 }
    );
  }

  if (method === "initialize") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: { name: "xlabrouter-mcp-bridge", version: "1.0.0" },
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: false, listChanged: false },
        },
      },
    });
  }

  if (method === "ping") {
    return NextResponse.json({ jsonrpc: "2.0", id, result: {} });
  }

  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } },
    { status: 404 }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
