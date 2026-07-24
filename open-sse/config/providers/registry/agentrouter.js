/** Provider module: agentrouter (RouterLab registry — OmniRoute-style) */
import { CLAUDE_CLI_SPOOF_HEADERS } from "../_shared.js";

export const id = "agentrouter";
export default { baseUrl: "https://agentrouter.org/v1/messages", format: "claude", headers: { ...CLAUDE_CLI_SPOOF_HEADERS } };
