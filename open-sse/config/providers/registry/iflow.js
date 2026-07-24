/** Provider module: iflow (RouterLab registry — OmniRoute-style) */
export const id = "iflow";
export default {
    baseUrl: "https://apis.iflow.cn/v1/chat/completions",
    format: "openai",
    headers: { "User-Agent": "iFlow-Cli" },
    clientId: "10009311001",
    clientSecret: "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW",
    tokenUrl: "https://iflow.cn/oauth/token",
    authUrl: "https://iflow.cn/oauth"
  };
