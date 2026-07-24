/** Provider module: kimi-coding (RouterLab registry — OmniRoute-style) */
import { CLAUDE_API_HEADERS, KIMI_CODING_BASE_URL } from "../_shared.js";

export const id = "kimi-coding";
export default {
    baseUrl: KIMI_CODING_BASE_URL,
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS },
    clientId: "17e5f671-d194-4dfb-9706-5516cb48c098",
    tokenUrl: "https://auth.kimi.com/api/oauth/token",
    refreshUrl: "https://auth.kimi.com/api/oauth/token"
  };
