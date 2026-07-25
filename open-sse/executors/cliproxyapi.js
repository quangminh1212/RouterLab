import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";

const DEFAULT_PORT = 8317;
const DEFAULT_HOST = "127.0.0.1";

/**
 * Chain requests to a local CLIProxyAPI instance (OpenAI-compatible).
 * OmniRoute: open-sse/executors/cliproxyapi.ts (simplified wire)
 */
function resolveBaseUrl(credentials) {
  const fromCreds = credentials?.providerSpecificData?.baseUrl;
  if (typeof fromCreds === "string" && fromCreds.trim()) {
    return fromCreds.trim().replace(/\/+$/, "");
  }
  const host = process.env.CLIPROXYAPI_HOST || DEFAULT_HOST;
  const port = parseInt(process.env.CLIPROXYAPI_PORT || String(DEFAULT_PORT), 10);
  return `http://${host}:${port}`;
}

export class CliproxyapiExecutor extends BaseExecutor {
  constructor() {
    super("cliproxyapi", PROVIDERS.cliproxyapi || { format: "openai" });
  }

  buildUrl(_model, _stream, _urlIndex = 0, credentials = null) {
    const base = resolveBaseUrl(credentials);
    if (/\/(chat\/completions|responses|messages)$/i.test(base)) return base;
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
}

export default CliproxyapiExecutor;
