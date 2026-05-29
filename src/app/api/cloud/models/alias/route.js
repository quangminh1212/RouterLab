import { NextResponse } from "next/server";
import { validateApiKey, getModelAliases, setModelAlias, parseBearerToken } from "@/models";

function cloudError(message, status = 400, type = "invalid_request_error") {
  return NextResponse.json({ error: { message, type } }, { status });
}

function sortAliases(aliases) {
  return Object.fromEntries(Object.entries(aliases || {}).sort(([left], [right]) => String(left).localeCompare(String(right))));
}

// PUT /api/cloud/models/alias - Set model alias (for cloud/CLI)
export async function PUT(request) {
  try {
    const apiKey = parseBearerToken(request.headers.get("authorization"));

    if (!apiKey) {
      return cloudError("Missing API key", 401, "authentication_error");
    }

    const isValid = await validateApiKey(apiKey);
    if (!isValid) {
      return cloudError("Invalid API key", 401, "authentication_error");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return cloudError("Invalid JSON body");
    }
    const model = String(body?.model || "").trim();
    const alias = String(body?.alias || "").trim();

    if (!model || !alias) {
      return cloudError("Model and alias required");
    }
    if (model === alias) {
      return cloudError("Model and alias must be different");
    }

    // Check if alias already exists for different model
    const aliases = await getModelAliases();
    const existingModel = aliases[alias];
    if (existingModel && existingModel !== model) {
      return cloudError(`Alias '${alias}' already in use for model '${existingModel}'`);
    }

    // Update alias
    const updated = await setModelAlias(alias, model);
    if (!updated) {
      return cloudError("Invalid model or alias");
    }

    return NextResponse.json({ 
      success: true, 
      model, 
      alias,
      message: `Alias '${alias}' set for model '${model}'`
    });
  } catch (error) {
    console.log("Error updating alias:", error);
    return cloudError("Failed to update alias", 500, "server_error");
  }
}

// GET /api/cloud/models/alias - Get all aliases
export async function GET(request) {
  try {
    const apiKey = parseBearerToken(request.headers.get("authorization"));

    if (!apiKey) {
      return cloudError("Missing API key", 401, "authentication_error");
    }

    const isValid = await validateApiKey(apiKey);
    if (!isValid) {
      return cloudError("Invalid API key", 401, "authentication_error");
    }

    const aliases = await getModelAliases();

    return NextResponse.json({ aliases: sortAliases(aliases) });
  } catch (error) {
    console.log("Error fetching aliases:", error);
    return cloudError("Failed to fetch aliases", 500, "server_error");
  }
}
