/**
 * 9router parity: POST /api/oauth/kiro/api-key — register Kiro API key connection.
 */
import { withRouteGuard } from "@/lib/runtimeGuard";

async function postHandler(request) {
  const body = await request.json().catch(() => null);
  const apiKey = body?.apiKey || body?.key;
  if (!apiKey) {
    return Response.json(
      { error: { message: "apiKey required", type: "invalid_request_error" } },
      { status: 400 }
    );
  }
  try {
    const { getSettings, saveSettings } = await import("@/lib/localDb");
    const settings = await getSettings();
    const connections = Array.isArray(settings.connections) ? settings.connections : [];
    const id = body.connectionId || `kiro-apikey-${Date.now()}`;
    const rec = {
      id,
      provider: "kiro",
      apiKey,
      providerSpecificData: { authType: "apiKey", ...(body.providerSpecificData || {}) },
      importedAt: new Date().toISOString(),
    };
    const idx = connections.findIndex((c) => c.id === id);
    if (idx >= 0) connections[idx] = { ...connections[idx], ...rec };
    else connections.push(rec);
    await saveSettings({ ...settings, connections });
    return Response.json({ success: true, connectionId: id });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const POST = withRouteGuard("oauth/kiro/api-key", postHandler, { timeoutMs: 15000 });
