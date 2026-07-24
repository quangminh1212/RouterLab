/** Provider module: claude (RouterLab registry — OmniRoute-style) */
import { CLAUDE_CLI_SPOOF_HEADERS } from "../_shared.js";

export const id = "claude";
export default {
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_CLI_SPOOF_HEADERS },
    clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
    tokenUrl: "https://api.anthropic.com/v1/oauth/token"
  };
