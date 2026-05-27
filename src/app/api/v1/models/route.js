import { getCombos, getSettings } from "@/lib/localDb";

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
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
    try {
      const [comboList, settings] = await Promise.all([getCombos(), getSettings()]);
      combos = comboList;
      hiddenModels = Array.isArray(settings?.hiddenModels) ? settings.hiddenModels : [];
    } catch {
      console.log("Could not fetch combos");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const models = combos
      .filter((combo) => combo?.showInModelsEndpoint !== false && !hiddenModels.includes(combo?.name))
      .map((combo) => ({
        id: combo.name,
        object: "model",
        created: timestamp,
        owned_by: "combo",
        permission: [],
        root: combo.name,
        parent: null,
      }));

    return Response.json({
      object: "list",
      data: models,
    }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.log("Error fetching models:", error);
    return Response.json(
      { error: { message: error.message, type: "server_error" } },
      { status: 500 }
    );
  }
}
