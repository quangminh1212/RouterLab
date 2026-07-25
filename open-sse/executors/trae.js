import { DefaultExecutor } from "./default.js";

/**
 * Trae Cloud IDE JWT auth chat.
 * OmniRoute: open-sse/executors/trae.ts (simplified)
 */
export class TraeExecutor extends DefaultExecutor {
  constructor() {
    super("trae");
  }

  buildHeaders(credentials, stream = true) {
    const headers = super.buildHeaders(credentials, stream);
    const jwt =
      credentials?.accessToken ||
      credentials?.apiKey ||
      credentials?.providerSpecificData?.cloudIdeJwt;
    if (jwt) {
      headers.Authorization = `Bearer ${jwt}`;
    }
    return headers;
  }
}

export default TraeExecutor;
