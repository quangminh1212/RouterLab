/** Provider module: anthropic (RouterLab registry — OmniRoute-style) */
import { CLAUDE_API_HEADERS } from "../_shared.js";

export const id = "anthropic";
export default {
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  };
