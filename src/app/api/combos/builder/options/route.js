import { NextResponse } from "next/server";
import { getCombos } from "@/lib/localDb";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { getModelsByProviderId } from "open-sse/config/providerModels.js";

const DEFAULT_COMBO_KINDS = ["llm", "embedding", "image", "tts", "stt", "webSearch", "webFetch", "moderation", "rerank"];

function mapProvider(provider) {
  const models = getModelsByProviderId(provider.id) || [];
  const serviceKinds = Array.isArray(provider.serviceKinds) && provider.serviceKinds.length > 0
    ? provider.serviceKinds
    : ["llm"];

  return {
    id: provider.id,
    alias: provider.alias || provider.id,
    name: provider.name || provider.id,
    serviceKinds,
    models: models.map((model) => ({
      id: model.id,
      name: model.name || model.id,
      type: model.type || "llm",
    })),
  };
}

export async function GET() {
  try {
    const combos = await getCombos();
    const providers = Object.values(AI_PROVIDERS).map(mapProvider).sort((a, b) => a.name.localeCompare(b.name));
    const comboKinds = [...new Set([
      ...DEFAULT_COMBO_KINDS,
      ...providers.flatMap((provider) => provider.serviceKinds || []),
      ...combos.map((combo) => combo.kind).filter(Boolean),
    ])].sort();

    return NextResponse.json({
      providers,
      comboKinds,
      existingCombos: combos.map((combo) => ({
        id: combo.id,
        name: combo.name,
        kind: combo.kind || null,
        strategy: combo.strategy || "priority",
        models: Array.isArray(combo.models) ? combo.models : [],
      })),
    });
  } catch (error) {
    console.log("Error fetching combo builder options:", error);
    return NextResponse.json({ error: "Failed to fetch combo builder options" }, { status: 500 });
  }
}
