/** Provider module: minimax-cn (RouterLab registry — OmniRoute-style) */
import { CLAUDE_API_HEADERS } from "../_shared.js";

export const id = "minimax-cn";
export default {
    baseUrl: "https://api.minimaxi.com/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  };
