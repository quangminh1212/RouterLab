// Shared helpers for Amp CLI provider-scoped routes:
//   /api/provider/{provider}/v1/chat/completions
//   /api/provider/{provider}/v1/messages
//   /api/provider/{provider}/v1beta/models[/*action]
//
// These let Amp CLI (and similar tools) target a specific upstream provider by
// URL, with optional model-mappings (from -> to) applied from settings.
import { resolveProviderId } from "@/shared/constants/providers.js";
import { getSettings } from "@/lib/localDb.js";

export function ampCors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export function ampError(message, status = 400, type = "invalid_request_error") {
  return Response.json({ error: { message, type } }, { status, headers: ampCors() });
}

// Apply settings.ampModelMappings (array of { from, to, regex? }) to a model id.
function applyModelMappings(model, mappings) {
  if (!Array.isArray(mappings) || !model) return model;
  for (const m of mappings) {
    if (!m || typeof m !== "object") continue;
    const from = String(m.from || "");
    const to = String(m.to || "");
    if (!from || !to) continue;
    if (m.regex) {
      try {
        const re = new RegExp(from);
        if (re.test(model)) return model.replace(re, to);
      } catch { /* ignore bad regex */ }
    } else if (model === from) {
      return to;
    }
  }
  return model;
}

/**
 * Rewrite a request body's `model` so it routes to the URL-scoped provider.
 * If the model already carries a provider prefix it is preserved unless
 * forceProviderPrefix is set; otherwise `{providerId}/{model}` is applied.
 */
export async function buildScopedBody(providerParam, body) {
  const providerId = resolveProviderId(String(providerParam || "").trim());
  const settings = await getSettings().catch(() => ({}));
  const mappings = Array.isArray(settings?.ampModelMappings) ? settings.ampModelMappings : [];
  const force = settings?.ampForceModelMappings === true;

  const next = { ...body };
  let model = String(next.model || "").trim();
  model = applyModelMappings(model, mappings);

  if (model) {
    const hasPrefix = model.includes("/");
    if (!hasPrefix || force) {
      const bare = hasPrefix ? model.slice(model.indexOf("/") + 1) : model;
      model = `${providerId}/${bare}`;
    }
  } else {
    model = providerId; // let combo/default resolution handle it
  }
  next.model = model;
  return { providerId, body: next };
}
