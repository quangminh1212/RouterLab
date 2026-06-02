import { GET as getModels } from "@/app/api/v1/models/route";
import { AI_PROVIDERS } from "@/shared/constants/providers";

function getProviderName(providerId) {
  return AI_PROVIDERS[providerId]?.name || providerId;
}

function normalizeModelType(type) {
  return type || "chat";
}

export async function GET(request) {
  try {
    const response = await getModels(request);
    const body = await response.json();

    if (!response.ok) {
      return Response.json(body, { status: response.status });
    }

    const catalog = {};
    for (const model of body.data || []) {
      const providerId = typeof model.owned_by === "string" && model.owned_by.length > 0
        ? model.owned_by
        : "unknown";
      const bucket = catalog[providerId] || {
        provider: getProviderName(providerId),
        active: providerId !== "unknown",
        models: [],
      };

      bucket.models.push({
        id: model.id,
        name: model.name || model.root || model.id,
        type: normalizeModelType(model.type),
        custom: model.custom === true,
        ...(model.capabilities ? { capabilities: model.capabilities } : {}),
        ...(typeof model.context_length === "number" ? { context_length: model.context_length } : {}),
        ...(typeof model.max_output_tokens === "number" ? { max_output_tokens: model.max_output_tokens } : {}),
        ...(Array.isArray(model.input_modalities) ? { input_modalities: model.input_modalities } : {}),
        ...(Array.isArray(model.output_modalities) ? { output_modalities: model.output_modalities } : {}),
        ...(Array.isArray(model.supported_endpoints) ? { supported_endpoints: model.supported_endpoints } : {}),
      });

      catalog[providerId] = bucket;
    }

    return Response.json({
      catalog,
      catalogVersion: response.headers.get("X-Model-Catalog-Version"),
    });
  } catch (error) {
    return Response.json(
      { error: { message: error.message, type: "server_error" } },
      { status: 500 },
    );
  }
}
