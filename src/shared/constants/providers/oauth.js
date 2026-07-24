import { RISK_NOTICE, THINKING_CONFIG } from "./_shared.js";

export const OAUTH_PROVIDERS = {
  claude: { id: "claude", alias: "cc", name: "Claude Code", icon: "smart_toy", color: "#D97757", deprecated: true, deprecationNotice: RISK_NOTICE, website: "https://claude.ai", notice: { signupUrl: "https://claude.ai" } },
  antigravity: { id: "antigravity", alias: "ag", name: "Antigravity", icon: "rocket_launch", color: "#F59E0B", hidden: true, deprecated: true, deprecationNotice: "AG is designed exclusively for Antigravity IDE. Using it with other tools (OpenClaw, Claude, Codex...) may result in account restrictions or bans.", website: "https://antigravity.google", notice: { signupUrl: "https://antigravity.google" } },
  codex: { id: "codex", alias: "cx", name: "OpenAI Codex", icon: "code", color: "#3B82F6", deprecated: true, deprecationNotice: RISK_NOTICE, thinkingConfig: THINKING_CONFIG.effort, serviceKinds: ["llm", "image"], kindNotice: { image: "Requires a ChatGPT Plus (or higher) account. Free accounts are not supported for image generation." }, website: "https://chatgpt.com/codex", notice: { signupUrl: "https://chatgpt.com/codex" } },
  github: { id: "github", alias: "gh", name: "GitHub Copilot", icon: "code", color: "#333333", deprecated: true, deprecationNotice: RISK_NOTICE, serviceKinds: ["llm", "embedding"], embeddingConfig: { baseUrl: "https://models.github.ai/inference/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "text-embedding-3-small", name: "Text Embedding 3 Small (GitHub)", dimensions: 1536 }, { id: "text-embedding-3-large", name: "Text Embedding 3 Large (GitHub)", dimensions: 3072 }] }, website: "https://github.com/features/copilot", notice: { signupUrl: "https://github.com/features/copilot" } },
  "amazon-q": { id: "amazon-q", alias: "aq", name: "Amazon Q", icon: "cloud", color: "#FF9900", textIcon: "AQ", deprecated: true, deprecationNotice: RISK_NOTICE, website: "https://aws.amazon.com/q/developer/", notice: { signupUrl: "https://aws.amazon.com/q/developer/" } },
  cursor: { id: "cursor", alias: "cu", name: "Cursor IDE", icon: "edit_note", color: "#00D4AA", website: "https://cursor.com", notice: { signupUrl: "https://cursor.com" } },
  "kimi-coding": { id: "kimi-coding", alias: "kmc", name: "Kimi Coding", icon: "psychology", color: "#1E40AF", textIcon: "KC", deprecated: true, deprecationNotice: RISK_NOTICE, website: "https://www.kimi.com/code", notice: { signupUrl: "https://www.kimi.com/code" } },
  kilocode: { id: "kilocode", alias: "kc", name: "Kilo Code", icon: "code", color: "#FF6B35", textIcon: "KC", website: "https://kilo.ai", notice: { signupUrl: "https://kilo.ai" } },
  cline: { id: "cline", alias: "cl", name: "Cline", icon: "smart_toy", color: "#5B9BD5", textIcon: "CL", website: "https://cline.bot", notice: { signupUrl: "https://cline.bot" } },
  gitlab: { id: "gitlab", alias: "gl", name: "GitLab Duo", icon: "hub", color: "#FC6D26", textIcon: "GL", website: "https://docs.gitlab.com/user/duo_agent_platform/code_suggestions/", notice: { signupUrl: "https://gitlab.com" } },
  codebuddy: { id: "codebuddy", alias: "cb", name: "CodeBuddy", icon: "smart_toy", color: "#006EFF", textIcon: "CB", website: "https://copilot.tencent.com", notice: { signupUrl: "https://copilot.tencent.com" } },
  // OmniRoute OAuth/CLI vendor stubs (Đợt 6) — surface in UI; full OAuth flow needs desktop/session
  agy: { id: "agy", alias: "agy", name: "Antigravity CLI", icon: "terminal", color: "#F59E0B", textIcon: "AGY", website: "https://antigravity.google", notice: { signupUrl: "https://antigravity.google", text: "CLI OAuth — paste credential from Antigravity CLI." } },
  windsurf: { id: "windsurf", alias: "ws", name: "Windsurf (Devin CLI)", icon: "surfing", color: "#00C5A0", textIcon: "WS", website: "https://windsurf.com", notice: { signupUrl: "https://windsurf.com", text: "Device-code / token paste from Windsurf/Devin CLI." } },
  trae: { id: "trae", alias: "tr", name: "Trae", icon: "edit_note", color: "#FF7849", textIcon: "TR", website: "https://trae.ai", notice: { signupUrl: "https://trae.ai", text: "Paste Cloud-IDE JWT from Trae." } },
  zed: { id: "zed", alias: "zd", name: "Zed IDE", icon: "code", color: "#084CCF", textIcon: "ZD", website: "https://zed.dev", notice: { signupUrl: "https://zed.dev", text: "Import creds from OS keychain / hosted token." } },
  "zed-hosted": { id: "zed-hosted", alias: "zedh", name: "Zed Hosted Models", icon: "cloud", color: "#084CCF", textIcon: "ZH", website: "https://zed.dev", notice: { signupUrl: "https://zed.dev" }, passthroughModels: true },
  clinepass: { id: "clinepass", alias: "cp", name: "ClinePass", icon: "vpn_key", color: "#9D4EDD", textIcon: "CP", website: "https://cline.bot/clinepass", notice: { signupUrl: "https://cline.bot/clinepass" } },
  "grok-cli": { id: "grok-cli", alias: "gcli", name: "Grok Build", icon: "bolt", color: "#000000", textIcon: "GB", website: "https://x.ai", notice: { text: "Paste ~/.grok/auth.json or JWT from Grok Build CLI." } },
  "devin-cli": {
    id: "devin-cli",
    alias: "dvcli",
    name: "Devin CLI",
    icon: "smart_toy",
    color: "#111827",
    textIcon: "DV",
    website: "https://cli.devin.ai",
    notice: {
      signupUrl: "https://cli.devin.ai",
      text: "Local Devin CLI (install + `devin auth`). Free models: swe-1-7, swe-1-7-medium, glm-5-2, swe-1-6. Hermes plugin SoT: Hermes_DevinACP (submodule hermes-devin-acp).",
    },
    noAuth: true,
    serviceKinds: ["llm"],
  },
  // opencode: { id: "opencode", alias: "oc", name: "OpenCode", icon: "terminal", color: "#E87040", textIcon: "OC" },

  // --- OmniRoute catch-up (auto) ---
  "ghe-copilot": { id: "ghe-copilot", alias: "ghe-copilot", name: "GitHub Enterprise Copilot", icon: "smart_toy", color: "#24292F", textIcon: "GE", website: "https://github.com/features/copilot", notice: { text: "GHE Copilot proxy. Set providerSpecificData.gheUrl per connection.", signupUrl: "https://github.com/features/copilot" }, serviceKinds: ["llm"], hasProviderSpecificData: true, hasProviderSpecificData: true },
  "xai-oauth": { id: "xai-oauth", alias: "xao", name: "xAI OAuth (Grok)", icon: "smart_toy", color: "#000000", textIcon: "XO", website: "https://x.ai", notice: { text: "Grok Build OAuth / PKCE. Prefer API key provider `xai` when possible.", signupUrl: "https://x.ai" }, serviceKinds: ["llm"], passthroughModels: true, hasProviderSpecificData: true },
};
