// "auto" zero-config routing — resolves the virtual `auto` provider to the best
// currently-connected provider/model (a lightweight LKGP: Last Known Good
// Provider). Picks the highest-priority active connection and its default model.
import { getProviderConnections } from "@/lib/localDb";
import { getModelsByProviderId } from "open-sse/config/providerModels.js";
import { getProviderAlias } from "@/shared/constants/providers.js";

// In-memory LKGP cache: providerId of the last connection that served OK.
let lastGoodProvider = null;

export function markAutoRouteSuccess(providerId) {
  if (providerId) lastGoodProvider = providerId;
}

export function isAutoModel(modelStr) {
  if (typeof modelStr !== "string") return false;
  const m = modelStr.trim().toLowerCase();
  return m === "auto" || m.startsWith("auto/") || m === "auto:free";
}

// Returns "alias/model" routable string, or null if nothing is connected.
export async function resolveAutoModel(modelStr) {
  // If caller asked auto/<model>, keep the requested model id, just pick a provider.
  let requestedModel = "";
  if (typeof modelStr === "string" && modelStr.includes("/")) {
    requestedModel = modelStr.slice(modelStr.indexOf("/") + 1).trim();
  }

  let connections = [];
  try {
    connections = await getProviderConnections();
  } catch {
    return null;
  }
  const active = (Array.isArray(connections) ? connections : []).filter(
    (c) => c && c.testStatus !== "error" && c.isActive !== false && c.provider,
  );
  if (active.length === 0) return null;

  // Prefer the last-known-good provider, then lowest globalPriority/priority.
  active.sort((a, b) => {
    if (lastGoodProvider) {
      const aLkg = a.provider === lastGoodProvider ? 0 : 1;
      const bLkg = b.provider === lastGoodProvider ? 0 : 1;
      if (aLkg !== bLkg) return aLkg - bLkg;
    }
    const ap = Number(a.globalPriority ?? a.priority ?? 100);
    const bp = Number(b.globalPriority ?? b.priority ?? 100);
    return ap - bp;
  });

  const chosen = active[0];
  const providerId = chosen.provider;
  const alias = getProviderAlias(providerId);

  let model = requestedModel || chosen.defaultModel || "";
  if (!model) {
    const models = getModelsByProviderId(providerId) || [];
    model = models[0]?.id || "";
  }
  if (!model) return null;
  return `${alias}/${model}`;
}
