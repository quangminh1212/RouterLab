/** Provider module: openrouter (RouterLab registry — OmniRoute-style) */
export const id = "openrouter";
export default {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    format: "openai",
    headers: {
      "HTTP-Referer": "https://endpoint-proxy.local",
      "X-Title": "Endpoint Proxy"
    }
  };
