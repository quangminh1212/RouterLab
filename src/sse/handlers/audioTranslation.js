import {
  getProviderCredentials,
  extractApiKey,
  isValidApiKey,
} from "../services/auth.js";
import { getSettings } from "@/lib/localDb";
import { handleAudioTranslationCore } from "open-sse/handlers/audioTranslationCore.js";
import { errorResponse } from "open-sse/utils/error.js";
import { HTTP_STATUS } from "open-sse/config/runtimeConfig.js";

/**
 * POST /v1/audio/translations — OpenAI Whisper translate-to-English (OmniRoute parity).
 */
export async function handleAudioTranslation(request) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Expected multipart/form-data");
  }

  const apiKey = extractApiKey(request);
  const settings = await getSettings();
  if (settings.requireApiKey) {
    if (!apiKey) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Missing API key");
    const valid = await isValidApiKey(apiKey);
    if (!valid) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key");
  }

  const model = formData.get("model");
  const modelStr = typeof model === "string" ? model : "whisper-1";
  const provider = modelStr.includes("/") ? modelStr.split("/")[0] : "openai";

  let credentials = await getProviderCredentials(provider, new Set(), modelStr);
  if (!credentials || credentials.allRateLimited) {
    const auth = request.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) {
      credentials = { apiKey: m[1].trim() };
    } else {
      return errorResponse(
        HTTP_STATUS.BAD_REQUEST,
        `No credentials for translation provider: ${provider}`
      );
    }
  }

  const result = await handleAudioTranslationCore({ formData, credentials });
  if (result?.response) return result.response;
  return errorResponse(result?.status || 500, result?.error || "Translation failed");
}
