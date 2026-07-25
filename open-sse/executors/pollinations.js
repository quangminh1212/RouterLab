import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";

const PREMIUM_MODELS = new Set([
  "claude",
  "claude-fast",
  "claude-large",
  "gemini",
  "gemini-fast",
  "midijourney",
  "midijourney-large",
]);

/**
 * Pollinations free + keyed OpenAI-compatible gateway.
 * OmniRoute: open-sse/executors/pollinations.ts (session-pool simplified)
 */
export class PollinationsExecutor extends BaseExecutor {
  constructor() {
    super("pollinations", PROVIDERS.pollinations || { format: "openai" });
  }

  buildUrl(_model, _stream, urlIndex = 0) {
    const baseUrls = this.getBaseUrls();
    return (
      baseUrls[urlIndex] ||
      baseUrls[0] ||
      "https://gen.pollinations.ai/v1/chat/completions"
    );
  }

  buildHeaders(credentials, stream = true) {
    const key = credentials?.apiKey || credentials?.accessToken;
    const headers = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (stream) headers.Accept = "text/event-stream";
    return headers;
  }

  transformRequest(model, body, stream) {
    if (!body || typeof body !== "object") return body;
    const next = { ...body, model, stream };
    const responseFormatType = next.response_format?.type;
    if (responseFormatType === "json_object" || responseFormatType === "json_schema") {
      next.jsonMode = true;
    }
    return next;
  }

  async execute(input) {
    try {
      return await super.execute(input);
    } catch (err) {
      const status = err?.status || err?.statusCode;
      if (status === 401) {
        const model = input.model || "";
        if (PREMIUM_MODELS.has(model)) {
          const enhanced = new Error(
            `Pollinations model "${model}" requires an API key. ` +
              "Free keyless models: openai, openai-fast, openai-large, qwen-coder, mistral, deepseek, grok, gemini-flash-lite-3.1, perplexity-fast, perplexity-reasoning. " +
              "Get a Pollinations API key at https://enter.pollinations.ai and add it in Settings → API Keys."
          );
          enhanced.status = 401;
          enhanced.type = "authentication_error";
          throw enhanced;
        }
      }
      throw err;
    }
  }
}

export default PollinationsExecutor;
