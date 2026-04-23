import { createErrorResult, parseUpstreamError, formatProviderError } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";
import { refreshWithRetry } from "../services/tokenRefresh.js";
import { getExecutor } from "../executors/index.js";

// STT provider configurations
const STT_PROVIDERS = {
  deepgram: {
    baseUrl: "https://api.deepgram.com/v1/listen",
    format: "deepgram",
  },
  assemblyai: {
    baseUrl: "https://api.assemblyai.com/v2/transcript",
    format: "assemblyai",
  },
};

/**
 * Build STT URL
 */
function buildSttUrl(provider, model, credentials) {
  const config = STT_PROVIDERS[provider];
  if (!config) return null;

  switch (provider) {
    case "deepgram":
      return `${config.baseUrl}?model=${model || "nova-2"}`;
    default:
      return config.baseUrl;
  }
}

/**
 * Build request headers
 */
function buildSttHeaders(provider, credentials) {
  const apiToken = credentials?.apiKey || credentials?.accessToken;
  if (!apiToken) return {};

  if (provider === "assemblyai") {
    return {
      Authorization: apiToken,
    };
  }

  return {
    Authorization: `Token ${apiToken}`,
  };
}

/**
 * Build request body based on provider format
 */
function buildSttBody(provider, body) {
  const { file, url, language } = body;

  switch (provider) {
    case "assemblyai":
      return {
        audio_url: url,
        language_code: language || "en",
      };

    case "deepgram":
      // Deepgram uses audio file in body or URL param
      if (url) {
        return { url };
      }
      return file; // Binary audio data

    default:
      return { file, url, language };
  }
}

/**
 * Normalize response to standard format
 */
function normalizeSttResponse(responseBody, provider) {
  // Already in standard format
  if (responseBody.text) {
    return responseBody;
  }

  switch (provider) {
    case "deepgram": {
      const transcript = responseBody.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
      return {
        text: transcript,
        language: responseBody.results?.channels?.[0]?.detected_language,
      };
    }

    case "assemblyai": {
      // AssemblyAI returns a job ID first, then needs polling
      if (responseBody.id && !responseBody.text) {
        return {
          text: "",
          status: responseBody.status,
          id: responseBody.id,
        };
      }
      return {
        text: responseBody.text || "",
        language: responseBody.language_code,
      };
    }

    default:
      return responseBody;
  }
}

/**
 * Core STT handler
 * @param {object} options
 * @param {object} options.body - Request body { model, file, url, language, ... }
 * @param {object} options.modelInfo - { provider, model }
 * @param {object} options.credentials - Provider credentials
 * @param {object} [options.log] - Logger
 * @param {function} [options.onCredentialsRefreshed] - Called when creds are refreshed
 * @param {function} [options.onRequestSuccess] - Called on success
 * @returns {Promise<{ success: boolean, response: Response, status?: number, error?: string }>}
 */
export async function handleSttCore({
  body,
  modelInfo,
  credentials,
  log,
  onCredentialsRefreshed,
  onRequestSuccess,
}) {
  const { provider, model } = modelInfo;

  if (!body.file && !body.url) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "Missing required field: file or url");
  }

  const url = buildSttUrl(provider, model, credentials);
  if (!url) {
    return createErrorResult(
      HTTP_STATUS.BAD_REQUEST,
      `Provider '${provider}' does not support STT`
    );
  }

  const headers = buildSttHeaders(provider, credentials);
  const requestBody = buildSttBody(provider, body);

  log?.debug?.("STT", `${provider.toUpperCase()} | ${model} | ${body.url ? `url=${body.url.slice(0, 50)}` : "file upload"}`);

  let providerResponse;
  try {
    // Deepgram with URL uses JSON body
    if (provider === "deepgram" && body.url) {
      headers["Content-Type"] = "application/json";
      providerResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
    } else if (provider === "deepgram" && body.file) {
      // Deepgram with file uses binary body
      headers["Content-Type"] = "audio/wav";
      providerResponse = await fetch(url, {
        method: "POST",
        headers,
        body: body.file,
      });
    } else {
      // AssemblyAI and others use JSON
      headers["Content-Type"] = "application/json";
      providerResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
    }
  } catch (error) {
    const errMsg = formatProviderError(error, provider, model, HTTP_STATUS.BAD_GATEWAY);
    log?.debug?.("STT", `Fetch error: ${errMsg}`);
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, errMsg);
  }

  // Handle 401/403 — try token refresh
  const executor = getExecutor(provider);
  if (
    !executor?.noAuth &&
    (providerResponse.status === HTTP_STATUS.UNAUTHORIZED ||
      providerResponse.status === HTTP_STATUS.FORBIDDEN)
  ) {
    const newCredentials = await refreshWithRetry(
      () => executor.refreshCredentials(credentials, log),
      3,
      log
    );

    if (newCredentials?.accessToken || newCredentials?.apiKey) {
      log?.info?.("TOKEN", `${provider.toUpperCase()} | refreshed for STT`);
      Object.assign(credentials, newCredentials);
      if (onCredentialsRefreshed && newCredentials) {
        await onCredentialsRefreshed(newCredentials);
      }

      // Retry with refreshed credentials
      const retryHeaders = buildSttHeaders(provider, credentials);
      try {
        if (provider === "deepgram" && body.url) {
          retryHeaders["Content-Type"] = "application/json";
          providerResponse = await fetch(url, {
            method: "POST",
            headers: retryHeaders,
            body: JSON.stringify(requestBody),
          });
        } else if (provider === "deepgram" && body.file) {
          retryHeaders["Content-Type"] = "audio/wav";
          providerResponse = await fetch(url, {
            method: "POST",
            headers: retryHeaders,
            body: body.file,
          });
        } else {
          retryHeaders["Content-Type"] = "application/json";
          providerResponse = await fetch(url, {
            method: "POST",
            headers: retryHeaders,
            body: JSON.stringify(requestBody),
          });
        }
      } catch (error) {
        const errMsg = formatProviderError(error, provider, model, HTTP_STATUS.BAD_GATEWAY);
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, errMsg);
      }
    }
  }

  // Handle non-2xx response
  if (!providerResponse.ok) {
    const { statusCode, message } = await parseUpstreamError(providerResponse);
    log?.debug?.("STT", `Provider error: ${statusCode} ${message}`);
    return createErrorResult(statusCode, message);
  }

  // Parse and normalize response
  let responseBody;
  try {
    responseBody = await providerResponse.json();
  } catch (error) {
    log?.debug?.("STT", `Failed to parse response: ${error.message}`);
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, "Invalid JSON response from provider");
  }

  const normalizedResponse = normalizeSttResponse(responseBody, provider);

  // Call success callback
  if (onRequestSuccess) {
    await onRequestSuccess();
  }

  return {
    success: true,
    response: new Response(JSON.stringify(normalizedResponse), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }),
  };
}
