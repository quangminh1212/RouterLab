/** Provider module: kimi (RouterLab registry — OmniRoute-style) */
import { CLAUDE_API_HEADERS, KIMI_CODING_BASE_URL } from "../_shared.js";

export const id = "kimi";
export default {
    baseUrl: KIMI_CODING_BASE_URL,
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  };
