/**
 * 9router parity: POST /api/oauth/codex/import-token
 * Import Codex refresh/access token into a connection.
 */
import { withRouteGuard } from "@/lib/runtimeGuard";

async function postHandler(request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json(
      { error: { message: "Invalid JSON body", type: "invalid_request_error" } },
      { status: 400 }
    );
  }
  const accessToken = body.accessToken || body.access_token || body.token;
  const refreshToken = body.refreshToken || body.refresh_token;
  if (!accessToken && !refreshToken) {
    return Response.json(
      {
        error: {
          message: "Provide accessToken and/or refreshToken from Codex CLI auth",
          type: "invalid_request_error",
        },
      },
      { status: 400 }
    );
  }
  // Persist via dashboard connections API pattern when available
  try {
    const { getSettings, saveSettings } = await import("@/lib/localDb");
    const settings = await getSettings();
    const connections = Array.isArray(settings.connections) ? settings.connections : [];
    const id = body.connectionId || `codex-import-${Date.now()}`;
    const rec = {
      id,
      provider: "codex",
      accessToken: accessToken || null,
      refreshToken: refreshToken || null,
      expiresAt: body.expiresAt || null,
      providerSpecificData: body.providerSpecificData || {},
      importedAt: new Date().toISOString(),
    };
    const idx = connections.findIndex((c) => c.id === id);
    if (idx >= 0) connections[idx] = { ...connections[idx], ...rec };
    else connections.push(rec);
    await saveSettings({ ...settings, connections });
    return Response.json({ success: true, connectionId: id, provider: "codex" });
  } catch (err) {
    return Response.json(
      {
        success: true,
        dryRun: true,
        message:
          "Token accepted but localDb write unavailable in this context. " +
          "Use dashboard Providers → Codex import.",
        error: err.message,
      },
      { status: 200 }
    );
  }
}

export const POST = withRouteGuard("oauth/codex/import-token", postHandler, {
  timeoutMs: 30000,
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
