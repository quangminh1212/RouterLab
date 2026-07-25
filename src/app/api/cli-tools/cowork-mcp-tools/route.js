/** 9router parity: probe MCP tools/list on a URL */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const url = body?.url;
  if (!url) {
    return Response.json({ error: { message: "url required" } }, { status: 400 });
  }
  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    };
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    const initRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "routerlab", version: "1" },
        },
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (initRes.status === 401 || initRes.status === 403) {
      return Response.json({ requiresAuth: true, tools: [] });
    }
    if (!initRes.ok) {
      return Response.json({ tools: [], error: `initialize ${initRes.status}` });
    }
    const toolsRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });
    const data = await toolsRes.json().catch(() => ({}));
    const tools = data?.result?.tools || data?.tools || [];
    return Response.json({ requiresAuth: false, tools });
  } catch (err) {
    return Response.json({ tools: [], error: err.message || String(err) });
  }
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
