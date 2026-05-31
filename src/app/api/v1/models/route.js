import { PUT as putModels } from "@/app/api/models/route";
import { getCombos, getModelAliases, getSettings } from "@/lib/localDb";

function buildCorsHeaders(methods = "GET, PUT, OPTIONS") {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "*",
  };
}

function safeJsonFromResponse(response) {
  return response.json().catch(async () => {
    const text = await response.text().catch(() => "");
    return { error: { message: String(text || "Upstream error"), type: "server_error" } };
  });
}

function isTamMaoPassthroughModel(modelId) {
  const value = String(modelId || "").trim().toLowerCase();
  return value === "tammao" || value.startsWith("tammao/");
}

function buildTamMaoPassthroughModels(combos, hiddenModels, existingIds, timestamp) {
  const hiddenSet = new Set(Array.isArray(hiddenModels) ? hiddenModels : []);
  const models = [];

  for (const combo of combos) {
    if (!combo || combo.showInModelsEndpoint === false || hiddenSet.has(combo?.name)) continue;
    const upstreamModels = Array.isArray(combo.models) ? combo.models : [];
    for (const upstreamModel of upstreamModels) {
      const modelId = String(upstreamModel || "").trim();
      if (!isTamMaoPassthroughModel(modelId) || existingIds.has(modelId)) continue;
      existingIds.add(modelId);
      models.push({
        id: modelId,
        object: "model",
        created: timestamp,
        owned_by: "tammao",
        permission: [],
        root: combo.name,
        parent: combo.name,
      });
    }
  }

  return models;
}

async function hasInvalidJsonBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return false;

  try {
    await request.clone().json();
    return false;
  } catch {
    return true;
  }
}
/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: buildCorsHeaders(),
  });
}

/**
 * GET /v1/models - OpenAI compatible models list
 * Returns visible combo models only in OpenAI format
 */
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
      console.log("Could not fetch combos");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const visibleComboNames = combos
      .filter((combo) => combo?.showInModelsEndpoint !== false && !hiddenModels.includes(combo?.name))
      .map((combo) => combo.name);
    const visibleComboNameSet = new Set(visibleComboNames);

    const models = visibleComboNames.map((comboName) => ({
      id: comboName,
      object: "model",
      created: timestamp,
      owned_by: "combo",
      permission: [],
      root: comboName,
      parent: null,
    }));

    const seenAliasIds = new Set();
    const aliasModels = Object.entries(modelAliases)
      .map(([alias, fullModel]) => {
        const normalizedAlias = String(alias || "").trim();
        if (!normalizedAlias || visibleComboNameSet.has(normalizedAlias) || seenAliasIds.has(normalizedAlias)) return null;
        const combo = combos.find((item) => item?.name === fullModel);
        if (!combo || combo.showInModelsEndpoint === false || hiddenModels.includes(combo.name)) return null;
        seenAliasIds.add(normalizedAlias);
        return {
          id: normalizedAlias,
          object: "model",
          created: timestamp,
          owned_by: "alias",
          permission: [],
          root: combo.name,
          parent: combo.name,
        };
      })
      .filter(Boolean);

    const existingIds = new Set([...models, ...aliasModels].map((model) => String(model.id)));
    const tammaoPassthroughModels = buildTamMaoPassthroughModels(combos, hiddenModels, existingIds, timestamp);

    const data = [...models, ...aliasModels, ...tammaoPassthroughModels]
      .sort((left, right) => String(left.id).localeCompare(String(right.id)));

    return Response.json({
      object: "list",
      data,
    }, {
      headers: buildCorsHeaders(),
    });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json(
      { error: { message: error.message, type: "server_error" } },
      { status: 500, headers: buildCorsHeaders() }
    );
  }
}

export async function PUT(request) {
  if (await hasInvalidJsonBody(request)) {
    return Response.json({ error: "Invalid JSON body" }, {
      status: 400,
      headers: buildCorsHeaders(),
    });
  }

  const response = await putModels(request);
  const payload = await safeJsonFromResponse(response);

  return Response.json(payload, {
    status: response.status,
    headers: buildCorsHeaders(),
  });
}
