/**
 * 9router parity: POST /api/mcp/[plugin]/message
 */
export async function POST(request, { params }) {
  const { plugin } = await params;
  try {
    const mod = await import("@/app/api/mcp/messages/route.js");
    if (typeof mod.POST === "function") {
      const res = await mod.POST(request);
      const headers = new Headers(res.headers);
      headers.set("X-MCP-Plugin", plugin);
      return new Response(res.body, { status: res.status, headers });
    }
  } catch {
    // fall through
  }
  return Response.json(
    {
      error: {
        message: `MCP message for plugin '${plugin}' not available. Use /api/mcp/messages.`,
        type: "not_found",
      },
    },
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
