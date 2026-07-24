/** Provider module: minimax (RouterLab registry — OmniRoute-style) */
import { CLAUDE_API_HEADERS } from "../_shared.js";

export const id = "minimax";
export default {
    baseUrl: "https://api.minimax.io/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  };
