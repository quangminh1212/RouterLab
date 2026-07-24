/** Provider module: qoder (RouterLab registry — OmniRoute-style) */
export const id = "qoder";
export default {
    baseUrl: "https://api.qoder.com/v1/chat/completions",
    format: "openai",
    headers: { "User-Agent": "Qoder-Cli" },
    clientId: process.env.QODER_OAUTH_CLIENT_ID || "10009311001",
    clientSecret: process.env.QODER_OAUTH_CLIENT_SECRET || "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW",
    tokenUrl: "https://api.qoder.com/oauth/token",
    authUrl: "https://qoder.com/oauth/authorize"
  };
