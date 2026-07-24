/** Provider module: codex (RouterLab registry — OmniRoute-style) */
export const id = "codex";
export default {
    baseUrl: "https://chatgpt.com/backend-api/codex/responses",
    format: "openai-responses",
    headers: {
      "originator": "codex-cli",
      "User-Agent": "codex-cli/1.0.18 (macOS; arm64)"
    },
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    tokenUrl: "https://auth.openai.com/oauth/token"
  };
