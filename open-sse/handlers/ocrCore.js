/**
 * OCR handler — Mistral OCR API format (POST /v1/ocr).
 * OmniRoute: open-sse/handlers/ocr.ts
 */

import { createErrorResult } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";

const OCR_PROVIDERS = {
  mistral: {
    baseUrl: "https://api.mistral.ai/v1/ocr",
    models: ["mistral-ocr-latest", "mistral-ocr-2503"],
  },
};

export function parseOcrModel(model) {
  const raw = String(model || "").trim();
  if (!raw) return { provider: "mistral", model: "mistral-ocr-latest" };
  if (raw.includes("/")) {
    const [provider, ...rest] = raw.split("/");
    return { provider, model: rest.join("/") || "mistral-ocr-latest" };
  }
  if (raw.startsWith("mistral")) return { provider: "mistral", model: raw };
  return { provider: "mistral", model: raw };
}

export function getOcrProvider(providerId) {
  return OCR_PROVIDERS[providerId] || null;
}

/**
 * @param {object} options
 * @param {object} options.body
 * @param {object} options.credentials
 * @param {object} [options.log]
 */
export async function handleOcrCore({ body, credentials, log }) {
  if (!body?.document) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "document is required");
  }

  const model = body.model || "mistral-ocr-latest";
  const { provider: providerId, model: modelId } = parseOcrModel(model);
  const providerConfig = getOcrProvider(providerId);

  if (!providerConfig) {
    return createErrorResult(
      HTTP_STATUS.BAD_REQUEST,
      `No OCR provider found for model "${model}". Available: mistral`
    );
  }

  const token = credentials?.apiKey || credentials?.accessToken;
  if (!token) {
    return createErrorResult(
      HTTP_STATUS.UNAUTHORIZED,
      `No credentials for OCR provider: ${providerId}`
    );
  }

  try {
    log?.debug?.("OCR", `${providerId} | ${modelId}`);
    const res = await fetch(providerConfig.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...body,
        model: modelId,
      }),
    });

    const text = await res.text();
    return {
      success: res.ok,
      response: new Response(text, {
        status: res.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }),
      status: res.status,
    };
  } catch (err) {
    return createErrorResult(
      HTTP_STATUS.BAD_GATEWAY,
      `OCR request failed: ${err.message || String(err)}`
    );
  }
}
