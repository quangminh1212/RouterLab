import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";

/**
 * Catalog-parity executor for providers whose upstream protocol is not
 * OpenAI chat/completions (WS, GraphQL playground, proprietary task APIs).
 * Returns actionable 501 instead of a broken default fetch.
 */
export class SpecialProtocolExecutor extends BaseExecutor {
  /**
   * @param {string} provider
   * @param {string} reason
   */
  constructor(provider, reason) {
    super(provider, PROVIDERS[provider] || { format: "openai" });
    this.reason = reason;
  }

  buildUrl() {
    return `${this.provider}://special-protocol`;
  }

  async execute({ body }) {
    const message =
      this.reason ||
      `Provider '${this.provider}' is registered for catalog parity but its ` +
        "upstream protocol is not fully reverse-engineered yet. " +
        "Use an OpenAI-compatible provider or wait for a specialized executor.";
    const payload = JSON.stringify({
      error: {
        message,
        type: "not_implemented",
        code: "special_protocol_not_implemented",
        provider: this.provider,
      },
    });
    return {
      response: new Response(payload, {
        status: 501,
        headers: { "Content-Type": "application/json" },
      }),
      url: this.buildUrl(),
      headers: {},
      transformedBody: body,
    };
  }
}

export default SpecialProtocolExecutor;
