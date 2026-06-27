import { createErrorResult, parseUpstreamError, formatProviderError } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";
import { refreshWithRetry } from "../services/tokenRefresh.js";
import { getExecutor } from "../executors/index.js";
import { getImageEditAdapter } from "./imageEditProviders/index.js";
import { urlToBase64 } from "./imageProviders/_base.js";

export async function handleImageEditsCore({
  body,
  modelInfo,
  credentials,
  log,
  streamToClient = false,
  binaryOutput = false,
  onCredentialsRefreshed,
  onRequestSuccess,
}) {
  const { provider, model } = modelInfo;

  if (!body.image) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "Missing required field: image");
  }
  if (!body.prompt) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "Missing required field: prompt");
  }

  const adapter = getImageEditAdapter(provider);
  if (!adapter) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, `Provider '${provider}' does not support image edits`);
  }

  const url = adapter.buildUrl(model, credentials);
  const headers = adapter.buildHeaders(credentials);
  const requestBody = await Promise.resolve(adapter.buildBody(model, body));
  const isFormData = requestBody instanceof FormData;

  log?.debug?.("IMAGE_EDIT", `${provider.toUpperCase()} | ${model} | prompt="${String(body.prompt).slice(0, 50)}..."`);

  let providerResponse;
  try {
    providerResponse = await fetch(url, {
      method: "POST",
      headers,
      body: isFormData ? requestBody : JSON.stringify(requestBody),
    });
  } catch (error) {
    const errMsg = formatProviderError(error, provider, model, HTTP_STATUS.BAD_GATEWAY);
    log?.debug?.("IMAGE_EDIT", `Fetch error: ${errMsg}`);
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, errMsg);
  }

  const executor = getExecutor(provider);
  if (
    !executor?.noAuth &&
    !adapter.noAuth &&
    (providerResponse.status === HTTP_STATUS.UNAUTHORIZED ||
      providerResponse.status === HTTP_STATUS.FORBIDDEN)
  ) {
    const newCredentials = await refreshWithRetry(
      () => executor.refreshCredentials(credentials, log),
      3,
      log
    );

    if (newCredentials?.accessToken || newCredentials?.apiKey) {
      log?.info?.("TOKEN", `${provider.toUpperCase()} | refreshed for image edits`);
      Object.assign(credentials, newCredentials);
      if (onCredentialsRefreshed) await onCredentialsRefreshed(newCredentials);

      try {
        const retryHeaders = adapter.buildHeaders(credentials);
        const retryUrl = adapter.buildUrl(model, credentials);
        const retryBody = await Promise.resolve(adapter.buildBody(model, body));
        const retryIsFormData = retryBody instanceof FormData;
        providerResponse = await fetch(retryUrl, {
          method: "POST",
          headers: retryHeaders,
          body: retryIsFormData ? retryBody : JSON.stringify(retryBody),
        });
      } catch {
        log?.warn?.("TOKEN", `${provider.toUpperCase()} | retry after refresh failed`);
      }
    } else {
      log?.warn?.("TOKEN", `${provider.toUpperCase()} | refresh failed`);
    }
  }

  if (!providerResponse.ok) {
    const { statusCode, message, resetsAtMs } = await parseUpstreamError(providerResponse);
    const errMsg = formatProviderError(new Error(message), provider, model, statusCode);
    log?.debug?.("IMAGE_EDIT", `Provider error: ${errMsg}`);
    return createErrorResult(statusCode, errMsg, resetsAtMs);
  }

  let parsed;
  try {
    if (adapter.parseResponse) {
      parsed = await adapter.parseResponse(providerResponse, {
        headers,
        log,
        streamToClient,
        onRequestSuccess,
      });
      if (parsed?.sseResponse) {
        return { success: true, response: parsed.sseResponse };
      }
    } else {
      parsed = await providerResponse.json();
    }
  } catch (parseError) {
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, parseError.message || `Invalid response from ${provider}`);
  }

  if (onRequestSuccess) await onRequestSuccess();

  const normalized = adapter.normalize(parsed, body.prompt);
  const finalBody = normalized.created && Array.isArray(normalized.data) ? normalized : parsed;

  if (binaryOutput) {
    const first = finalBody.data?.[0];
    let b64 = first?.b64_json;
    if (!b64 && first?.url) {
      try { b64 = await urlToBase64(first.url); } catch {}
    }
    if (b64) {
      const buf = Buffer.from(b64, "base64");
      const fmt = (body.output_format || "png").toLowerCase();
      const mime = fmt === "jpeg" || fmt === "jpg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
      return {
        success: true,
        response: new Response(buf, {
          headers: {
            "Content-Type": mime,
            "Content-Disposition": `inline; filename="image.${fmt === "jpeg" ? "jpg" : fmt}"`,
            "Access-Control-Allow-Origin": "*",
          },
        }),
      };
    }
  }

  return {
    success: true,
    response: new Response(JSON.stringify(finalBody), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }),
  };
}
