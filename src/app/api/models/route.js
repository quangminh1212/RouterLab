import { NextResponse } from "next/server";
import { getModelAliases, setModelAlias } from "@/models";
import { getCombos, getSettings } from "@/lib/localDb";

// GET /api/models - Get models with aliases
export async function GET() {
  try {
    const combos = await getCombos();
    const modelAliases = await getModelAliases();
    const settings = await getSettings();
    const hiddenModels = settings.hiddenModels || [];

    const comboModels = combos
      .filter((combo) => combo?.showInModelsEndpoint !== false)
      .map((combo) => {
        const fullModel = combo.name;
        return {
          provider: "combo",
          model: combo.name,
          name: combo.name,
          fullModel,
          alias: modelAliases[fullModel] || combo.name,
          models: Array.isArray(combo.models) ? combo.models : [],
          kind: combo.kind || null,
        };
      })
      .filter((combo) => !hiddenModels.includes(combo.fullModel));

    return NextResponse.json({ models: comboModels });
  } catch (error) {
    console.log("Error fetching models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}

// PUT /api/models - Update model alias
export async function PUT(request) {
  try {
    const body = await request.json();
    const { model, alias } = body;

    if (!model || !alias) {
      return NextResponse.json({ error: "Model and alias required" }, { status: 400 });
    }

    const modelAliases = await getModelAliases();

    const existingModel = Object.entries(modelAliases).find(
      ([key, val]) => val === alias && key !== model
    );

    if (existingModel) {
      return NextResponse.json({ error: "Alias already in use" }, { status: 400 });
    }

    await setModelAlias(model, alias);

    return NextResponse.json({ success: true, model, alias });
  } catch (error) {
    console.log("Error updating alias:", error);
    return NextResponse.json({ error: "Failed to update alias" }, { status: 500 });
  }
}
