import { DefaultExecutor } from "./default.js";

/**
 * GitLab Duo / GitLab AI gateway.
 * OmniRoute: open-sse/executors/gitlab.ts (simplified OpenAI/Anthropic path)
 */
export class GitlabExecutor extends DefaultExecutor {
  constructor(provider = "gitlab") {
    super(provider);
  }

  buildHeaders(credentials, stream = true) {
    const headers = super.buildHeaders(credentials, stream);
    const token = credentials?.apiKey || credentials?.accessToken;
    // GitLab often expects PRIVATE-TOKEN or Bearer
    if (token) {
      if (credentials?.providerSpecificData?.authStyle === "private-token") {
        delete headers.Authorization;
        headers["PRIVATE-TOKEN"] = token;
      } else {
        headers.Authorization = `Bearer ${token}`;
      }
    }
    return headers;
  }
}

export default GitlabExecutor;
