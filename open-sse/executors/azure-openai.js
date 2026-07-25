import { DefaultExecutor } from "./default.js";

const DEFAULT_API_VERSION = "2024-12-01-preview";

function normalizeAzureBaseUrl(rawBaseUrl) {
  const normalized = String(rawBaseUrl || "").trim().replace(/\/+$/, "");
  if (!normalized) return "";
  return normalized
    .replace(/\/openai$/i, "")
    .replace(/\/openai\/deployments\/[^/]+\/chat\/completions[^/]*$/i, "");
}

/**
 * Azure OpenAI deployment-scoped chat completions.
 * OmniRoute: open-sse/executors/azure-openai.ts
 * Also registered as alias for provider id `azure`.
 */
export class AzureOpenAIExecutor extends DefaultExecutor {
  constructor(provider = "azure") {
    super(provider);
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    void stream;
    void urlIndex;
    const providerSpecificData = credentials?.providerSpecificData || {};
    const baseUrl = normalizeAzureBaseUrl(
      providerSpecificData.baseUrl || this.config.baseUrl
    );
    if (!baseUrl) {
      throw new Error(
        "Azure OpenAI requires baseUrl (resource endpoint) in provider settings."
      );
    }
    const apiVersion =
      typeof providerSpecificData.apiVersion === "string" &&
      providerSpecificData.apiVersion.trim()
        ? providerSpecificData.apiVersion.trim()
        : DEFAULT_API_VERSION;
    return `${baseUrl}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  }

  buildHeaders(credentials, stream = true) {
    const apiKey = credentials?.apiKey || credentials?.accessToken || "";
    return {
      "Content-Type": "application/json",
      "api-key": apiKey,
      Accept: stream ? "text/event-stream" : "application/json",
    };
  }
}

export default AzureOpenAIExecutor;
