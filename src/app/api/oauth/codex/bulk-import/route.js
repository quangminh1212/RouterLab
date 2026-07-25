/**
 * 9router parity: POST /api/oauth/codex/bulk-import
 * Body: { tokens: [{ accessToken, refreshToken, ... }] }
 */
import { withRouteGuard } from "@/lib/runtimeGuard";

async function postHandler(request) {
  const body = await request.json().catch(() => null);
  const list = body?.tokens || body?.items || (Array.isArray(body) ? body : null);
  if (!Array.isArray(list) || list.length === 0) {
    return Response.json(
      { error: { message: "Expected tokens: [] array", type: "invalid_request_error" } },
      { status: 400 }
    );
  }

  const results = [];
  for (const item of list) {
    const res = await fetch(new URL("/api/oauth/codex/import-token", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") || "" },
      body: JSON.stringify(item),
    }).catch((e) => ({ ok: false, status: 500, json: async () => ({ error: e.message }) }));
    const data = typeof res.json === "function" ? await res.json() : res;
    results.push({ ok: res.ok !== false && res.status < 400, data });
  }
  return Response.json({
    success: results.every((r) => r.ok),
    imported: results.filter((r) => r.ok).length,
    total: results.length,
    results,
  });
}

export const POST = withRouteGuard("oauth/codex/bulk-import", postHandler, {
  timeoutMs: 120000,
});

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
