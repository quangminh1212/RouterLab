import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";

const REASONING_ALLOWED = ["grok-4.3", "grok-4.20-0309-reasoning"];
const REASONING_DENIED = ["grok-build-0.1", "grok-4.20-0309-non-reasoning"];
const EFFORT_SUFFIXES = ["low", "medium", "high", "xhigh"];

/**
 * xAI / xai-oauth executor (reasoning_effort suffix + OAuth refresh).
 * OmniRoute: open-sse/executors/xai.ts · CLIProxyAPI Grok Build OAuth
 */
export class XaiExecutor extends BaseExecutor {
  constructor(provider = "xai") {
    super(provider, PROVIDERS[provider] || PROVIDERS.xai || { format: "openai" });
  }

  buildUrl(model) {
    const responsesBase = this.config.responsesBaseUrl;
    if (
      responsesBase &&
      typeof model === "string" &&
      /multi-agent|responses/i.test(model)
    ) {
      return responsesBase;
    }
    return this.config.baseUrl || "https://api.x.ai/v1/chat/completions";
  }

  async refreshCredentials(credentials, log) {
    if (this.provider !== "xai-oauth" || !credentials?.refreshToken) return null;

    try {
      const response = await fetch(
        this.config.tokenUrl || "https://auth.x.ai/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: this.config.clientId || "",
            refresh_token: credentials.refreshToken,
          }),
        }
      );

      if (!response.ok) {
        log?.warn?.("TOKEN_REFRESH", `xAI OAuth refresh failed with status ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (!data.access_token) {
        log?.warn?.("TOKEN_REFRESH", "xAI OAuth refresh response omitted access_token");
        return null;
      }

      const expiresIn = Number(data.expires_in) || 21600;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || credentials.refreshToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    } catch (error) {
      log?.warn?.(
        "TOKEN_REFRESH",
        `xAI OAuth refresh error: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  transformRequest(model, body) {
    if (!body || typeof body !== "object") return body;
    const out = { ...body };
    let modelId = typeof out.model === "string" ? out.model : model;

    let suffixEffort = null;
    for (const level of EFFORT_SUFFIXES) {
      const suffix = `-${level}`;
      if (modelId.endsWith(suffix)) {
        suffixEffort = level;
        modelId = modelId.slice(0, -suffix.length);
        break;
      }
    }
    if (suffixEffort && typeof out.model === "string") {
      out.model = modelId;
    }

    const isDenied = REASONING_DENIED.some((id) => modelId.includes(id));
    const isAllowed = REASONING_ALLOWED.some((id) => modelId.includes(id));

    if (isDenied) {
      delete out.reasoning_effort;
    } else if (isAllowed) {
      const effort = suffixEffort || out.reasoning_effort;
      if (effort) out.reasoning_effort = effort;
    }

    return out;
  }
}

export default XaiExecutor;
