/**
 * Audio Translation — POST /v1/audio/translations (Whisper translate-to-English).
 * OmniRoute: open-sse/handlers/audioTranslation.ts
 */

import { createErrorResult } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";

const DEFAULT_TRANSLATION_URL = "https://api.openai.com/v1/audio/translations";

/**
 * @param {object} options
 * @param {FormData} options.formData
 * @param {object} options.credentials
 * @param {string} [options.baseUrl]
 * @param {object} [options.log]
 */
export async function handleAudioTranslationCore({
  formData,
  credentials,
  baseUrl = null,
  log,
}) {
  const model = formData.get("model");
  if (typeof model !== "string" || !model.trim()) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "model is required");
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof Blob)) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "file is required");
  }

  const token = credentials?.apiKey || credentials?.accessToken;
  if (!token) {
    return createErrorResult(HTTP_STATUS.UNAUTHORIZED, "API key required for audio translations");
  }

  const fromCreds = credentials?.providerSpecificData?.baseUrl;
  let url = baseUrl || DEFAULT_TRANSLATION_URL;
  if (!baseUrl && typeof fromCreds === "string" && fromCreds.trim()) {
    const root = fromCreds.trim().replace(/\/$/, "").replace(/\/v1$/i, "");
    url = `${root}/v1/audio/translations`;
  }

  // Rebuild FormData for upstream (OpenAI Whisper translate schema — no language field)
  const upstream = new FormData();
  upstream.append("file", fileEntry, fileEntry.name || "audio.mp3");
  upstream.append("model", model.trim());
  for (const key of ["prompt", "response_format", "temperature"]) {
    const v = formData.get(key);
    if (v != null && v !== "") upstream.append(key, String(v));
  }

  try {
    log?.debug?.("STT-TRANSLATE", `→ ${url} model=${model}`);
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: upstream,
    });
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    return {
      success: res.ok,
      response: new Response(text, {
        status: res.status,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        },
      }),
      status: res.status,
    };
  } catch (err) {
    return createErrorResult(
      HTTP_STATUS.BAD_GATEWAY,
      `Audio translation failed: ${err.message || String(err)}`
    );
  }
}
