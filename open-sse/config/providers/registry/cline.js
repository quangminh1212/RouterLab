/** Provider module: cline (RouterLab registry — OmniRoute-style) */
export const id = "cline";
export default {
    baseUrl: "https://api.cline.bot/api/v1/chat/completions",
    format: "openai",
    headers: {
      "HTTP-Referer": "https://cline.bot",
      "X-Title": "Cline"
    },
    tokenUrl: "https://api.cline.bot/api/v1/auth/token",
    refreshUrl: "https://api.cline.bot/api/v1/auth/refresh"
  };
