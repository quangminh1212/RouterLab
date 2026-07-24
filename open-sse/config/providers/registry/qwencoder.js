/** Provider module: qwencoder (RouterLab registry — OmniRoute-style) */
export const id = "qwencoder";
export default {
    baseUrl: "https://api.qwencoder.cloud/api/v1/chat/completions",
    format: "openai",
    headers: {
      "User-Agent": "XLab-Router/qwencoder",
    },
  };
