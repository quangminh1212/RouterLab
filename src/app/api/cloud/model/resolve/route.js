import { NextResponse } from "next/server";
import { validateApiKey, getModelAliases, parseBearerToken } from "@/models";

function cloudError(message, status = 400, type = "invalid_request_error") {
  return NextResponse.json({ error: { message, type } }, { status });
}

function hasControlChars(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value || ""));
}

// Resolve model alias to provider/model
export async function POST(request) {
  try {
    const apiKey = parseBearerToken(request.headers.get("Authorization"));
    if (!apiKey) {
      return cloudError("Missing API key", 401, "authentication_error");
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return cloudError("Invalid JSON body");
    }
    const alias = String(body?.alias || "").trim();

    if (!alias) {
      return cloudError("Missing alias");
    }
    if (hasControlChars(alias)) {
      return cloudError("Invalid alias");
    }

    // Validate API key
    const isValid = await validateApiKey(apiKey);
    if (!isValid) {
      return cloudError("Invalid API key", 401, "authentication_error");
    }

    // Get model aliases
    const modelAliases = await getModelAliases();
    const resolved = modelAliases[alias];

    if (resolved) {
      // Parse provider/model
      const firstSlash = resolved.indexOf("/");
      if (firstSlash > 0) {
        const provider = resolved.slice(0, firstSlash).trim();
        const model = resolved.slice(firstSlash + 1).trim();
        if (provider && model && !hasControlChars(provider) && !hasControlChars(model)) {
          return NextResponse.json({
            alias,
            provider,
            model
          });
        }
      }
    }

    // Not found
    return cloudError("Alias not found", 404, "not_found");

  } catch (error) {
    console.log("Model resolve error:", error);
    return cloudError("Internal error", 500, "server_error");
  }
}
