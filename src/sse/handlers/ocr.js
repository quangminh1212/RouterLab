import {
  getProviderCredentials,
  extractApiKey,
  isValidApiKey,
} from "../services/auth.js";
import { getSettings } from "@/lib/localDb";
import { handleOcrCore, parseOcrModel } from "open-sse/handlers/ocrCore.js";
import { errorResponse } from "open-sse/utils/error.js";
import { HTTP_STATUS } from "open-sse/config/runtimeConfig.js";

/**
 * POST /v1/ocr — Mistral OCR compatible (OmniRoute parity).
 */
export async function handleOcr(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "Invalid JSON body");
  }

  const apiKey = extractApiKey(request);
  const settings = await getSettings();
  if (settings.requireApiKey) {
    if (!apiKey) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Missing API key");
    const valid = await isValidApiKey(apiKey);
    if (!valid) return errorResponse(HTTP_STATUS.UNAUTHORIZED, "Invalid API key");
  }

  if (!body?.document) {
    return errorResponse(HTTP_STATUS.BAD_REQUEST, "document is required");
  }

  const model = body.model || "mistral-ocr-latest";
  const { provider } = parseOcrModel(model);

  const credentials = await getProviderCredentials(provider, new Set(), model);
  if (!credentials || credentials.allRateLimited) {
    // Allow direct bearer as upstream key when no connection configured
    const auth = request.headers.get("authorization") || "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && !settings.requireApiKey) {
      const result = await handleOcrCore({
        body,
        credentials: { apiKey: m[1].trim() },
      });
      if (result?.response) return result.response;
      return errorResponse(result?.status || 500, result?.error || "OCR failed");
    }
    return errorResponse(
      HTTP_STATUS.BAD_REQUEST,
      `No credentials for OCR provider: ${provider}`
    );
  }

  const result = await handleOcrCore({ body, credentials });
  if (result?.response) return result.response;
  return errorResponse(result?.status || 500, result?.error || "OCR failed");
}
