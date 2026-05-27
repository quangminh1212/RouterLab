import { getCombos, getSettings } from "@/lib/localDb";
import { getModelInfo } from "open-sse/config/models.js";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

const SUPPORTED_KINDS = new Set(["chat", "image", "embedding", "audio", "video", "reasoning"]);

export async function OPTIONS() {
  return new Response(null, {
    headers: buildCorsHeaders(),
  });
}

function toInfoModel(combo) {
  const modelInfo = getModelInfo(combo.name);
  const types = Array.isArray(modelInfo.type) ? modelInfo.type : ["chat"];
  return {
    id: combo.name,
    name: combo.name,
    provider: "combo",
    kind: combo.kind || null,
    type: types,
    contextWindow: Number.isFinite(modelInfo.contextWindow) ? modelInfo.contextWindow : null,
    supports: {
      reasoning: types.includes("chat"),
      image: types.includes("image"),
      embedding: types.includes("embedding"),
      audio: types.includes("audio"),
      video: types.includes("video"),
    },
    models: Array.isArray(combo.models) ? combo.models : [],
  };
}

function matchesKind(model, kind) {
  if (kind === "reasoning") return model.supports.reasoning;
  return model.supports[kind] === true || model.type.includes(kind);
}

export async function GET(_request, { params }) {
  const { kind } = await params;
  const normalizedKind = String(kind || "").trim().toLowerCase();

  if (!SUPPORTED_KINDS.has(normalizedKind)) {
    return Response.json({
      error: {
        message: `Unsupported model capability: ${normalizedKind}`,
        type: "invalid_request_error",
      },
    }, {
      status: 400,
      headers: buildCorsHeaders(),
    });
  }

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
      .map(toInfoModel)
      .filter((model) => matchesKind(model, normalizedKind));

    return Response.json({
      object: "list",
      capability: normalizedKind,
      data,
    }, {
      headers: buildCorsHeaders(),
    });
  } catch (error) {
    return Response.json({
      error: {
        message: error instanceof Error ? error.message : "Failed to fetch models by capability",
        type: "server_error",
      },
    }, {
      status: 500,
      headers: buildCorsHeaders(),
    });
  }
}
