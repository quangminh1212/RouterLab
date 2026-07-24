/** Provider module: glm (RouterLab registry — OmniRoute-style) */
import { CLAUDE_API_HEADERS } from "../_shared.js";

export const id = "glm";
export default {
    baseUrl: "https://api.z.ai/api/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  };
