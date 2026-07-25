/**
 * 9router parity: GET /api/mcp/[plugin]/sse
 * Falls back to main MCP SSE when plugin-specific bridge is absent.
 */
export async function GET(request, { params }) {
  const { plugin } = await params;
  try {
    const mod = await import("@/app/api/mcp/sse/route.js");
    if (typeof mod.GET === "function") {
      const res = await mod.GET(request);
      // Annotate which plugin was requested
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
        message: `MCP SSE for plugin '${plugin}' not available. Use /api/mcp/sse.`,
        type: "not_found",
      },
    },
    { status: 404 }
  );
}
