import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";

/**
 * Kie.ai OpenAI-compatible gateway.
 * OmniRoute: open-sse/executors/kie.ts
 */
export class KieExecutor extends BaseExecutor {
  constructor() {
    super("kie", PROVIDERS.kie || { format: "openai" });
  }

  buildUrl(_model, _stream, urlIndex = 0, credentials = null) {
    const fromCreds = credentials?.providerSpecificData?.baseUrl;
    if (typeof fromCreds === "string" && fromCreds.trim()) {
      const n = fromCreds.trim().replace(/\/$/, "");
      if (/\/chat\/completions$/i.test(n)) return n;
      return `${n}/chat/completions`;
    }
    const baseUrls = this.getBaseUrls();
    return (
      baseUrls[urlIndex] ||
      baseUrls[0] ||
      this.config.baseUrl ||
      "https://api.kie.ai/v1/chat/completions"
    );
  }

  buildHeaders(credentials, stream = true) {
    const key = credentials?.apiKey || credentials?.accessToken;
    const headers = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (stream) headers.Accept = "text/event-stream";
    return headers;
  }
}

export default KieExecutor;
