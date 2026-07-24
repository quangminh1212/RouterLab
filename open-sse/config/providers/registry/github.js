/** Provider module: github (RouterLab registry — OmniRoute-style) */
export const id = "github";
export default {
    baseUrl: "https://api.githubcopilot.com/chat/completions",
    responsesUrl: "https://api.githubcopilot.com/responses",
    format: "openai",
    headers: {
      "copilot-integration-id": "vscode-chat",
      "editor-version": "vscode/1.110.0",
      "editor-plugin-version": "copilot-chat/0.38.0",
      "user-agent": "GitHubCopilotChat/0.38.0",
      "openai-intent": "conversation-panel",
      "x-github-api-version": "2025-04-01",
      "x-vscode-user-agent-library-version": "electron-fetch",
      "X-Initiator": "user",
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    clientId: "Iv1.b507a08c87ecfe98"
  };
