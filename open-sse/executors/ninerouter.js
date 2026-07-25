import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";

const DEFAULT_PORT = 20128;
const DEFAULT_HOST = "127.0.0.1";

/**
 * Chain requests to a local 9router instance.
 * OmniRoute: open-sse/executors/ninerouter.ts (simplified wire)
 */
function resolveBaseUrl(credentials) {
  const fromCreds = credentials?.providerSpecificData?.baseUrl;
  if (typeof fromCreds === "string" && fromCreds.trim()) {
    return fromCreds.trim().replace(/\/+$/, "");
  }
  const host = process.env.NINEROUTER_HOST || DEFAULT_HOST;
  const port = parseInt(process.env.NINEROUTER_PORT || String(DEFAULT_PORT), 10);
  return `http://${host}:${port}`;
}

function isAnthropicShape(body) {
  if (!body || typeof body !== "object") return false;
  if (body.system !== undefined) return true;
  if (body.thinking !== undefined) return true;
  if (
    body.metadata &&
    typeof body.metadata === "object" &&
    body.metadata.user_id !== undefined
  ) {
    return true;
  }
  const msgs = body.messages;
  if (Array.isArray(msgs) && msgs.length > 0) {
    const first = msgs[0];
    if (Array.isArray(first?.content)) return true;
  }
  return false;
}

export class NineRouterExecutor extends BaseExecutor {
  constructor() {
    super("9router", PROVIDERS["9router"] || { format: "openai" });
  }

  buildUrl(_model, _stream, _urlIndex = 0, credentials = null) {
    const base = resolveBaseUrl(credentials);
    // Default OpenAI path; execute overrides for Anthropic body shape.
    if (/\/(chat\/completions|messages)$/i.test(base)) return base;
    if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
    return `${base}/v1/chat/completions`;
  }

  buildHeaders(credentials, stream = true) {
    const key = credentials?.apiKey || credentials?.accessToken;
    const headers = { "Content-Type": "application/json" };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (stream) headers.Accept = "text/event-stream";
    return headers;
  }

  async execute(input) {
    const base = resolveBaseUrl(input.credentials);
    const path = isAnthropicShape(input.body)
      ? "/v1/messages"
      : "/v1/chat/completions";
    const root = base.replace(/\/v1(?:\/.*)?$/i, "");
    const url = `${root}${path}`;

    // Temporarily pin baseUrl for super.execute path selection
    const prev = this.config.baseUrl;
    this.config = { ...this.config, baseUrl: url, baseUrls: [url] };
    try {
      return await super.execute(input);
    } finally {
      this.config = { ...this.config, baseUrl: prev };
    }
  }
}

export default NineRouterExecutor;
