/**
 * Public free model gate — allow chat without XLab API key / login when the
 * requested model (or combo) only uses noAuth free upstream providers.
 * Behavior mirrors 9router free/public routes (Bearer public, no account).
 */
import { isNoAuthProvider } from "@/shared/constants/providers.js";
import { parseModel } from "open-sse/services/model.js";
import { getModelInfo, getComboModels } from "./model.js";

/**
 * @param {object|null|undefined} settings
 * @returns {boolean} default true unless explicitly disabled
 */
export function isPublicFreeModelsEnabled(settings) {
  return settings?.allowPublicFreeModels !== false;
}

/**
 * True when a single model string resolves exclusively to a noAuth provider.
 * @param {string} modelStr
 */
export async function isNoAuthFreeModel(modelStr) {
  if (!modelStr || typeof modelStr !== "string") return false;

  const parsed = parseModel(modelStr);
  if (!parsed.isAlias && parsed.provider && isNoAuthProvider(parsed.provider)) {
    return true;
  }

  try {
    const info = await getModelInfo(modelStr);
    if (info?.provider && isNoAuthProvider(info.provider)) return true;
  } catch {
    // ignore resolution errors — treat as not free-public
  }

  return false;
}

/**
 * True when the request can be served without an XLab API key.
 * - Direct noAuth models: pol/openai, oc/deepseek-v4-flash-free, ...
 * - Combos whose every member is a noAuth free model
 * Disabled when settings.allowPublicFreeModels === false
 *
 * @param {string} modelStr
 * @param {object|null|undefined} settings
 */
export async function isPublicFreeRequest(modelStr, settings) {
  if (!isPublicFreeModelsEnabled(settings)) return false;
  if (!modelStr) return false;

  const comboModels = await getComboModels(modelStr);
  if (comboModels?.length) {
    for (const member of comboModels) {
      if (!(await isNoAuthFreeModel(member))) return false;
    }
    return true;
  }

  return isNoAuthFreeModel(modelStr);
}
