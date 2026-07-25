import { DefaultExecutor } from "./default.js";

/**
 * Windsurf (Devin CLI / Codeium) device-token style chat.
 * OmniRoute: open-sse/executors/windsurf.ts (simplified default path)
 */
export class WindsurfExecutor extends DefaultExecutor {
  constructor(provider = "windsurf") {
    super(provider);
  }

  buildHeaders(credentials, stream = true) {
    const headers = super.buildHeaders(credentials, stream);
    const token = credentials?.apiKey || credentials?.accessToken;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    headers["X-Client"] = headers["X-Client"] || "routerlab-windsurf";
    return headers;
  }
}

export default WindsurfExecutor;
