import { GithubExecutor } from "./github.js";

/**
 * GitHub Enterprise Copilot chat proxy.
 * OmniRoute: open-sse/executors/ghe-copilot.ts (simplified)
 */
export class GheCopilotExecutor extends GithubExecutor {
  constructor() {
    super();
    this.provider = "ghe-copilot";
  }

  stripPrefix(model) {
    return typeof model === "string" && model.startsWith("ghe-copilot/")
      ? model.slice("ghe-copilot/".length)
      : model;
  }

  getChatCompletionsBase(credentials) {
    const psd = credentials?.providerSpecificData || {};
    const apiOrProxy =
      (typeof psd.copilotApiUrl === "string" ? psd.copilotApiUrl : undefined) ||
      (typeof psd.copilotProxyUrl === "string" ? psd.copilotProxyUrl : undefined);
    if (apiOrProxy) {
      const base = apiOrProxy.replace(/\/+$/, "");
      return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
    }
    const gheUrl = psd.gheUrl;
    if (!gheUrl) {
      // Fall back to public Copilot API host when enterprise URL not set
      return "https://api.githubcopilot.com/chat/completions";
    }
    const base = String(gheUrl).replace(/\/$/, "");
    return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    void model;
    void stream;
    void urlIndex;
    return this.getChatCompletionsBase(credentials);
  }

  transformRequest(model, body, stream, credentials) {
    const bare = this.stripPrefix(model);
    const transformed = super.transformRequest(bare, body, stream, credentials);
    if (transformed && typeof transformed === "object" && !Array.isArray(transformed)) {
      return { ...transformed, model: bare };
    }
    return transformed;
  }
}

export default GheCopilotExecutor;
