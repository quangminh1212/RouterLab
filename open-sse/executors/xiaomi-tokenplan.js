import { DefaultExecutor } from "./default.js";

/**
 * Xiaomi Token Plan — dual OpenAI / Anthropic transport.
 * 9router: open-sse/executors/xiaomi-tokenplan.js
 */
export class XiaomiTokenplanExecutor extends DefaultExecutor {
  constructor() {
    super("xiaomi-tokenplan");
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    void model;
    void stream;
    void urlIndex;
    const baseUrl =
      credentials?.providerSpecificData?.baseUrl ||
      this.config.baseUrl ||
      "https://token-plan-sgp.xiaomimimo.com/v1";
    const normalized = String(baseUrl).replace(/\/$/, "");
    if (credentials?.runtimeTransport?.format === "claude") {
      return `${normalized.replace(/\/v1\/?$/, "")}/anthropic/v1/messages`;
    }
    if (/\/chat\/completions$/i.test(normalized)) return normalized;
    return `${normalized}/chat/completions`;
  }
}

export default XiaomiTokenplanExecutor;
