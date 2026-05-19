import { createErrorResult, parseUpstreamError, formatProviderError } from "../utils/error.js";
import { HTTP_STATUS } from "../config/runtimeConfig.js";
import { refreshWithRetry } from "../services/tokenRefresh.js";
import { getExecutor } from "../executors/index.js";

// Web search provider configurations
const SEARCH_PROVIDERS = {
  openai: {
    baseUrl: "https://api.openai.com/v1/search",
    format: "openai",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    format: "gemini",
  },
  kimi: {
    baseUrl: "https://api.kimi.moonshot.cn/v1/search",
    format: "openai",
  },
  minimax: {
    baseUrl: "https://api.minimaxi.com/v1/search",
    format: "openai",
  },
  xai: {
    baseUrl: "https://api.x.ai/v1/search",
    format: "openai",
  },
  perplexity: {
    baseUrl: "https://api.perplexity.ai/search",
    format: "openai",
  },
  tavily: {
    baseUrl: "https://api.tavily.com/search",
    format: "tavily",
  },
  "brave-search": {
    baseUrl: "https://api.search.brave.com/res/v1/web/search",
    format: "brave",
  },
  serper: {
    baseUrl: "https://google.serper.dev/search",
    format: "serper",
  },
  exa: {
    baseUrl: "https://api.exa.ai/search",
    format: "exa",
  },
  searxng: {
    baseUrl: "http://localhost:8080/search",
    format: "searxng",
  },
};

/**
 * Build search URL
 */
function buildSearchUrl(provider, model, credentials) {
  const config = SEARCH_PROVIDERS[provider];
  if (!config) return null;

  switch (provider) {
    case "gemini": {
      const apiKey = credentials?.apiKey || credentials?.accessToken;
      const modelId = model.replace(/^models\//, "");
      return `${config.baseUrl}/${modelId}:generateContent?key=${encodeURIComponent(apiKey)}`;
    }
    case "searxng": {
      const baseUrl = credentials?.providerSpecificData?.baseUrl || config.baseUrl;
      return baseUrl.replace(/\/$/, "");
    }
    default:
      return config.baseUrl;
  }
}

/**
 * Build request headers
 */
function buildSearchHeaders(provider, credentials) {
  const headers = { "Content-Type": "application/json" };

  if (provider === "gemini" || provider === "searxng") {
    return headers;
  }

  if (provider === "brave-search") {
    headers["X-Subscription-Token"] = credentials?.apiKey || credentials?.accessToken;
    return headers;
  }

  if (credentials?.apiKey || credentials?.accessToken) {
    headers["Authorization"] = `Bearer ${credentials.apiKey || credentials.accessToken}`;
  }

  return headers;
}

/**
 * Build request body based on provider format
 */
function buildSearchBody(provider, model, body) {
  const { query, max_results = 10 } = body;

  switch (provider) {
    case "gemini":
      return {
        contents: [{ parts: [{ text: query }] }],
        tools: [{ googleSearch: {} }],
      };

    case "tavily":
      return {
        query,
        max_results,
        search_depth: "basic",
        include_answer: true,
      };

    case "brave":
      return null; // Brave uses query params

    case "serper":
      return {
        q: query,
        num: max_results,
      };

    case "exa":
      return {
        query,
        num_results: max_results,
        type: "auto",
      };

    case "searxng":
      return null; // SearXNG uses query params

    default:
      // OpenAI-compatible format
      return { model, query, max_results };
  }
}

/**
 * Normalize response to standard format
 */
function normalizeSearchResponse(responseBody, provider, query) {
  // Already in standard format
  if (Array.isArray(responseBody.results)) {
    return responseBody;
  }

  switch (provider) {
    case "gemini": {
      const parts = responseBody.candidates?.[0]?.content?.parts || [];
      const results = parts
        .filter((p) => p.text)
        .map((p) => ({
          title: query,
          url: "",
          snippet: p.text,
        }));
      return { results };
    }

    case "tavily": {
      const results = (responseBody.results || []).map((r) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.content || "",
      }));
      return { results, answer: responseBody.answer };
    }

    case "brave": {
      const results = (responseBody.web?.results || []).map((r) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.description || "",
      }));
      return { results };
    }

    case "serper": {
      const results = (responseBody.organic || []).map((r) => ({
        title: r.title || "",
        url: r.link || "",
        snippet: r.snippet || "",
      }));
      return { results };
    }

    case "exa": {
      const results = (responseBody.results || []).map((r) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.text || "",
      }));
      return { results };
    }

    case "searxng": {
      const results = (responseBody.results || []).map((r) => ({
        title: r.title || "",
        url: r.url || "",
        snippet: r.content || "",
      }));
      return { results };
    }

    default:
      return responseBody;
  }
}

/**
 * Core web search handler
 * @param {object} options
 * @param {object} options.body - Request body { model, query, max_results, ... }
 * @param {object} options.modelInfo - { provider, model }
 * @param {object} options.credentials - Provider credentials
 * @param {object} [options.log] - Logger
 * @param {function} [options.onCredentialsRefreshed] - Called when creds are refreshed
 * @param {function} [options.onRequestSuccess] - Called on success
 * @returns {Promise<{ success: boolean, response: Response, status?: number, error?: string }>}
 */
export async function handleWebSearchCore({
  body,
  modelInfo,
  credentials,
  log,
  onCredentialsRefreshed,
  onRequestSuccess,
}) {
  const { provider, model } = modelInfo;

  if (!body.query) {
    return createErrorResult(HTTP_STATUS.BAD_REQUEST, "Missing required field: query");
  }

  const url = buildSearchUrl(provider, model, credentials);
  if (!url) {
    return createErrorResult(
      HTTP_STATUS.BAD_REQUEST,
      `Provider '${provider}' does not support web search`
    );
  }

  const headers = buildSearchHeaders(provider, credentials);
  const requestBody = buildSearchBody(provider, model, body);

  log?.debug?.("SEARCH", `${provider.toUpperCase()} | ${model} | query="${body.query.slice(0, 50)}..."`);

  let providerResponse;
  try {
    // Brave and SearXNG use query params
    if (provider === "brave-search") {
      const params = new URLSearchParams({ q: body.query, count: body.max_results || 10 });
      providerResponse = await fetch(`${url}?${params}`, { method: "GET", headers });
    } else if (provider === "searxng") {
      const params = new URLSearchParams({ q: body.query, format: "json" });
      providerResponse = await fetch(`${url}?${params}`, { method: "GET", headers });
    } else {
      providerResponse = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
    }
  } catch (error) {
    const errMsg = formatProviderError(error, provider, model, HTTP_STATUS.BAD_GATEWAY);
    log?.debug?.("SEARCH", `Fetch error: ${errMsg}`);
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
      log?.info?.("TOKEN", `${provider.toUpperCase()} | refreshed for web search`);
      Object.assign(credentials, newCredentials);
      if (onCredentialsRefreshed && newCredentials) {
        await onCredentialsRefreshed(newCredentials);
      }

      // Retry with refreshed credentials
      const retryHeaders = buildSearchHeaders(provider, credentials);
      try {
        if (provider === "brave-search") {
          const params = new URLSearchParams({ q: body.query, count: body.max_results || 10 });
          providerResponse = await fetch(`${url}?${params}`, { method: "GET", headers: retryHeaders });
        } else if (provider === "searxng") {
          const params = new URLSearchParams({ q: body.query, format: "json" });
          providerResponse = await fetch(`${url}?${params}`, { method: "GET", headers: retryHeaders });
        } else {
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
    const { statusCode, message, resetsAtMs } = await parseUpstreamError(providerResponse);
    log?.debug?.("SEARCH", `Provider error: ${statusCode} ${message}`);
    return createErrorResult(statusCode, message, resetsAtMs);
  }

  // Parse and normalize response
  let responseBody;
  try {
    responseBody = await providerResponse.json();
  } catch (error) {
    log?.debug?.("SEARCH", `Failed to parse response: ${error.message}`);
    return createErrorResult(HTTP_STATUS.BAD_GATEWAY, "Invalid JSON response from provider");
  }

  const normalizedResponse = normalizeSearchResponse(responseBody, provider, body.query);

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
