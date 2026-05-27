import { getCombos, getSettings } from "@/lib/localDb";
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

function toInfoModel(combo) {
  const modelInfo = getModelInfo(combo.name);
  return {
    id: combo.name,
    name: combo.name,
    provider: "combo",
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
    models: Array.isArray(combo.models) ? combo.models : [],
  };
}

export async function GET() {
  try {
    let combos = [];
    let hiddenModels = [];
    try {
      const [comboList, settings] = await Promise.all([getCombos(), getSettings()]);
      combos = comboList;
      hiddenModels = Array.isArray(settings?.hiddenModels) ? settings.hiddenModels : [];
    } catch {
      combos = [];
      hiddenModels = [];
    }

    const data = combos
      .filter((combo) => combo?.showInModelsEndpoint !== false && !hiddenModels.includes(combo?.name))
      .map(toInfoModel);

    return Response.json({
      object: "list",
      data,
    }, {
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
