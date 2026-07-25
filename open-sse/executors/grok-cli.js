import { DefaultExecutor } from "./default.js";

/**
 * Grok Build CLI — OpenAI-compatible chat with reasoning_effort cleanup.
 * Full Responses-API wire from 9router/Omni is large; this covers the common
 * chat/completions path + model effort suffixes (parity for catalog use).
 */
const EFFORT_SUFFIXES = ["low", "medium", "high", "xhigh"];

export class GrokCliExecutor extends DefaultExecutor {
  constructor() {
    super("grok-cli");
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    const fromCreds = credentials?.providerSpecificData?.baseUrl;
    if (typeof fromCreds === "string" && fromCreds.trim()) {
      const n = fromCreds.trim().replace(/\/$/, "");
      if (/\/(chat\/completions|responses)$/i.test(n)) return n;
      return `${n}/chat/completions`;
    }
    return (
      this.config.baseUrl ||
      "https://api.x.ai/v1/chat/completions"
    );
  }

  transformRequest(model, body, stream, credentials) {
    const transformed = super.transformRequest(model, body, stream, credentials);
    if (!transformed || typeof transformed !== "object") return transformed;
    const out = { ...transformed };
    let modelId = typeof out.model === "string" ? out.model : model;

    for (const level of EFFORT_SUFFIXES) {
      const suffix = `-${level}`;
      if (modelId.endsWith(suffix)) {
        out.model = modelId.slice(0, -suffix.length);
        if (!out.reasoning_effort) out.reasoning_effort = level;
        break;
      }
    }
    return out;
  }
}

export default GrokCliExecutor;
