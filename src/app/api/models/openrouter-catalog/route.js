import { NextResponse } from "next/server";
import { getProviderModels } from "open-sse/config/providerModels.js";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

function normalizeLocalModel(model) {
  return {
    id: model.id,
    name: model.name || model.id,
    type: model.type || "llm",
    ...(model.params ? { params: model.params } : {}),
    ...(model.capabilities ? { capabilities: model.capabilities } : {}),
  };
}

function localCatalog(source = "local") {
  const data = getProviderModels("openrouter").map(normalizeLocalModel);
  return {
    object: "list",
    data,
    meta: {
      source,
      count: data.length,
      stale: source !== "fresh",
    },
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "true";

  if (!refresh) {
    return NextResponse.json(localCatalog("local"));
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = await response.json().catch(() => null);
    const data = Array.isArray(body?.data) ? body.data : [];

    if (!response.ok || data.length === 0) {
      return NextResponse.json({
        ...localCatalog("error"),
        meta: {
          ...localCatalog("error").meta,
          error: body?.error?.message || `OpenRouter catalog failed: ${response.status}`,
        },
      });
    }

    return NextResponse.json({
      object: "list",
      data,
      meta: {
        source: "fresh",
        count: data.length,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ...localCatalog("error"),
      meta: {
        ...localCatalog("error").meta,
        error: error.message,
      },
    });
  }
}
