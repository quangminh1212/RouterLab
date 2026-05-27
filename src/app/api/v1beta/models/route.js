import { getCombos, getSettings } from "@/lib/localDb";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  });
}

/**
 * GET /v1beta/models - Gemini compatible models list
 * Returns models in Gemini API format
 */
export async function GET() {
  try {
    const models = [];

    const [combos, settings] = await Promise.all([getCombos(), getSettings()]);
    const hiddenModels = Array.isArray(settings?.hiddenModels) ? settings.hiddenModels : [];
    for (const combo of combos) {
      if (combo?.showInModelsEndpoint === false || hiddenModels.includes(combo?.name)) continue;
      models.push({
        name: `models/${combo.name}`,
        displayName: combo.name,
        description: `combo model: ${combo.name}`,
        supportedGenerationMethods: ["generateContent"],
        inputTokenLimit: 128000,
        outputTokenLimit: 8192,
      });
    }

    return Response.json({ models });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json({ error: { message: error.message } }, { status: 500 });
  }
}

