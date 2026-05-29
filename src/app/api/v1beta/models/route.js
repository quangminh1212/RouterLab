import { getCombos, getModelAliases, getSettings } from "@/lib/localDb";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*"
  };
}

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: buildCorsHeaders()
  });
}

/**
 * GET /v1beta/models - Gemini compatible models list
 * Returns models in Gemini API format
 */
export async function GET() {
  try {
    const models = [];

    const [combos, aliases, settings] = await Promise.all([getCombos(), getModelAliases(), getSettings()]);
    const hiddenModels = Array.isArray(settings?.hiddenModels) ? settings.hiddenModels : [];
    const visibleComboNames = combos
      .filter((combo) => combo?.showInModelsEndpoint !== false && !hiddenModels.includes(combo?.name))
      .map((combo) => combo.name);
    const visibleComboNameSet = new Set(visibleComboNames);

    for (const comboName of visibleComboNames) {
      models.push({
        name: `models/${comboName}`,
        displayName: comboName,
        description: `combo model: ${comboName}`,
        supportedGenerationMethods: ["generateContent", "countTokens"],
        inputTokenLimit: 128000,
        outputTokenLimit: 8192,
      });
    }

    const seenAliasNames = new Set();
    for (const [alias, fullModel] of Object.entries(aliases || {})) {
      const normalizedAlias = String(alias || "").trim();
      if (!normalizedAlias || visibleComboNameSet.has(normalizedAlias) || seenAliasNames.has(normalizedAlias)) continue;
      const combo = combos.find((item) => item?.name === fullModel);
      if (!combo || combo.showInModelsEndpoint === false || hiddenModels.includes(combo.name)) continue;
      seenAliasNames.add(normalizedAlias);
      models.push({
        name: `models/${normalizedAlias}`,
        displayName: normalizedAlias,
        description: `alias for combo: ${combo.name}`,
        supportedGenerationMethods: ["generateContent", "countTokens"],
        inputTokenLimit: 128000,
        outputTokenLimit: 8192,
      });
    }

    models.sort((left, right) => String(left.name).localeCompare(String(right.name)));

    return Response.json({ models }, {
      headers: buildCorsHeaders(),
    });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json({ error: { message: error.message } }, {
      status: 500,
      headers: buildCorsHeaders(),
    });
  }
}

