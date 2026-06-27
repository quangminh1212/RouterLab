import { NextResponse } from "next/server";
import { getSettings } from "@/lib/localDb";

const activeSessions = new Map();
let sessionCounter = 0;

export async function GET(request) {
  const settings = await getSettings();
  if (!settings?.aiIntegrations?.enabled) {
    return NextResponse.json({ error: "MCP integrations are disabled" }, { status: 503 });
  }

  const servers = settings.aiIntegrations?.mcpServers?.filter((s) => s.enabled) || [];
  if (servers.length === 0) {
    return NextResponse.json({ error: "No MCP servers enabled" }, { status: 503 });
  }

  const sessionId = `mcp-session-${++sessionCounter}-${Date.now()}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const session = {
        id: sessionId,
        controller,
        alive: true,
        lastPing: Date.now(),
        servers,
      };
      activeSessions.set(sessionId, session);

      const initEvent = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {
          sessionId,
          protocolVersion: "2024-11-05",
          serverInfo: { name: "xlabrouter-mcp-bridge", version: "1.0.0" },
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: false, listChanged: false },
          },
        },
      });
      controller.enqueue(encoder.encode(`event: message\ndata: ${initEvent}\n\n`));

      const toolsList = servers.flatMap((srv) => {
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
                tool: { type: "string", description: "Tool name" },
                arguments: { type: "object", description: "Tool arguments" },
              },
              required: ["tool"],
            },
          },
        ];
      });

      const toolsEvent = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/tools/list_changed",
        params: { tools: toolsList },
      });
      controller.enqueue(encoder.encode(`event: message\ndata: ${toolsEvent}\n\n`));

      const pingInterval = setInterval(() => {
        if (!session.alive) {
          clearInterval(pingInterval);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`:ping\n\n`));
          session.lastPing = Date.now();
        } catch {
          session.alive = false;
          clearInterval(pingInterval);
          activeSessions.delete(sessionId);
        }
      }, 15000);

      session._pingInterval = pingInterval;
    },
    cancel() {
      const session = activeSessions.get(sessionId);
      if (session) {
        session.alive = false;
        if (session._pingInterval) clearInterval(session._pingInterval);
        activeSessions.delete(sessionId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "X-Session-Id": sessionId,
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export { activeSessions };
