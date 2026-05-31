// Amp CLI: GET /api/provider/{provider}/models — models for a scoped provider
import { resolveProviderId, getProviderAlias } from "@/shared/constants/providers.js";
import { getModelsByProviderId } from "open-sse/config/providerModels.js";
import { ampCors } from "../_lib/ampForward.js";

export async function OPTIONS() {
  return new Response(null, { headers: ampCors() });
}

export async function GET(request, { params }) {
  const { provider } = await params;
  const providerId = resolveProviderId(String(provider || "").trim());
  const alias = getProviderAlias(providerId);
  let models = [];
  try {
    models = getModelsByProviderId(providerId) || [];
  } catch { models = []; }

  const data = models.map((m) => ({
    id: `${alias}/${m.id}`,
    object: "model",
    owned_by: providerId,
    created: Math.floor(Date.now() / 1000),
  }));

  return Response.json({ object: "list", data }, { headers: ampCors() });
}
