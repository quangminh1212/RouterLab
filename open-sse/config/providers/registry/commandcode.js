/** Provider module: commandcode (RouterLab registry — OmniRoute-style) */
export const id = "commandcode";
export default {
    baseUrl: "https://api.commandcode.ai/alpha/generate",
    format: "commandcode",
    headers: {
      "x-command-code-version": "0.25.7",
      "x-cli-environment": "cli"
    }
  };
