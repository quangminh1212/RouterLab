/** 9router parity: Anthropic MCP commercial registry proxy */
const REGISTRY_URL = "https://api.anthropic.com/mcp-registry/v0/servers";

export async function GET() {
  try {
    const r = await fetch(`${REGISTRY_URL}?limit=100&visibility=commercial`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      return Response.json({
        servers: [],
        error: `upstream ${r.status}`,
        source: "anthropic-mcp-registry",
      });
    }
    const data = await r.json();
    return Response.json({ ...data, source: "anthropic-mcp-registry" });
  } catch (err) {
    return Response.json({
      servers: [],
      error: err.message,
      source: "anthropic-mcp-registry",
    });
  }
}
