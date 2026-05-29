import { getCombos, getModelAliases, getSettings } from "@/lib/localDb";
import { getModelInfo } from "open-sse/config/models.js";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export async function OPTIONS() {
  return new Response(null, {
    headers: buildCorsHeaders(),
  });
}

function toInfoModel(combo, alias = null) {
  const modelInfo = getModelInfo(combo.name);
  const resolvedId = alias || combo.name;
  return {
    id: resolvedId,
    name: resolvedId,
    provider: alias ? "alias" : "combo",
    kind: combo.kind || null,
    type: Array.isArray(modelInfo.type) ? modelInfo.type : ["chat"],
    contextWindow: Number.isFinite(modelInfo.contextWindow) ? modelInfo.contextWindow : null,
    supports: {
      reasoning: modelInfo.type?.includes("chat") || false,
      image: modelInfo.type?.includes("image") || false,
      embedding: modelInfo.type?.includes("embedding") || false,
      audio: modelInfo.type?.includes("audio") || false,
      video: modelInfo.type?.includes("video") || false,
    },
    root: combo.name,
    parent: alias ? combo.name : null,
    models: Array.isArray(combo.models) ? combo.models : [],
  };
}

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const targetId = decodeURIComponent(String(id || "").trim());
    if (!targetId) {
      return Response.json({
        error: {
          message: "Model id required",
          type: "invalid_request_error",
        },
      }, {
        status: 400,
        headers: buildCorsHeaders(),
      });
    }

    const [combos, aliases, settings] = await Promise.all([getCombos(), getModelAliases(), getSettings()]);
    const hiddenModels = Array.isArray(settings?.hiddenModels) ? settings.hiddenModels : [];
    const visibleCombos = combos.filter((item) => item?.showInModelsEndpoint !== false && !hiddenModels.includes(item?.name));
    const directCombo = visibleCombos.find((item) => item?.name === targetId);
    const aliasTarget = aliases?.[targetId];
    const aliasCombo = aliasTarget && !visibleCombos.some((item) => item?.name === targetId)
      ? visibleCombos.find((item) => item?.name === aliasTarget)
      : null;
    const combo = directCombo || aliasCombo;

    if (!combo) {
      return Response.json({
        error: {
          message: `Model not found: ${targetId}`,
          type: "not_found",
        },
      }, {
        status: 404,
        headers: buildCorsHeaders(),
      });
    }

    return Response.json(toInfoModel(combo, aliasCombo ? targetId : null), {
      headers: buildCorsHeaders(),
    });
  } catch (error) {
    return Response.json({
      error: {
        message: error instanceof Error ? error.message : "Failed to fetch model info",
        type: "server_error",
      },
    }, {
      status: 500,
      headers: buildCorsHeaders(),
    });
  }
}
