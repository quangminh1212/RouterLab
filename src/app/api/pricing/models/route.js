import { NextResponse } from "next/server";

import { getCustomModels, getPricing } from "@/lib/localDb.js";
import { AI_PROVIDERS } from "@/shared/constants/providers.js";
import { PROVIDER_ID_TO_ALIAS, getModelsByProviderId } from "open-sse/config/providerModels.js";

function providerLabel(providerId) {
  return AI_PROVIDERS[providerId]?.name || providerId;
}

function ensureCatalogEntry(catalog, providerId) {
  if (!catalog[providerId]) {
    const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
    catalog[providerId] = {
      id: providerId,
      alias,
      name: providerLabel(providerId),
      models: [],
    };
  }
  return catalog[providerId];
}

function appendModel(bucket, model, custom) {
  const modelId = typeof model?.id === "string" ? model.id : "";
  if (!modelId || bucket.models.some((item) => item.id === modelId)) return;
  bucket.models.push({
    id: modelId,
    name: typeof model?.name === "string" && model.name.trim() ? model.name : modelId,
    custom,
  });
}

export async function GET() {
  try {
    const catalog = {};

    for (const providerId of Object.keys(AI_PROVIDERS)) {
      const bucket = ensureCatalogEntry(catalog, providerId);
      for (const model of getModelsByProviderId(providerId)) {
        appendModel(bucket, model, false);
      }
    }

    const customModels = await getCustomModels().catch(() => []);
    for (const model of customModels) {
      const providerId = String(model?.providerAlias || "").trim();
      if (!providerId) continue;
      const bucket = ensureCatalogEntry(catalog, providerId);
      appendModel(bucket, model, true);
    }

    const pricing = await getPricing().catch(() => ({}));
    for (const [providerId, models] of Object.entries(pricing || {})) {
      if (!models || typeof models !== "object" || Array.isArray(models)) continue;
      const bucket = ensureCatalogEntry(catalog, providerId);
      for (const modelId of Object.keys(models)) {
        appendModel(bucket, { id: modelId, name: modelId }, true);
      }
    }

    for (const entry of Object.values(catalog)) {
      entry.modelCount = entry.models.length;
      entry.models.sort((left, right) => String(left.id).localeCompare(String(right.id)));
    }

    return NextResponse.json(catalog);
  } catch (error) {
    console.error("Error fetching pricing model catalog:", error);
    return NextResponse.json({ error: "Failed to fetch model catalog" }, { status: 500 });
  }
}
