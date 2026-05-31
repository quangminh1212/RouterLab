import { DefaultExecutor } from "./default.js";

/**
 * BedrockExecutor — Amazon Bedrock via its OpenAI-compatible Chat Completions API.
 *
 * Uses the modern Bedrock API key (Bearer token) auth on the bedrock-runtime
 * endpoint, so no AWS SigV4 signing is required:
 *   https://bedrock-runtime.{region}.amazonaws.com/openai/v1/chat/completions
 *
 * Region comes from providerSpecificData.region (or AWS_REGION / BEDROCK_REGION
 * env), defaulting to us-east-1. The API key is a Bedrock bearer token
 * (AWS_BEARER_TOKEN_BEDROCK). Model ids use Bedrock's namespaced form, e.g.
 * "us.anthropic.claude-sonnet-4-6" or "openai.gpt-oss-120b".
 */
export class BedrockExecutor extends DefaultExecutor {
  constructor() {
    super("bedrock");
  }

  resolveRegion(credentials) {
    return (
      credentials?.providerSpecificData?.region ||
      process.env.BEDROCK_REGION ||
      process.env.AWS_REGION ||
      "us-east-1"
    );
  }

  resolveBaseUrl(credentials) {
    // Allow a full custom base URL override (e.g. bedrock-mantle or VPC endpoint).
    const custom = credentials?.providerSpecificData?.baseUrl;
    if (custom) return custom.replace(/\/$/, "");
    const region = this.resolveRegion(credentials);
    return `https://bedrock-runtime.${region}.amazonaws.com/openai/v1`;
  }

  buildUrl(_model, _stream, _urlIndex = 0, credentials = null) {
    return `${this.resolveBaseUrl(credentials)}/chat/completions`;
  }

  buildHeaders(credentials, stream = true) {
    const headers = { "Content-Type": "application/json", ...this.config.headers };
    const key = credentials?.apiKey || credentials?.accessToken || process.env.AWS_BEARER_TOKEN_BEDROCK;
    if (key) headers["Authorization"] = `Bearer ${key}`;

    // Optional Bedrock Guardrails passthrough from providerSpecificData.
    const psd = credentials?.providerSpecificData || {};
    if (psd.guardrailIdentifier) {
      headers["X-Amzn-Bedrock-GuardrailIdentifier"] = psd.guardrailIdentifier;
      if (psd.guardrailVersion) headers["X-Amzn-Bedrock-GuardrailVersion"] = psd.guardrailVersion;
      if (psd.guardrailTrace) headers["X-Amzn-Bedrock-Trace"] = psd.guardrailTrace;
    }

    if (stream) headers["Accept"] = "text/event-stream";
    return headers;
  }

  transformRequest(model, body) {
    return body;
  }
}

export default BedrockExecutor;
