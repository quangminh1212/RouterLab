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

function isTamMaoPassthroughModel(modelId) {
  const value = String(modelId || "").trim().toLowerCase();
  return value === "tammao" || value.startsWith("tammao/");
}

function toPassthroughInfoModel(combo, modelId) {
  return {
    id: modelId,
    name: modelId,
    provider: "tammao",
    kind: combo.kind || null,
    type: ["chat"],
    contextWindow: null,
    supports: {
      reasoning: true,
      image: false,
      embedding: false,
      audio: false,
      video: false,
    },
    root: combo.name,
    parent: combo.name,
    models: Array.isArray(combo.models) ? combo.models : [],
  };
}

export async function GET() {
  try {
    let combos = [];
    let hiddenModels = [];
    let modelAliases = {};
    try {
      const [comboList, aliases, settings] = await Promise.all([getCombos(), getModelAliases(), getSettings()]);
      combos = comboList;
      modelAliases = aliases || {};
      hiddenModels = Array.isArray(settings?.hiddenModels) ? settings.hiddenModels : [];
    } catch {
      combos = [];
      modelAliases = {};
      hiddenModels = [];
    }

    const visibleCombos = combos.filter((combo) => combo?.showInModelsEndpoint !== false && !hiddenModels.includes(combo?.name));
    const visibleComboNameSet = new Set(visibleCombos.map((combo) => combo.name));
    const comboInfo = visibleCombos.map((combo) => toInfoModel(combo));

    const seenAliasIds = new Set();
    const aliasInfo = Object.entries(modelAliases)
      .map(([alias, fullModel]) => {
        const normalizedAlias = String(alias || "").trim();
        if (!normalizedAlias || visibleComboNameSet.has(normalizedAlias) || seenAliasIds.has(normalizedAlias)) return null;
        const combo = visibleCombos.find((item) => item?.name === fullModel);
        if (!combo) return null;
        seenAliasIds.add(normalizedAlias);
        return toInfoModel(combo, normalizedAlias);
      })
      .filter(Boolean);

    const seenIds = new Set([...comboInfo, ...aliasInfo].map((model) => String(model.id)));
    const passthroughInfo = combos
      .filter((combo) => combo?.showInModelsEndpoint !== false && !hiddenModels.includes(combo?.name))
      .flatMap((combo) => {
        const upstreamModels = Array.isArray(combo.models) ? combo.models : [];
        return upstreamModels
          .map((modelId) => String(modelId || "").trim())
          .filter((modelId) => isTamMaoPassthroughModel(modelId) && !seenIds.has(modelId))
          .map((modelId) => {
            seenIds.add(modelId);
            return toPassthroughInfoModel(combo, modelId);
          });
      });

    const data = [...comboInfo, ...aliasInfo, ...passthroughInfo]
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));

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
