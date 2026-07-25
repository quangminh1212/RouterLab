import { DefaultExecutor } from "./default.js";

/**
 * Zed Hosted AI.
 * OmniRoute: open-sse/executors/zed-hosted.ts (simplified)
 */
export class ZedHostedExecutor extends DefaultExecutor {
  constructor() {
    super("zed-hosted");
  }

  buildHeaders(credentials, stream = true) {
    const headers = super.buildHeaders(credentials, stream);
    const key = credentials?.apiKey || credentials?.accessToken;
    if (key) headers.Authorization = `Bearer ${key}`;
    return headers;
  }
}

export default ZedHostedExecutor;
