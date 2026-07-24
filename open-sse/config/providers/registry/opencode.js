/** Provider module: opencode (RouterLab registry — OmniRoute-style) */
export const id = "opencode";
export default {
    baseUrl: "https://opencode.ai",
    format: "openai",
    headers: { "x-opencode-client": "desktop" },
    noAuth: true
  };
