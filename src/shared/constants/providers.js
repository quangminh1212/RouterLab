// Provider definitions

const RISK_NOTICE = "⚠️ Risk Notice: This provider uses a subscription/OAuth session not officially licensed for proxy/router use. Account may be restricted or banned. Use at your own risk.";

export const XIAOMI_TOKENPLAN_REGIONS = {
  sgp: "https://token-plan-sgp.xiaomimimo.com/v1",
  cn: "https://token-plan-cn.xiaomimimo.com/v1",
  ams: "https://token-plan-ams.xiaomimimo.com/v1",
};

export function resolveXiaomiTokenPlanBaseUrl(region = "sgp") {
  const normalized = String(region || "sgp").trim().toLowerCase();
  return XIAOMI_TOKENPLAN_REGIONS[normalized] || XIAOMI_TOKENPLAN_REGIONS.sgp;
}

// Free Providers (kiro first, iflow last)
export const FREE_PROVIDERS = {
  kiro: { id: "kiro", alias: "kr", name: "Kiro AI", icon: "psychology_alt", color: "#FF6B35", deprecated: true, deprecationNotice: RISK_NOTICE, website: "https://kiro.dev", notice: { signupUrl: "https://kiro.dev" } },
  qwen: { id: "qwen", alias: "qw", name: "Qwen Code", icon: "psychology", color: "#10B981", mediaPriority: 999, hidden: true, deprecated: true, deprecationNotice: "Qwen OAuth free tier was discontinued by Alibaba on 2026-04-15. New connections will not work.", website: "https://chat.qwen.ai", notice: { signupUrl: "https://chat.qwen.ai" }, serviceKinds: ["llm", "tts"], ttsConfig: { baseUrl: "http://localhost:8000/v1/audio/speech", authType: "none", authHeader: "none", format: "openai", models: [{ id: "qwen3-tts", name: "Qwen3 TTS" }] } },
  "gemini-cli": { id: "gemini-cli", alias: "gc", name: "Gemini CLI", icon: "terminal", color: "#4285F4", deprecated: true, deprecationNotice: RISK_NOTICE, website: "https://github.com/google-gemini/gemini-cli", notice: { signupUrl: "https://github.com/google-gemini/gemini-cli" } },
  qoder: { id: "qoder", alias: "qd", name: "Qoder AI", icon: "water_drop", color: "#EC4899", textIcon: "QD", website: "https://qoder.com", notice: { signupUrl: "https://qoder.com" } },
  iflow: { id: "iflow", alias: "if", name: "iFlow AI", icon: "water_drop", color: "#6366F1", hidden: true, website: "https://iflow.cn", notice: { signupUrl: "https://iflow.cn" } },
  opencode: { id: "opencode", alias: "oc", name: "OpenCode Free", icon: "terminal", color: "#E87040", textIcon: "OC", noAuth: true, passthroughModels: true, modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" } },
};

// Free Tier Providers (has free access but may require account/API key)
export const FREE_TIER_PROVIDERS = {
  openrouter: { id: "openrouter", alias: "openrouter", name: "OpenRouter", icon: "router", color: "#F97316", textIcon: "OR", website: "https://openrouter.ai", notice: { text: "Free tier: 27+ free models, no credit card needed, 200 req/day. After $10 credit: 1,000 req/day.", apiKeyUrl: "https://openrouter.ai/settings/keys" }, modelsFetcher: { url: "https://openrouter.ai/api/v1/models", type: "openrouter-free" }, passthroughModels: true, serviceKinds: ["llm", "embedding", "tts", "imageToText"], embeddingConfig: { baseUrl: "https://openrouter.ai/api/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "openai/text-embedding-3-small", name: "Text Embedding 3 Small (OpenRouter)", dimensions: 1536 }, { id: "openai/text-embedding-3-large", name: "Text Embedding 3 Large (OpenRouter)", dimensions: 3072 }, { id: "openai/text-embedding-ada-002", name: "Text Embedding Ada 002 (OpenRouter)", dimensions: 1536 }] } },
  nvidia: { id: "nvidia", alias: "nvidia", name: "NVIDIA NIM", icon: "developer_board", color: "#76B900", textIcon: "NV", website: "https://developer.nvidia.com/nim", notice: { text: "Free access for NVIDIA Developer Program members (prototyping & testing).", apiKeyUrl: "https://build.nvidia.com/settings/api-keys" }, serviceKinds: ["llm", "tts", "embedding"], ttsConfig: { baseUrl: "https://integrate.api.nvidia.com/v1/audio/speech", authType: "apikey", authHeader: "bearer", format: "nvidia-tts", models: [{ id: "fastpitch", name: "FastPitch" }, { id: "tacotron2", name: "Tacotron2" }] }, embeddingConfig: { baseUrl: "https://integrate.api.nvidia.com/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "nvidia/nv-embedqa-e5-v5", name: "NV EmbedQA E5 v5", dimensions: 1024 }] } },
  ollama: { id: "ollama", alias: "ollama", name: "Ollama Cloud", icon: "cloud", color: "#ffffffff", textIcon: "OL", website: "https://ollama.com", notice: { text: "Free tier: light usage, 1 cloud model at a time (limits reset every 5h & 7d). Pro $20/mo · Max $100/mo.", apiKeyUrl: "https://ollama.com/settings/keys" } },
  vertex: { id: "vertex", alias: "vx", name: "Vertex AI", icon: "cloud", color: "#4285F4", textIcon: "VX", website: "https://cloud.google.com/vertex-ai", notice: { text: "New Google Cloud accounts get $300 free credits. Requires GCP project + Service Account with Vertex AI API enabled.", apiKeyUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts" } },
  gemini: { id: "gemini", alias: "gemini", name: "Gemini", icon: "diamond", color: "#4285F4", textIcon: "GE", mediaPriority: 1, website: "https://ai.google.dev", notice: { apiKeyUrl: "https://aistudio.google.com/app/apikey" }, serviceKinds: ["llm", "embedding", "image", "imageToText", "webSearch", "tts", "stt"], sttConfig: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/models", authType: "apikey", authHeader: "key", format: "gemini-stt", models: [{ id: "gemini-2.5-pro", name: "Gemini 2.5 Pro (Best)" }, { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" }, { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite (Cheapest)" }, { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" }] }, searchViaChat: { defaultModel: "gemini-2.5-flash", pricingUrl: "https://ai.google.dev/pricing", freeTier: "Free tier: 15 RPM, 1M tokens/day on gemini-2.5-flash via AI Studio." }, embeddingConfig: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/models", authType: "apikey", authHeader: "key", models: [{ id: "text-embedding-004", name: "Text Embedding 004", dimensions: 768 }, { id: "embedding-001", name: "Embedding 001", dimensions: 768 }] }, ttsConfig: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/models", authType: "apikey", authHeader: "key", format: "gemini-tts", models: [{ id: "gemini-2.5-flash-preview-tts", name: "Gemini 2.5 Flash TTS" }, { id: "gemini-2.5-pro-preview-tts", name: "Gemini 2.5 Pro TTS" }] } },
  "cloudflare-ai": { id: "cloudflare-ai", alias: "cf", name: "Cloudflare", icon: "cloud", color: "#F38020", textIcon: "CF", website: "https://developers.cloudflare.com/workers-ai/", notice: { text: "Workers AI free tier. Requires a Cloudflare API token and Account ID.", apiKeyUrl: "https://dash.cloudflare.com/profile/api-tokens" }, serviceKinds: ["llm", "image"], hasProviderSpecificData: true },
  byteplus: { id: "byteplus", alias: "bpm", name: "BytePlus ModelArk", icon: "cloud", color: "#2563EB", textIcon: "BP", website: "https://console.byteplus.com/ark", notice: { text: "Free credits for new accounts. Access to Seed 2.0, Kimi K2 Thinking, GLM 4.7, GPT-OSS-120B models.", apiKeyUrl: "https://console.byteplus.com/ark/region:ark+ap-southeast-1/apiKey" }, serviceKinds: ["llm"] },
};

// Thinking config definitions
// options: list of selectable modes ("auto" = no override from server)
// defaultMode: fallback when user hasn't configured
// extended: claude-style thinking (thinking.type + budget_tokens) — used by most providers
// effort: openai-style reasoning_effort — only openai + codex
export const THINKING_CONFIG = {
  extended: {
    options: ["auto", "on", "off"],
    defaultMode: "auto",
    defaultBudgetTokens: 10000
  },
  effort: {
    options: ["auto", "none", "low", "medium", "high"],
    defaultMode: "auto"
  }
};

const MINIMAX_TTS_MODELS = [
  { id: "speech-2.8-hd", name: "Speech 2.8 HD" },
  { id: "speech-2.8-turbo", name: "Speech 2.8 Turbo" },
  { id: "speech-2.6-hd", name: "Speech 2.6 HD" },
  { id: "speech-2.6-turbo", name: "Speech 2.6 Turbo" },
  { id: "speech-02-hd", name: "Speech 02 HD" },
  { id: "speech-02-turbo", name: "Speech 02 Turbo" },
  { id: "speech-01-hd", name: "Speech 01 HD" },
  { id: "speech-01-turbo", name: "Speech 01 Turbo" },
];

// OAuth Providers
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
};

export const APIKEY_PROVIDERS = {
  glm: { id: "glm", alias: "glm", name: "GLM Coding", icon: "code", color: "#2563EB", textIcon: "GL", website: "https://open.bigmodel.cn", notice: { apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys" } },
  "glm-cn": { id: "glm-cn", alias: "glm-cn", name: "GLM (China)", icon: "code", color: "#DC2626", textIcon: "GC", website: "https://open.bigmodel.cn", notice: { apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys" } },
  kimi: { id: "kimi", alias: "kimi", name: "Kimi", icon: "psychology", color: "#1E3A8A", textIcon: "KM", website: "https://kimi.moonshot.cn", notice: { apiKeyUrl: "https://platform.moonshot.ai/console/api-keys" }, serviceKinds: ["llm", "webSearch"], searchViaChat: { defaultModel: "kimi-k2.5", pricingUrl: "https://platform.moonshot.ai/docs/pricing/chat" } },
  minimax: { id: "minimax", alias: "minimax", name: "Minimax Coding", icon: "memory", color: "#7C3AED", textIcon: "MM", website: "https://www.minimaxi.com", notice: { apiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key" }, serviceKinds: ["llm", "image", "imageToText", "webSearch", "tts"], searchViaChat: { defaultModel: "MiniMax-M2.7", pricingUrl: "https://www.minimaxi.com/document/price" }, ttsConfig: { baseUrl: "https://api.minimax.io/v1/t2a_v2", authType: "apikey", authHeader: "bearer", format: "minimax-tts", models: MINIMAX_TTS_MODELS } },
  "minimax-cn": { id: "minimax-cn", alias: "minimax-cn", name: "Minimax (China)", icon: "memory", color: "#DC2626", textIcon: "MC", website: "https://www.minimaxi.com", notice: { apiKeyUrl: "https://platform.minimaxi.com/user-center/basic-information/interface-key" }, serviceKinds: ["llm", "tts"], ttsConfig: { baseUrl: "https://api.minimaxi.com/v1/t2a_v2", authType: "apikey", authHeader: "bearer", format: "minimax-tts", models: MINIMAX_TTS_MODELS } },
  alicode: { id: "alicode", alias: "alicode", name: "Alibaba", icon: "cloud", color: "#FF6A00", textIcon: "ALi", website: "https://bailian.console.aliyun.com", notice: { apiKeyUrl: "https://bailian.console.aliyun.com/?apiKey=1" } },
  "alicode-intl": { id: "alicode-intl", alias: "alicode-intl", name: "Alibaba Intl", icon: "cloud", color: "#FF6A00", textIcon: "ALi", website: "https://modelstudio.console.alibabacloud.com", notice: { apiKeyUrl: "https://modelstudio.console.alibabacloud.com/?apiKey=1" } },
  "xiaomi-mimo": { id: "xiaomi-mimo", alias: "mimo", name: "Xiaomi MiMo", icon: "smart_toy", color: "#FF6900", textIcon: "XM", website: "https://mimo.xiaomi.com", notice: { apiKeyUrl: "https://mimo.xiaomi.com" } },
  "xiaomi-tokenplan": { id: "xiaomi-tokenplan", alias: "xmtp", name: "Xiaomi MiMo (Token Plan)", icon: "smart_toy", color: "#FF6700", textIcon: "XT", website: "https://mimo.xiaomi.com", notice: { text: "Xiaomi MiMo Token Plan subscription (API key starts with tp-). Token Plan keys are cluster-specific — select the region matching your subscription.", apiKeyUrl: "https://mimo.xiaomi.com" }, hasProviderSpecificData: true, regions: [{ id: "sgp", label: "Singapore", baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1" }, { id: "cn", label: "China", baseUrl: "https://token-plan-cn.xiaomimimo.com/v1" }, { id: "ams", label: "Europe", baseUrl: "https://token-plan-ams.xiaomimimo.com/v1" }], defaultRegion: "sgp" },
  "volcengine-ark": { id: "volcengine-ark", alias: "ark", name: "Volcengine Ark", icon: "cloud", color: "#1677FF", textIcon: "ARK", website: "https://ark.cn-beijing.volces.com", notice: { apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" } },
  openai: { id: "openai", alias: "openai", name: "OpenAI", icon: "auto_awesome", color: "#10A37F", textIcon: "OA", website: "https://platform.openai.com", notice: { apiKeyUrl: "https://platform.openai.com/api-keys" }, serviceKinds: ["llm", "embedding", "tts", "stt", "image", "imageToText", "webSearch"], thinkingConfig: THINKING_CONFIG.effort, searchViaChat: { defaultModel: "gpt-4o-mini", pricingUrl: "https://openai.com/api/pricing" }, ttsConfig: { baseUrl: "https://api.openai.com/v1/audio/speech", authType: "apikey", authHeader: "bearer", format: "openai", models: [{ id: "tts-1", name: "TTS-1" }, { id: "tts-1-hd", name: "TTS-1 HD" }, { id: "gpt-4o-mini-tts", name: "GPT-4o Mini TTS" }] }, sttConfig: { baseUrl: "https://api.openai.com/v1/audio/transcriptions", authType: "apikey", authHeader: "bearer", format: "openai", models: [{ id: "whisper-1", name: "Whisper 1" }, { id: "gpt-4o-transcribe", name: "GPT-4o Transcribe" }, { id: "gpt-4o-mini-transcribe", name: "GPT-4o Mini Transcribe" }] }, embeddingConfig: { baseUrl: "https://api.openai.com/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "text-embedding-3-small", name: "Text Embedding 3 Small", dimensions: 1536 }, { id: "text-embedding-3-large", name: "Text Embedding 3 Large", dimensions: 3072 }, { id: "text-embedding-ada-002", name: "Text Embedding Ada 002", dimensions: 1536 }] } },
  "vercel-ai-gateway": { id: "vercel-ai-gateway", alias: "vercel", name: "Vercel AI Gateway", icon: "deployed_code", color: "#111827", textIcon: "VG", website: "https://vercel.com/ai-gateway", notice: { text: "Unified OpenAI-compatible endpoint from Vercel. Use your AI Gateway API key, then pick models with provider/model IDs like anthropic/claude-sonnet-4.6 or openai/gpt-5.4.", apiKeyUrl: "https://vercel.com/dashboard/~/ai-gateway" }, passthroughModels: true, serviceKinds: ["llm"] },
  anthropic: { id: "anthropic", alias: "anthropic", name: "Anthropic", icon: "smart_toy", color: "#D97757", textIcon: "AN", website: "https://console.anthropic.com", notice: { apiKeyUrl: "https://console.anthropic.com/settings/keys" }, serviceKinds: ["llm", "imageToText"] },
  "opencode-go": { id: "opencode-go", alias: "ocg", name: "OpenCode Go", icon: "terminal", color: "#E87040", textIcon: "OC", website: "https://opencode.ai/auth", notice: { text: "OpenCode Go subscription: $5/mo (then $10/mo). Access to Kimi, GLM, Qwen, MiMo, MiniMax models.", apiKeyUrl: "https://opencode.ai/auth" } },
  azure: { id: "azure", alias: "azure", name: "Azure OpenAI", icon: "cloud", color: "#0078D4", textIcon: "AZ", website: "https://azure.microsoft.com/en-us/products/ai-services/openai-service", notice: { apiKeyUrl: "https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI" }, hasProviderSpecificData: true },

  deepseek: { id: "deepseek", alias: "ds", name: "DeepSeek", icon: "bolt", color: "#4D6BFE", textIcon: "DS", website: "https://deepseek.com", notice: { apiKeyUrl: "https://platform.deepseek.com/api_keys" } },
  commandcode: { id: "commandcode", alias: "cmc", name: "Command Code", icon: "smart_toy", color: "#000000", textIcon: "CC", website: "https://commandcode.ai", notice: { text: "Use your CommandCode CLI API key (starts with user_...) from ~/.commandcode/auth.json or commandcode.ai/studio.", apiKeyUrl: "https://commandcode.ai/studio" } },
  groq: { id: "groq", alias: "groq", name: "Groq", icon: "speed", color: "#F55036", textIcon: "GQ", website: "https://groq.com", notice: { apiKeyUrl: "https://console.groq.com/keys" }, serviceKinds: ["llm", "imageToText", "stt"], sttConfig: { baseUrl: "https://api.groq.com/openai/v1/audio/transcriptions", authType: "apikey", authHeader: "bearer", format: "openai", models: [{ id: "whisper-large-v3", name: "Whisper Large v3" }, { id: "whisper-large-v3-turbo", name: "Whisper Large v3 Turbo" }, { id: "distil-whisper-large-v3-en", name: "Distil Whisper Large v3 EN" }] } },
  xai: { id: "xai", alias: "xai", name: "xAI (Grok)", icon: "auto_awesome", color: "#1DA1F2", textIcon: "XA", website: "https://x.ai", notice: { apiKeyUrl: "https://console.x.ai" }, serviceKinds: ["llm", "imageToText", "webSearch"], searchViaChat: { defaultModel: "grok-4.20-reasoning", pricingUrl: "https://x.ai/api#pricing" } },
  mistral: { id: "mistral", alias: "mistral", name: "Mistral", icon: "air", color: "#FF7000", textIcon: "MI", website: "https://mistral.ai", notice: { apiKeyUrl: "https://console.mistral.ai/api-keys" }, serviceKinds: ["llm", "imageToText", "embedding"], embeddingConfig: { baseUrl: "https://api.mistral.ai/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "mistral-embed", name: "Mistral Embed", dimensions: 1024 }] } },
  perplexity: { id: "perplexity", alias: "pplx", name: "Perplexity", icon: "search", color: "#20808D", textIcon: "PP", website: "https://www.perplexity.ai", notice: { apiKeyUrl: "https://www.perplexity.ai/settings/api" }, serviceKinds: ["llm", "webSearch"], searchConfig: { baseUrl: "https://api.perplexity.ai/search", method: "POST", authType: "apikey", authHeader: "bearer", costPerQuery: 0.005, freeMonthlyQuota: 0, searchTypes: ["web"], defaultMaxResults: 5, maxMaxResults: 20, timeoutMs: 10000, cacheTTLMs: 300000 } },
  together: { id: "together", alias: "together", name: "Together AI", icon: "group_work", color: "#0F6FFF", textIcon: "TG", website: "https://www.together.ai", notice: { apiKeyUrl: "https://api.together.xyz/settings/api-keys" }, serviceKinds: ["llm", "embedding"], embeddingConfig: { baseUrl: "https://api.together.xyz/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "BAAI/bge-large-en-v1.5", name: "BGE Large EN v1.5", dimensions: 1024 }, { id: "togethercomputer/m2-bert-80M-8k-retrieval", name: "M2 BERT 80M 8K", dimensions: 768 }] } },
  fireworks: { id: "fireworks", alias: "fireworks", name: "Fireworks AI", icon: "local_fire_department", color: "#7B2EF2", textIcon: "FW", website: "https://fireworks.ai", notice: { apiKeyUrl: "https://fireworks.ai/account/api-keys" }, serviceKinds: ["llm", "embedding"], embeddingConfig: { baseUrl: "https://api.fireworks.ai/inference/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "nomic-ai/nomic-embed-text-v1.5", name: "Nomic Embed Text v1.5", dimensions: 768 }] } },
  cerebras: { id: "cerebras", alias: "cerebras", name: "Cerebras", icon: "memory", color: "#FF4F00", textIcon: "CB", website: "https://www.cerebras.ai", notice: { apiKeyUrl: "https://cloud.cerebras.ai/platform" } },
  cohere: { id: "cohere", alias: "cohere", name: "Cohere", icon: "hub", color: "#39594D", textIcon: "CO", website: "https://cohere.com", notice: { apiKeyUrl: "https://dashboard.cohere.com/api-keys" } },
  nebius: { id: "nebius", alias: "nebius", name: "Nebius AI", icon: "cloud", color: "#6C5CE7", textIcon: "NB", website: "https://nebius.com", notice: { apiKeyUrl: "https://studio.nebius.com/settings/api-keys" }, serviceKinds: ["llm", "embedding"], embeddingConfig: { baseUrl: "https://api.tokenfactory.nebius.com/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "Qwen/Qwen3-Embedding-8B", name: "Qwen3 Embedding 8B", dimensions: 4096 }] } },
  siliconflow: { id: "siliconflow", alias: "siliconflow", name: "SiliconFlow", icon: "cloud_queue", color: "#5B6EF5", textIcon: "SF", website: "https://cloud.siliconflow.com", notice: { apiKeyUrl: "https://cloud.siliconflow.com/account/ak" } },
  hyperbolic: { id: "hyperbolic", alias: "hyp", name: "Hyperbolic", icon: "bolt", color: "#00D4FF", textIcon: "HY", website: "https://hyperbolic.xyz", notice: { apiKeyUrl: "https://app.hyperbolic.xyz/settings" }, serviceKinds: ["llm", "tts"], ttsConfig: { baseUrl: "https://api.hyperbolic.xyz/v1/audio/generation", authType: "apikey", authHeader: "bearer", format: "hyperbolic", models: [{ id: "melo-tts", name: "Melo TTS" }] } },
  deepgram: { id: "deepgram", alias: "dg", name: "Deepgram", icon: "mic", color: "#13EF93", textIcon: "DG", website: "https://deepgram.com", notice: { text: "$200 free credit on signup (no card required). Aura-1: $0.015/1k chars, Aura-2: $0.030/1k chars (Pay-As-You-Go).", apiKeyUrl: "https://console.deepgram.com/api-keys" }, serviceKinds: ["stt", "imageToText", "tts"], ttsConfig: { baseUrl: "https://api.deepgram.com/v1/speak", authType: "apikey", authHeader: "token", format: "deepgram", models: [] }, sttConfig: { baseUrl: "https://api.deepgram.com/v1/listen", authType: "apikey", authHeader: "token", format: "deepgram", models: [{ id: "nova-3", name: "Nova 3" }, { id: "nova-2", name: "Nova 2" }, { id: "whisper-large", name: "Whisper Large" }] } },
  assemblyai: { id: "assemblyai", alias: "aai", name: "AssemblyAI", icon: "record_voice_over", color: "#0062FF", textIcon: "AA", website: "https://assemblyai.com", notice: { apiKeyUrl: "https://www.assemblyai.com/app/api-keys" }, serviceKinds: ["stt"], sttConfig: { baseUrl: "https://api.assemblyai.com/v2/transcript", authType: "apikey", authHeader: "bearer", format: "assemblyai", async: true, models: [{ id: "universal-3-pro", name: "Universal 3 Pro" }, { id: "universal-2", name: "Universal 2" }] } },
  nanobanana: { id: "nanobanana", alias: "nb", name: "NanoBanana API", icon: "extension", color: "#FFD700", textIcon: "🍌", website: "https://nanobananaapi.ai", notice: { text: "3rd-party proxy for Google Nano Banana (Gemini 2.5/3 Flash Image). For official, use Gemini provider.", apiKeyUrl: "https://nanobananaapi.ai/dashboard" }, serviceKinds: ["image"] },
  elevenlabs: { id: "elevenlabs", alias: "el", name: "ElevenLabs", icon: "record_voice_over", color: "#6C47FF", textIcon: "EL", website: "https://elevenlabs.io", notice: { apiKeyUrl: "https://elevenlabs.io/app/settings/api-keys" }, serviceKinds: ["tts"], ttsConfig: { baseUrl: "https://api.elevenlabs.io/v1/text-to-speech", authType: "apikey", authHeader: "xi-api-key", format: "elevenlabs", models: [{ id: "eleven_multilingual_v2", name: "Eleven Multilingual v2" }, { id: "eleven_turbo_v2_5", name: "Eleven Turbo v2.5" }] } },
  cartesia: { id: "cartesia", alias: "cartesia", name: "Cartesia", icon: "spatial_audio", color: "#FF4F8B", textIcon: "CA", website: "https://cartesia.ai", notice: { apiKeyUrl: "https://play.cartesia.ai/keys" }, serviceKinds: ["tts"], hidden: true, ttsConfig: { baseUrl: "https://api.cartesia.ai/tts/bytes", authType: "apikey", authHeader: "x-api-key", format: "cartesia", models: [{ id: "sonic-2", name: "Sonic 2" }, { id: "sonic-3", name: "Sonic 3" }] } },
  playht: { id: "playht", alias: "playht", name: "PlayHT", icon: "play_circle", color: "#00B4D8", textIcon: "PH", website: "https://play.ht", notice: { apiKeyUrl: "https://play.ht/studio/api-access" }, serviceKinds: ["tts"], hidden: true, ttsConfig: { baseUrl: "https://api.play.ht/api/v2/tts/stream", authType: "apikey", authHeader: "playht", format: "playht", models: [{ id: "PlayDialog", name: "PlayDialog" }, { id: "Play3.0-mini", name: "Play 3.0 Mini" }] } },
  "local-device": { id: "local-device", alias: "local-device", name: "Local Device", icon: "speaker", color: "#64748B", textIcon: "LD", mediaPriority: 5, serviceKinds: ["tts"], noAuth: true, ttsConfig: { baseUrl: "local-device", authType: "none", authHeader: "none", format: "local-device", models: [] } },
  "google-tts": { id: "google-tts", alias: "google-tts", name: "Google TTS", icon: "record_voice_over", color: "#4285F4", textIcon: "GT", mediaPriority: 5, serviceKinds: ["tts"], noAuth: true, ttsConfig: { baseUrl: "google-tts", authType: "none", authHeader: "none", format: "google-tts", models: [] } },
  "edge-tts": { id: "edge-tts", alias: "edge-tts", name: "Edge TTS", icon: "record_voice_over", color: "#0078D4", textIcon: "ET", mediaPriority: 5, serviceKinds: ["tts"], noAuth: true, ttsConfig: { baseUrl: "edge-tts", authType: "none", authHeader: "none", format: "edge-tts", models: [] } },
  coqui: { id: "coqui", alias: "coqui", name: "Coqui TTS", icon: "record_voice_over", color: "#10B981", textIcon: "CQ", website: "https://github.com/coqui-ai/TTS", serviceKinds: ["tts"], hidden: true, noAuth: true, ttsConfig: { baseUrl: "http://localhost:5002/api/tts", authType: "none", authHeader: "none", format: "coqui", models: [{ id: "tts_models/en/ljspeech/tacotron2-DDC", name: "Tacotron2 DDC (LJSpeech)" }] } },
  tortoise: { id: "tortoise", alias: "tortoise", name: "Tortoise TTS", icon: "record_voice_over", color: "#7C3AED", textIcon: "TT", website: "https://github.com/neonbjb/tortoise-tts", serviceKinds: ["tts"], hidden: true, noAuth: true, ttsConfig: { baseUrl: "http://localhost:5000/api/tts", authType: "none", authHeader: "none", format: "tortoise", models: [{ id: "tortoise-v2", name: "Tortoise v2" }] } },
  inworld: { id: "inworld", alias: "inworld", name: "Inworld TTS", icon: "record_voice_over", color: "#FF6B6B", textIcon: "IW", website: "https://inworld.ai", notice: { text: "Free tier: 40 minutes/month TTS. Paid: TTS-1.5 Mini $0.01/min ($15/1M chars), TTS-1.5 Max $0.025/min ($30/1M chars). 270+ voices, 15 languages.", apiKeyUrl: "https://platform.inworld.ai/api-keys" }, serviceKinds: ["tts"], ttsConfig: { baseUrl: "https://api.inworld.ai/tts/v1/voice", authType: "apikey", authHeader: "basic", format: "inworld", models: [{ id: "inworld-tts-1.5-mini", name: "Inworld TTS 1.5 Mini ($0.01/min)" }, { id: "inworld-tts-1.5-max", name: "Inworld TTS 1.5 Max ($0.025/min)" }] } },
  "voyage-ai": { id: "voyage-ai", alias: "voyage", name: "Voyage AI", icon: "data_array", color: "#0EA5E9", textIcon: "VG", website: "https://www.voyageai.com", notice: { apiKeyUrl: "https://dash.voyageai.com/api-keys" }, serviceKinds: ["embedding"], embeddingConfig: { baseUrl: "https://api.voyageai.com/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "voyage-3-large", name: "Voyage 3 Large", dimensions: 1024 }, { id: "voyage-3.5", name: "Voyage 3.5", dimensions: 1024 }, { id: "voyage-3.5-lite", name: "Voyage 3.5 Lite", dimensions: 1024 }, { id: "voyage-code-3", name: "Voyage Code 3", dimensions: 1024 }, { id: "voyage-finance-2", name: "Voyage Finance 2", dimensions: 1024 }, { id: "voyage-law-2", name: "Voyage Law 2", dimensions: 1024 }, { id: "voyage-multilingual-2", name: "Voyage Multilingual 2", dimensions: 1024 }] } },
  sdwebui: { id: "sdwebui", alias: "sdwebui", name: "SD WebUI", icon: "brush", color: "#FF7043", textIcon: "SD", website: "https://github.com/AUTOMATIC1111/stable-diffusion-webui", serviceKinds: ["image"] },
  comfyui: { id: "comfyui", alias: "comfyui", name: "ComfyUI", icon: "account_tree", color: "#4CAF50", textIcon: "CF", website: "https://github.com/comfyanonymous/ComfyUI", serviceKinds: ["image"] },
  huggingface: { id: "huggingface", alias: "hf", name: "HuggingFace", icon: "face", color: "#FFD21E", textIcon: "HF", website: "https://huggingface.co", notice: { apiKeyUrl: "https://huggingface.co/settings/tokens" }, serviceKinds: ["image", "imageToText", "tts", "stt"], hiddenKinds: ["tts"], ttsConfig: { baseUrl: "https://api-inference.huggingface.co/models", authType: "apikey", authHeader: "bearer", format: "huggingface-tts", models: [{ id: "facebook/mms-tts-eng", name: "MMS TTS English" }, { id: "microsoft/speecht5_tts", name: "SpeechT5 TTS" }] }, sttConfig: { baseUrl: "https://api-inference.huggingface.co/models", authType: "apikey", authHeader: "bearer", format: "huggingface-asr", models: [{ id: "openai/whisper-large-v3", name: "Whisper Large v3 (HF)" }, { id: "openai/whisper-small", name: "Whisper Small (HF)" }] } },
  blackbox: { id: "blackbox", alias: "bb", name: "Blackbox AI", icon: "smart_toy", color: "#5B5FEF", textIcon: "BB", website: "https://blackbox.ai", notice: { apiKeyUrl: "https://www.blackbox.ai/api-management" }, serviceKinds: ["llm"] },
  chutes: { id: "chutes", alias: "ch", name: "Chutes AI", icon: "water_drop", color: "#ffffffff", textIcon: "CH", website: "https://chutes.ai", notice: { apiKeyUrl: "https://chutes.ai/app/api" } },
  // === Free-tier LLM providers (synced from OmniRoute) ===
  agentrouter: { id: "agentrouter", alias: "agentrouter", name: "AgentRouter", icon: "router", color: "#10B981", textIcon: "AR", website: "https://agentrouter.org", notice: { text: "$200 free credits on signup - multi-model routing gateway.", apiKeyUrl: "https://agentrouter.org/register" }, passthroughModels: true, serviceKinds: ["llm"] },
  aimlapi: { id: "aimlapi", alias: "aiml", name: "AI/ML API", icon: "hub", color: "#6366F1", textIcon: "AI", website: "https://aimlapi.com", notice: { text: "$0.025/day free — 200+ models (GPT-4o, Claude, Gemini, Llama) via single endpoint.", apiKeyUrl: "https://aimlapi.com/app/keys" }, passthroughModels: true, serviceKinds: ["llm", "image"] },
  novita: { id: "novita", alias: "novita", name: "Novita AI", icon: "auto_awesome", color: "#FF4081", textIcon: "NV", website: "https://novita.ai", notice: { text: "$0.50 trial credits on signup (valid ~1 year).", apiKeyUrl: "https://novita.ai/settings/key-management" }, passthroughModels: true, serviceKinds: ["llm", "image"] },
  modal: { id: "modal", alias: "mdl", name: "Modal", icon: "cloud_queue", color: "#7C3AED", textIcon: "MDL", website: "https://modal.com", notice: { text: "$30/month free credits for new accounts. Self-hosted OpenAI-compatible apps on /v1.", apiKeyUrl: "https://modal.com/settings/tokens" }, passthroughModels: true, serviceKinds: ["llm"], hasProviderSpecificData: true },
  reka: { id: "reka", alias: "reka", name: "Reka", icon: "auto_awesome", color: "#111827", textIcon: "RK", website: "https://docs.reka.ai", notice: { text: "$10/month recurring free API credits.", apiKeyUrl: "https://platform.reka.ai/apikeys" }, serviceKinds: ["llm"] },
  nlpcloud: { id: "nlpcloud", alias: "nlpc", name: "NLP Cloud", icon: "psychology", color: "#2196F3", textIcon: "NLPC", website: "https://docs.nlpcloud.com", notice: { text: "Trial credits for new accounts.", apiKeyUrl: "https://nlpcloud.com/home/token" }, serviceKinds: ["llm"] },
  bazaarlink: { id: "bazaarlink", alias: "bzl", name: "BazaarLink", icon: "storefront", color: "#6366F1", textIcon: "BZ", website: "https://bazaarlink.ai", notice: { text: "Use model 'auto:free' for zero-cost inference. OpenAI-compatible.", apiKeyUrl: "https://bazaarlink.ai" }, serviceKinds: ["llm"] },
  completions: { id: "completions", alias: "cpl", name: "Completions.me", icon: "bolt", color: "#F59E0B", textIcon: "CP", website: "https://completions.me", notice: { text: "Free unlimited access to Claude, GPT, Gemini.", apiKeyUrl: "https://completions.me" }, serviceKinds: ["llm"] },
  enally: { id: "enally", alias: "enly", name: "Enally AI", icon: "school", color: "#8B5CF6", textIcon: "EN", website: "https://ai.enally.in", notice: { text: "Free for students and developers — OTP verification.", apiKeyUrl: "https://ai.enally.in/api" }, serviceKinds: ["llm"] },
  freetheai: { id: "freetheai", alias: "fta", name: "FreeTheAi", icon: "lock_open", color: "#10B981", textIcon: "FT", website: "https://freetheai.xyz", notice: { text: "Community-run free tier — 16,000+ models, OpenAI-compatible.", apiKeyUrl: "https://freetheai.xyz" }, serviceKinds: ["llm"] },
  llm7: { id: "llm7", alias: "llm7", name: "LLM7.io", icon: "hub", color: "#6366F1", textIcon: "LM", website: "https://llm7.io", notice: { text: "Works without API key (use 'unused'). 2 req/s, 100 req/hr free.", apiKeyUrl: "https://token.llm7.io" }, serviceKinds: ["llm"] },
  lepton: { id: "lepton", alias: "lepton", name: "Lepton AI", icon: "bolt", color: "#10B981", textIcon: "LP", website: "https://lepton.ai", notice: { apiKeyUrl: "https://dashboard.lepton.ai/credentials" }, serviceKinds: ["llm"] },
  kluster: { id: "kluster", alias: "kluster", name: "Kluster AI", icon: "hub", color: "#8B5CF6", textIcon: "KL", website: "https://kluster.ai", notice: { text: "$5 free credits on signup — DeepSeek R1, Llama 4, Qwen3 235B.", apiKeyUrl: "https://kluster.ai/dashboard/api-keys" }, serviceKinds: ["llm"] },
  ai21: { id: "ai21", alias: "ai21", name: "AI21 Labs", icon: "psychology_alt", color: "#0284C7", textIcon: "AI21", website: "https://www.ai21.com", notice: { text: "$10 trial credits on signup (valid 3 months).", apiKeyUrl: "https://studio.ai21.com/account/api-key" }, serviceKinds: ["llm"] },
  "inference-net": { id: "inference-net", alias: "inet", name: "Inference.net", icon: "dns", color: "#2563EB", textIcon: "IN", website: "https://inference.net", notice: { text: "$25 free credits on signup.", apiKeyUrl: "https://inference.net/dashboard/api-keys" }, serviceKinds: ["llm"] },
  predibase: { id: "predibase", alias: "predibase", name: "Predibase", icon: "deployed_code_history", color: "#0F766E", textIcon: "PB", website: "https://predibase.com", notice: { text: "$25 free trial credits (30-day validity).", apiKeyUrl: "https://app.predibase.com/settings" }, serviceKinds: ["llm"] },
  bytez: { id: "bytez", alias: "bytez", name: "Bytez", icon: "api", color: "#6366F1", textIcon: "BZ", website: "https://bytez.com", notice: { text: "$1 free credits, refreshes every 4 weeks.", apiKeyUrl: "https://bytez.com/dashboard/api" }, serviceKinds: ["llm"] },
  morph: { id: "morph", alias: "morph", name: "Morph", icon: "auto_fix_high", color: "#2563EB", textIcon: "MP", website: "https://morphllm.com", notice: { text: "Free tier: 250K credits/month.", apiKeyUrl: "https://morphllm.com/dashboard/api-keys" }, serviceKinds: ["llm"] },
  longcat: { id: "longcat", alias: "lc", name: "LongCat AI", icon: "auto_awesome", color: "#FF6B9D", textIcon: "LC", website: "https://longcat.chat/platform/docs", notice: { text: "50M tokens/day (Flash-Lite) + 500K/day (Chat/Thinking) — free in public beta.", apiKeyUrl: "https://longcat.chat/platform/api_keys" }, serviceKinds: ["llm"] },
  puter: { id: "puter", alias: "pu", name: "Puter AI", icon: "cloud_circle", color: "#6366F1", textIcon: "PU", website: "https://puter.com", notice: { text: "500+ models (GPT-5, Claude Opus 4, Gemini 3 Pro, Grok 4, DeepSeek V3).", apiKeyUrl: "https://puter.com/dashboard" }, passthroughModels: true, serviceKinds: ["llm"] },
  uncloseai: { id: "uncloseai", alias: "unc", name: "UncloseAI", icon: "auto_awesome", color: "#8B5CF6", textIcon: "UN", website: "https://uncloseai.com", notice: { text: "Free forever — no signup, no credit card. OpenAI-compatible." }, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  scaleway: { id: "scaleway", alias: "scw", name: "Scaleway AI", icon: "cloud", color: "#4F0599", textIcon: "SCW", website: "https://www.scaleway.com/en/ai/generative-apis", notice: { text: "1M free tokens — EU/GDPR compliant (Paris), Qwen3 235B & Llama 70B.", apiKeyUrl: "https://console.scaleway.com/iam/api-keys" }, serviceKinds: ["llm"] },
  deepinfra: { id: "deepinfra", alias: "deepinfra", name: "DeepInfra", icon: "hub", color: "#2563EB", textIcon: "DI", website: "https://deepinfra.com", notice: { text: "Free signup credits for API testing.", apiKeyUrl: "https://deepinfra.com/dash/api_keys" }, serviceKinds: ["llm"] },
  sambanova: { id: "sambanova", alias: "samba", name: "SambaNova", icon: "memory", color: "#DC2626", textIcon: "SN", website: "https://sambanova.ai", notice: { text: "$5 free credits on signup (30-day validity).", apiKeyUrl: "https://cloud.sambanova.ai/apis" }, serviceKinds: ["llm"] },
  nscale: { id: "nscale", alias: "nscale", name: "nScale", icon: "token", color: "#0891B2", textIcon: "NS", website: "https://nscale.com", notice: { text: "$5 free credits on signup.", apiKeyUrl: "https://console.nscale.com/api-keys" }, serviceKinds: ["llm"] },
  baseten: { id: "baseten", alias: "baseten", name: "Baseten", icon: "deployed_code", color: "#111827", textIcon: "BT", website: "https://baseten.co", notice: { text: "$30 free trial credits for GPU inference.", apiKeyUrl: "https://app.baseten.co/settings/api_keys" }, serviceKinds: ["llm"] },
  publicai: { id: "publicai", alias: "publicai", name: "PublicAI", icon: "public", color: "#059669", textIcon: "PA", website: "https://publicai.co", notice: { text: "Free community inference tier.", apiKeyUrl: "https://publicai.co" }, serviceKinds: ["llm"] },
  "nous-research": { id: "nous-research", alias: "nous", name: "Nous Research", icon: "hub", color: "#2563EB", textIcon: "NO", website: "https://portal.nousresearch.com", notice: { text: "Free tier: 50 RPM, 500K TPM — no credit card.", apiKeyUrl: "https://portal.nousresearch.com" }, serviceKinds: ["llm"] },
  glhf: { id: "glhf", alias: "glhf", name: "GLHF Chat", icon: "hub", color: "#10B981", textIcon: "GH", website: "https://glhf.chat", notice: { text: "Free tier for open-source model inference.", apiKeyUrl: "https://glhf.chat/users/settings/api" }, passthroughModels: true, serviceKinds: ["llm"] },
  "ollama-local": { id: "ollama-local", alias: "ollama-local", name: "Ollama Local", icon: "cloud", color: "#ffffffff", textIcon: "OL", website: "https://ollama.com" },

  // === Batch 2 (synced from OmniRoute): OpenAI-compatible API-key providers ===
  "api-airforce": { id: "api-airforce", alias: "af", name: "Api.airforce", icon: "flight", color: "#1E3A5F", textIcon: "AF", website: "https://api.airforce", notice: { text: "55 free-tier models (Grok-3, Claude 3.7, Qwen3, Kimi-K2, Gemini 2.5 Flash, DeepSeek-V3).", apiKeyUrl: "https://panel.api.airforce" }, passthroughModels: true, serviceKinds: ["llm"] },
  astraflow: { id: "astraflow", alias: "astraflow", name: "Astraflow (UCloud Global)", icon: "cloud", color: "#0052D9", textIcon: "AF", website: "https://astraflow.ucloud-global.com", notice: { text: "OpenAI-compatible — 200+ models (global endpoint).", apiKeyUrl: "https://astraflow.ucloud-global.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  "astraflow-cn": { id: "astraflow-cn", alias: "astraflow-cn", name: "Astraflow (UCloud China)", icon: "cloud", color: "#0052D9", textIcon: "AFC", website: "https://astraflow.ucloud.cn", notice: { text: "OpenAI-compatible — 200+ models (China endpoint).", apiKeyUrl: "https://astraflow.ucloud.cn" }, passthroughModels: true, serviceKinds: ["llm"] },
  qianfan: { id: "qianfan", alias: "qianfan", name: "Baidu Qianfan", icon: "cloud", color: "#2468F2", textIcon: "BD", website: "https://cloud.baidu.com/product/wenxinworkshop", notice: { apiKeyUrl: "https://console.bce.baidu.com/iam/#/iam/apikey/list" }, passthroughModels: true, serviceKinds: ["llm"] },
  crof: { id: "crof", alias: "crof", name: "CrofAI", icon: "auto_awesome", color: "#0EA5E9", textIcon: "CR", website: "https://crof.ai", notice: { apiKeyUrl: "https://ai.nahcrof.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  zai: { id: "zai", alias: "zai", name: "Z.AI", icon: "psychology", color: "#2563EB", textIcon: "ZA", website: "https://z.ai", notice: { apiKeyUrl: "https://z.ai/manage-apikey/apikey-list" }, passthroughModels: true, serviceKinds: ["llm"] },
  "github-models": { id: "github-models", alias: "ghm", name: "GitHub Models", icon: "code", color: "#238636", textIcon: "GH", website: "https://github.com/marketplace/models", notice: { text: "Free GPT-5, o-series, DeepSeek-R1, Llama 4, Grok 3 — GitHub PAT with models:read.", apiKeyUrl: "https://github.com/settings/tokens" }, passthroughModels: true, serviceKinds: ["llm"] },
  "ollama-cloud": { id: "ollama-cloud", alias: "ollamacloud", name: "Ollama Cloud", icon: "cloud", color: "#58A6FF", textIcon: "OC", website: "https://ollama.com", notice: { apiKeyUrl: "https://ollama.com/settings/keys" }, passthroughModels: true, serviceKinds: ["llm"] },
  synthetic: { id: "synthetic", alias: "synthetic", name: "Synthetic", icon: "verified_user", color: "#6366F1", textIcon: "SY", website: "https://synthetic.new", notice: { apiKeyUrl: "https://synthetic.new" }, passthroughModels: true, serviceKinds: ["llm"] },
  "kilo-gateway": { id: "kilo-gateway", alias: "kg", name: "Kilo Gateway", icon: "hub", color: "#617A91", textIcon: "KG", website: "https://kilo.ai", notice: { apiKeyUrl: "https://kilo.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  "opencode-zen": { id: "opencode-zen", alias: "opencode-zen", name: "OpenCode Zen", icon: "terminal", color: "#6366F1", textIcon: "OZ", website: "https://opencode.ai/zen", notice: { apiKeyUrl: "https://opencode.ai/zen" }, passthroughModels: true, serviceKinds: ["llm"] },
  "meta-llama": { id: "meta-llama", alias: "meta", name: "Meta Llama API", icon: "smart_toy", color: "#0F766E", textIcon: "ML", website: "https://llama.developer.meta.com", notice: { apiKeyUrl: "https://llama.developer.meta.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  moonshot: { id: "moonshot", alias: "moonshot", name: "Moonshot AI", icon: "rocket_launch", color: "#1E40AF", textIcon: "MS", website: "https://platform.moonshot.ai", notice: { apiKeyUrl: "https://platform.moonshot.ai/console/api-keys" }, passthroughModels: true, serviceKinds: ["llm"] },
  ovhcloud: { id: "ovhcloud", alias: "ovh", name: "OVHcloud AI", icon: "cloud", color: "#2563EB", textIcon: "OVH", website: "https://www.ovhcloud.com", notice: { apiKeyUrl: "https://www.ovhcloud.com/en/public-cloud/ai-endpoints/" }, passthroughModels: true, serviceKinds: ["llm"] },
  "lambda-ai": { id: "lambda-ai", alias: "lambda", name: "Lambda AI", icon: "bolt", color: "#7C3AED", textIcon: "LA", website: "https://lambda.ai", notice: { apiKeyUrl: "https://cloud.lambda.ai/api-keys" }, passthroughModels: true, serviceKinds: ["llm"] },
  "featherless-ai": { id: "featherless-ai", alias: "featherless", name: "Featherless AI", icon: "flutter_dash", color: "#EA580C", textIcon: "FL", website: "https://featherless.ai", notice: { text: "Free tier available — no credit card required.", apiKeyUrl: "https://featherless.ai/account/api-keys" }, passthroughModels: true, serviceKinds: ["llm"] },
  friendliai: { id: "friendliai", alias: "friendli", name: "FriendliAI", icon: "handshake", color: "#EC4899", textIcon: "FR", website: "https://friendli.ai", notice: { text: "Free tier for serverless inference — no credit card.", apiKeyUrl: "https://suite.friendli.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  llamagate: { id: "llamagate", alias: "llamagate", name: "LlamaGate", icon: "key", color: "#16A34A", textIcon: "LG", website: "https://llamagate.ai", notice: { apiKeyUrl: "https://llamagate.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  gigachat: { id: "gigachat", alias: "gigachat", name: "GigaChat (Sber)", icon: "lock_person", color: "#10B981", textIcon: "GC", website: "https://developers.sber.ru", notice: { apiKeyUrl: "https://developers.sber.ru/portal/products/gigachat-api" }, passthroughModels: true, serviceKinds: ["llm"] },
  venice: { id: "venice", alias: "venice", name: "Venice.ai", icon: "travel_explore", color: "#0EA5E9", textIcon: "VN", website: "https://venice.ai", notice: { apiKeyUrl: "https://venice.ai/settings/api" }, passthroughModels: true, serviceKinds: ["llm"] },
  codestral: { id: "codestral", alias: "codestral", name: "Codestral", icon: "terminal", color: "#FF7000", textIcon: "CS", website: "https://mistral.ai", notice: { apiKeyUrl: "https://console.mistral.ai/codestral" }, passthroughModels: true, serviceKinds: ["llm"] },
  upstage: { id: "upstage", alias: "upstage", name: "Upstage", icon: "trending_up", color: "#0F766E", textIcon: "UP", website: "https://www.upstage.ai", notice: { apiKeyUrl: "https://console.upstage.ai/api-keys" }, passthroughModels: true, serviceKinds: ["llm"] },
  maritalk: { id: "maritalk", alias: "maritalk", name: "Maritalk", icon: "translate", color: "#1D4ED8", textIcon: "MT", website: "https://www.maritaca.ai", notice: { apiKeyUrl: "https://plataforma.maritaca.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  nanogpt: { id: "nanogpt", alias: "nanogpt", name: "NanoGPT", icon: "chat", color: "#4F46E5", textIcon: "NG", website: "https://nano-gpt.com", notice: { apiKeyUrl: "https://nano-gpt.com/api" }, passthroughModels: true, serviceKinds: ["llm"] },
  piapi: { id: "piapi", alias: "pi", name: "PiAPI", icon: "api", color: "#7C4DFF", textIcon: "PI", website: "https://piapi.ai", notice: { apiKeyUrl: "https://piapi.ai/workspace" }, passthroughModels: true, serviceKinds: ["llm"] },
  getgoapi: { id: "getgoapi", alias: "ggo", name: "GoAPI", icon: "rocket_launch", color: "#FF6D00", textIcon: "GO", website: "https://api.getgoapi.com", notice: { apiKeyUrl: "https://api.getgoapi.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  laozhang: { id: "laozhang", alias: "lz", name: "LaoZhang AI", icon: "hub", color: "#FF1744", textIcon: "LZ", website: "https://api.laozhang.ai", notice: { apiKeyUrl: "https://api.laozhang.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  cablyai: { id: "cablyai", alias: "cablyai", name: "CablyAI", icon: "hub", color: "#FF4081", textIcon: "CA", website: "https://cablyai.com", notice: { apiKeyUrl: "https://cablyai.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  thebai: { id: "thebai", alias: "thebai", name: "TheB.AI", icon: "hub", color: "#3B82F6", textIcon: "TB", website: "https://theb.ai", notice: { apiKeyUrl: "https://beta.theb.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  fenayai: { id: "fenayai", alias: "fenayai", name: "FenayAI", icon: "hub", color: "#FF9800", textIcon: "FN", website: "https://fenayai.com", notice: { apiKeyUrl: "https://fenayai.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  empower: { id: "empower", alias: "empower", name: "Empower", icon: "hub", color: "#14B8A6", textIcon: "EM", website: "https://empower.dev", notice: { apiKeyUrl: "https://app.empower.dev" }, passthroughModels: true, serviceKinds: ["llm"] },
  poe: { id: "poe", alias: "poe", name: "Poe", icon: "hub", color: "#F97316", textIcon: "PO", website: "https://poe.com", notice: { apiKeyUrl: "https://poe.com/api_key" }, passthroughModels: true, serviceKinds: ["llm"] },
  galadriel: { id: "galadriel", alias: "galadriel", name: "Galadriel", icon: "auto_awesome", color: "#F59E0B", textIcon: "GA", website: "https://galadriel.com", notice: { apiKeyUrl: "https://dashboard.galadriel.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  wandb: { id: "wandb", alias: "wandb", name: "Weights & Biases", icon: "monitoring", color: "#FFBE0B", textIcon: "WB", website: "https://wandb.ai", notice: { apiKeyUrl: "https://wandb.ai/authorize" }, passthroughModels: true, serviceKinds: ["llm"] },
  volcengine: { id: "volcengine", alias: "volcengine", name: "Volcengine", icon: "local_fire_department", color: "#DC2626", textIcon: "VE", website: "https://www.volcengine.com", notice: { apiKeyUrl: "https://console.volcengine.com/ark" }, passthroughModels: true, serviceKinds: ["llm"] },
  gitlawb: { id: "gitlawb", alias: "glb", name: "Gitlawb (MiMo)", icon: "hub", color: "#10B981", textIcon: "GLB", website: "https://opengateway.gitlawb.com", notice: { text: "Free tier available — no credit card required.", apiKeyUrl: "https://opengateway.gitlawb.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  "gitlawb-gmi": { id: "gitlawb-gmi", alias: "glb-gmi", name: "Gitlawb (GMI Cloud)", icon: "hub", color: "#10B981", textIcon: "GMI", website: "https://opengateway.gitlawb.com", notice: { text: "Free tier available — no credit card required.", apiKeyUrl: "https://opengateway.gitlawb.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  bluesminds: { id: "bluesminds", alias: "bm", name: "BluesMinds", icon: "psychology", color: "#3B82F6", textIcon: "BM", website: "https://www.bluesminds.com", notice: { text: "Free daily pi credits — 200+ models.", apiKeyUrl: "https://www.bluesminds.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  "freemodel-dev": { id: "freemodel-dev", alias: "fmd", name: "FreeModel.dev", icon: "auto_awesome", color: "#8B5CF6", textIcon: "FM", website: "https://freemodel.dev", notice: { text: "$300 free credits — no credit card. GPT-5.4/5.5 via OpenAI-compatible API.", apiKeyUrl: "https://freemodel.dev" }, passthroughModels: true, serviceKinds: ["llm"] },
  freeaiapikey: { id: "freeaiapikey", alias: "faik", name: "FreeAIAPIKey", icon: "vpn_key", color: "#F59E0B", textIcon: "FK", website: "https://freeaiapikey.com", notice: { text: "Discounted proxy for 40+ models (GPT-5, Claude Opus 4.6, Qwen 3.5).", apiKeyUrl: "https://freeaiapikey.com/dashboard" }, passthroughModels: true, serviceKinds: ["llm"] },
  kie: { id: "kie", alias: "kie", name: "KIE.AI", icon: "hub", color: "#2563EB", textIcon: "KIE", website: "https://kie.ai", notice: { apiKeyUrl: "https://kie.ai/api-key" }, passthroughModels: true, serviceKinds: ["llm"] },
  hackclub: { id: "hackclub", alias: "hc", name: "Hackclub AI", icon: "auto_awesome", color: "#FF6B00", textIcon: "HC", website: "https://ai.hackclub.com", notice: { text: "Free AI for Hack Club members — 30+ models, no credit card." }, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  pollinations: { id: "pollinations", alias: "pol", name: "Pollinations AI", icon: "local_florist", color: "#4CAF50", textIcon: "PO", website: "https://pollinations.ai", notice: { text: "No API key required for free public endpoint." }, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  replicate: { id: "replicate", alias: "rep", name: "Replicate", icon: "auto_awesome", color: "#3B82F6", textIcon: "RE", website: "https://replicate.com", notice: { text: "Free community models — Llama 3.1, Mixtral, DeepSeek R1.", apiKeyUrl: "https://replicate.com/account/api-tokens" }, passthroughModels: true, serviceKinds: ["llm"] },
  poolside: { id: "poolside", alias: "poolside", name: "Poolside", icon: "code", color: "#3B82F6", textIcon: "PS", website: "https://poolside.ai", notice: { text: "Free Laguna coding agent models.", apiKeyUrl: "https://poolside.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  "arcee-ai": { id: "arcee-ai", alias: "arcee", name: "Arcee AI", icon: "auto_awesome", color: "#8B5CF6", textIcon: "AR", website: "https://arcee.ai", notice: { text: "Free Trinity Large Thinking model (262K context).", apiKeyUrl: "https://arcee.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  inclusionai: { id: "inclusionai", alias: "inclusion", name: "InclusionAI", icon: "psychology", color: "#10B981", textIcon: "IA", website: "https://inclusionai.com", notice: { text: "Free Ling-2.6-flash model (1T-param MoE).", apiKeyUrl: "https://inclusionai.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  liquid: { id: "liquid", alias: "liquid", name: "Liquid AI", icon: "water_drop", color: "#06B6D4", textIcon: "LQ", website: "https://liquid.ai", notice: { text: "Free LFM2.5 models — MIT spinoff, hybrid architecture.", apiKeyUrl: "https://liquid.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  nomic: { id: "nomic", alias: "nomic", name: "Nomic", icon: "hub", color: "#7C3AED", textIcon: "NM", website: "https://nomic.ai", notice: { text: "Free Nomic Embed API.", apiKeyUrl: "https://atlas.nomic.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  krutrim: { id: "krutrim", alias: "krutrim", name: "Krutrim", icon: "auto_awesome", color: "#F59E0B", textIcon: "KR", website: "https://krutrim.ai", notice: { text: "India's first AI (by Ola). Free tier available.", apiKeyUrl: "https://cloud.olakrutrim.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  monsterapi: { id: "monsterapi", alias: "monster", name: "MonsterAPI", icon: "cloud", color: "#EF4444", textIcon: "MA", website: "https://monsterapi.ai", notice: { text: "Free credits for decentralized GPU inference.", apiKeyUrl: "https://monsterapi.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  dify: { id: "dify", alias: "dify", name: "Dify", icon: "smart_toy", color: "#6366F1", textIcon: "DF", website: "https://dify.ai", notice: { text: "Open-source AI app builder + RAG platform.", apiKeyUrl: "https://dify.ai" }, passthroughModels: true, serviceKinds: ["llm"] },

  // === OmniRoute wave (Đợt 6) — gateways / inference hosts / regional ===
  tokenrouter: { id: "tokenrouter", alias: "trk", name: "TokenRouter", icon: "router", color: "#F59E0B", textIcon: "TK", website: "https://tokenrouter.com", notice: { apiKeyUrl: "https://tokenrouter.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  requesty: { id: "requesty", alias: "requesty", name: "Requesty", icon: "hub", color: "#6366F1", textIcon: "RQ", website: "https://requesty.ai", notice: { text: "BYOK gateway — ~200 free req/day.", apiKeyUrl: "https://requesty.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  zenmux: { id: "zenmux", alias: "zm", name: "ZenMux", icon: "hub", color: "#7C3AED", textIcon: "ZM", website: "https://zenmux.ai", notice: { apiKeyUrl: "https://zenmux.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  dgrid: { id: "dgrid", alias: "dgrid", name: "DGrid", icon: "grid_view", color: "#65A30D", textIcon: "DG", website: "https://dgrid.ai", notice: { apiKeyUrl: "https://dgrid.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  orcarouter: { id: "orcarouter", alias: "orcarouter", name: "OrcaRouter", icon: "router", color: "#0891B2", textIcon: "ORC", website: "https://www.orcarouter.ai", notice: { apiKeyUrl: "https://www.orcarouter.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  modelscope: { id: "modelscope", alias: "ms", name: "ModelScope", icon: "science", color: "#FF6A00", textIcon: "MS", website: "https://modelscope.cn", notice: { text: "Alibaba ModelScope inference.", apiKeyUrl: "https://modelscope.cn" }, passthroughModels: true, serviceKinds: ["llm"] },
  digitalocean: { id: "digitalocean", alias: "doai", name: "DigitalOcean AI", icon: "water", color: "#0060FF", textIcon: "DO", website: "https://docs.digitalocean.com/products/ai-platform/", notice: { apiKeyUrl: "https://cloud.digitalocean.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  alibaba: { id: "alibaba", alias: "ali", name: "Alibaba DashScope (Intl)", icon: "cloud", color: "#FF6600", textIcon: "AL", website: "https://bailian.console.alibabacloud.com/", notice: { apiKeyUrl: "https://bailian.console.alibabacloud.com/" }, passthroughModels: true, serviceKinds: ["llm"] },
  "alibaba-cn": { id: "alibaba-cn", alias: "alicn", name: "Alibaba DashScope (CN)", icon: "cloud", color: "#FF6600", textIcon: "AC", website: "https://bailian.console.aliyun.com/", notice: { apiKeyUrl: "https://bailian.console.aliyun.com/" }, passthroughModels: true, serviceKinds: ["llm"] },
  "bailian-coding-plan": { id: "bailian-coding-plan", alias: "bcp", name: "Alibaba Coding Plan", icon: "code", color: "#FF6600", textIcon: "BCP", website: "https://bailian.console.alibabacloud.com/", notice: { text: "DashScope coding plan (Anthropic-compatible).", apiKeyUrl: "https://bailian.console.alibabacloud.com/" }, passthroughModels: true, serviceKinds: ["llm"] },
  hcnsec: { id: "hcnsec", alias: "hcnsec", name: "Huancheng Public API", icon: "public", color: "#0EA5E9", textIcon: "HC", website: "https://api.hcnsec.cn", notice: { apiKeyUrl: "https://api.hcnsec.cn" }, passthroughModels: true, serviceKinds: ["llm"] },
  glmt: { id: "glmt", alias: "glmt", name: "GLM Thinking (Z.AI Coding)", icon: "psychology", color: "#1D4ED8", textIcon: "GT", website: "https://open.bigmodel.cn", notice: { apiKeyUrl: "https://open.bigmodel.cn" }, passthroughModels: true, serviceKinds: ["llm"] },
  sparkdesk: { id: "sparkdesk", alias: "sparkdesk", name: "SparkDesk", icon: "bolt", color: "#0066FF", textIcon: "SD", website: "https://xinghuo.xfyun.cn", notice: { apiKeyUrl: "https://console.xfyun.cn" }, passthroughModels: true, serviceKinds: ["llm"] },
  openvecta: { id: "openvecta", alias: "openvecta", name: "OpenVecta", icon: "hub", color: "#7C3AED", textIcon: "OV", website: "https://openvecta.com", notice: { apiKeyUrl: "https://openvecta.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  sumopod: { id: "sumopod", alias: "sumopod", name: "SumoPod", icon: "cloud", color: "#2563EB", textIcon: "SP", website: "https://ai.sumopod.com", notice: { apiKeyUrl: "https://ai.sumopod.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  kenari: { id: "kenari", alias: "kenari", name: "Kenari", icon: "auto_awesome", color: "#B5362A", textIcon: "KN", website: "https://kenari.id", notice: { apiKeyUrl: "https://kenari.id" }, passthroughModels: true, serviceKinds: ["llm"] },
  x5lab: { id: "x5lab", alias: "x5lab", name: "X5Lab", icon: "science", color: "#7C3AED", textIcon: "X5", website: "https://x5lab.dev", notice: { apiKeyUrl: "https://x5lab.dev" }, passthroughModels: true, serviceKinds: ["llm"] },
  wafer: { id: "wafer", alias: "wafer", name: "Wafer AI", icon: "hub", color: "#6366F1", textIcon: "WF", website: "https://wafer.ai", notice: { text: "Anthropic-compatible pass-through.", apiKeyUrl: "https://wafer.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  nube: { id: "nube", alias: "nube", name: "Nube.sh", icon: "cloud", color: "#2563EB", textIcon: "NB", website: "https://nube.sh", notice: { apiKeyUrl: "https://nube.sh" }, passthroughModels: true, serviceKinds: ["llm"] },
  qiniu: { id: "qiniu", alias: "qiniu", name: "Qiniu AI", icon: "cloud", color: "#1E88E5", textIcon: "QN", website: "https://www.qiniu.com", notice: { apiKeyUrl: "https://portal.qiniu.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  factory: { id: "factory", alias: "factory", name: "Factory", icon: "precision_manufacturing", color: "#0F172A", textIcon: "FA", website: "https://factory.ai", notice: { apiKeyUrl: "https://factory.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  openadapter: { id: "openadapter", alias: "oad", name: "OpenAdapter", icon: "hub", color: "#10B981", textIcon: "OD", website: "https://openadapter.dev", notice: { apiKeyUrl: "https://openadapter.dev" }, passthroughModels: true, serviceKinds: ["llm"] },
  pioneer: { id: "pioneer", alias: "pn", name: "Pioneer AI", icon: "rocket_launch", color: "#7C5CFF", textIcon: "PN", website: "https://pioneer.ai", notice: { apiKeyUrl: "https://pioneer.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  "charm-hyper": { id: "charm-hyper", alias: "charm", name: "Charm Hyper", icon: "terminal", color: "#C026D3", textIcon: "CH", website: "https://hyper.charm.land", notice: { apiKeyUrl: "https://hyper.charm.land" }, passthroughModels: true, serviceKinds: ["llm"] },
  dit: { id: "dit", alias: "dai", name: "DIT.ai", icon: "hub", color: "#0EA5E9", textIcon: "DT", website: "https://dit.ai", notice: { apiKeyUrl: "https://dit.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  bai: { id: "bai", alias: "thebai2", name: "b.ai", icon: "hub", color: "#3B82F6", textIcon: "BAI", website: "https://theb.ai", notice: { apiKeyUrl: "https://theb.ai" }, passthroughModels: true, serviceKinds: ["llm"] },
  "v0-vercel": { id: "v0-vercel", alias: "v0api", name: "v0 (Vercel API)", icon: "code", color: "#000000", textIcon: "V0", website: "https://v0.dev", notice: { apiKeyUrl: "https://v0.dev" }, passthroughModels: true, serviceKinds: ["llm"] },
  "codebuddy-cn": { id: "codebuddy-cn", alias: "cbcn", name: "CodeBuddy CN", icon: "smart_toy", color: "#006EFF", textIcon: "CB", website: "https://copilot.tencent.com", notice: { apiKeyUrl: "https://copilot.tencent.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  "kimi-coding-apikey": { id: "kimi-coding-apikey", alias: "kmca", name: "Kimi Coding (API Key)", icon: "psychology", color: "#1E40AF", textIcon: "KCA", website: "https://www.kimi.com/code", notice: { apiKeyUrl: "https://www.kimi.com/code" }, passthroughModels: true, serviceKinds: ["llm"] },
  theoldllm: { id: "theoldllm", alias: "tllm", name: "The Old LLM (Free)", icon: "auto_awesome", color: "#8B5CF6", textIcon: "TL", website: "https://theoldllm.vercel.app", notice: { text: "Free public endpoint — no API key required for many models." }, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  mimocode: { id: "mimocode", alias: "mcode", name: "MiMoCode (Free)", icon: "code", color: "#FF6B35", textIcon: "MC", website: "https://mimo.mi.com", notice: { text: "Xiaomi MiMo free coding endpoint." }, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  auggie: { id: "auggie", alias: "aug", name: "Augment (Auggie CLI)", icon: "terminal", color: "#7C3AED", textIcon: "AU", website: "https://augmentcode.com", notice: { text: "Local CLI passthrough — auth via auggie login outside XLab." }, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },

  // === Chinese LLM providers ===
  baidu: { id: "baidu", alias: "baidu", name: "Baidu (ERNIE)", icon: "auto_awesome", color: "#2932E1", textIcon: "BD", website: "https://yiyan.baidu.com", notice: { text: "Free ERNIE Speed/Lite models.", apiKeyUrl: "https://console.bce.baidu.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  tencent: { id: "tencent", alias: "tencent", name: "Tencent Hunyuan", icon: "auto_awesome", color: "#07C160", textIcon: "TC", website: "https://hunyuan.tencent.com", notice: { text: "Free Hunyuan Lite models.", apiKeyUrl: "https://console.cloud.tencent.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  iflytek: { id: "iflytek", alias: "iflytek", name: "iFlytek Spark", icon: "auto_awesome", color: "#0066FF", textIcon: "IF", website: "https://xinghuo.xfyun.cn", notice: { text: "Free Spark Lite models.", apiKeyUrl: "https://console.xfyun.cn" }, passthroughModels: true, serviceKinds: ["llm"] },
  baichuan: { id: "baichuan", alias: "baichuan", name: "Baichuan", icon: "auto_awesome", color: "#6366F1", textIcon: "BC", website: "https://baichuan.com", notice: { apiKeyUrl: "https://platform.baichuan-ai.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  yi: { id: "yi", alias: "yi", name: "Yi (01.AI)", icon: "auto_awesome", color: "#10B981", textIcon: "YI", website: "https://01.ai", notice: { text: "Free Yi-Light models.", apiKeyUrl: "https://platform.lingyiwanwu.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  stepfun: { id: "stepfun", alias: "stepfun", name: "StepFun", icon: "auto_awesome", color: "#8B5CF6", textIcon: "SF", website: "https://stepfun.com", notice: { text: "Free Step-2 models.", apiKeyUrl: "https://platform.stepfun.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  "360ai": { id: "360ai", alias: "360ai", name: "360 AI", icon: "auto_awesome", color: "#00B96B", textIcon: "360", website: "https://ai.360.cn", notice: { text: "Free 360 AI Brain models.", apiKeyUrl: "https://ai.360.cn" }, passthroughModels: true, serviceKinds: ["llm"] },
  sensenova: { id: "sensenova", alias: "sensenova", name: "SenseNova", icon: "auto_awesome", color: "#0066FF", textIcon: "SN", website: "https://platform.sensenova.cn", notice: { apiKeyUrl: "https://platform.sensenova.cn" }, passthroughModels: true, serviceKinds: ["llm"] },
  doubao: { id: "doubao", alias: "doubao", name: "Doubao", icon: "auto_awesome", color: "#FE2C55", textIcon: "DB", website: "https://doubao.com", notice: { text: "Free Doubao models (ByteDance).", apiKeyUrl: "https://console.volcengine.com" }, passthroughModels: true, serviceKinds: ["llm"] },
  coze: { id: "coze", alias: "coze", name: "Coze", icon: "smart_toy", color: "#3B82F6", textIcon: "CZ", website: "https://coze.com", notice: { text: "ByteDance agent platform.", apiKeyUrl: "https://coze.com/open/api" }, passthroughModels: true, serviceKinds: ["llm"] },

  // === Enterprise cloud (OpenAI-compatible; require base URL / providerSpecificData) ===
  "azure-ai": { id: "azure-ai", alias: "azure-ai", name: "Azure AI Foundry", icon: "cloud", color: "#2563EB", textIcon: "AF", website: "https://learn.microsoft.com/azure/ai-foundry", notice: { text: "Use your Azure AI Foundry key + resource base URL.", apiKeyUrl: "https://ai.azure.com" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  watsonx: { id: "watsonx", alias: "watsonx", name: "IBM watsonx.ai", icon: "hub", color: "#0F62FE", textIcon: "WX", website: "https://www.ibm.com/products/watsonx-ai", notice: { text: "watsonx bearer token + /ml/gateway/v1 base URL.", apiKeyUrl: "https://dataplatform.cloud.ibm.com" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  oci: { id: "oci", alias: "oci", name: "OCI Generative AI", icon: "cloud", color: "#C74634", textIcon: "OCI", website: "https://www.oracle.com/artificial-intelligence/generative-ai", notice: { text: "OCI API key + regional OpenAI base URL.", apiKeyUrl: "https://cloud.oracle.com" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  sap: { id: "sap", alias: "sap", name: "SAP Generative AI Hub", icon: "business", color: "#0FAAFF", textIcon: "SAP", website: "https://help.sap.com/docs/sap-ai-core", notice: { text: "SAP AI Core bearer token + deployment URL.", apiKeyUrl: "https://help.sap.com" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  databricks: { id: "databricks", alias: "databricks", name: "Databricks", icon: "table_chart", color: "#F97316", textIcon: "DB", website: "https://www.databricks.com", notice: { text: "Databricks PAT + workspace serving base URL.", apiKeyUrl: "https://www.databricks.com" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  datarobot: { id: "datarobot", alias: "datarobot", name: "DataRobot", icon: "precision_manufacturing", color: "#6D28D9", textIcon: "DR", website: "https://docs.datarobot.com", notice: { text: "DataRobot API token + gateway/deployment URL.", apiKeyUrl: "https://app.datarobot.com" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  clarifai: { id: "clarifai", alias: "clarifai", name: "Clarifai", icon: "hub", color: "#7C3AED", textIcon: "CL", website: "https://docs.clarifai.com", notice: { text: "Clarifai PAT — OpenAI-compatible /v2/ext/openai/v1.", apiKeyUrl: "https://clarifai.com/settings/security" }, passthroughModels: true, serviceKinds: ["llm"] },
  snowflake: { id: "snowflake", alias: "snowflake", name: "Snowflake Cortex", icon: "ac_unit", color: "#29B5E8", textIcon: "SF", website: "https://www.snowflake.com", notice: { text: "Snowflake token + account Cortex base URL.", apiKeyUrl: "https://www.snowflake.com" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  heroku: { id: "heroku", alias: "heroku", name: "Heroku AI", icon: "cloud_upload", color: "#7C3AED", textIcon: "HK", website: "https://www.heroku.com", notice: { text: "Heroku inference key + base URL.", apiKeyUrl: "https://www.heroku.com" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  bedrock: { id: "bedrock", alias: "br", name: "Amazon Bedrock", icon: "cloud", color: "#FF9900", textIcon: "BR", website: "https://aws.amazon.com/bedrock", notice: { text: "Bedrock API key (Bearer) on OpenAI-compatible endpoint. Set providerSpecificData.region (default us-east-1). Models use Bedrock ids e.g. us.anthropic.claude-sonnet-4-6.", apiKeyUrl: "https://console.aws.amazon.com/bedrock" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },

  // === Upstream proxy meta-providers (chain to another router instance) ===
  cliproxyapi: { id: "cliproxyapi", alias: "cpa", name: "CLIProxyAPI", icon: "router", color: "#6366F1", textIcon: "CPA", website: "https://github.com/router-for-me/CLIProxyAPI", notice: { text: "Chain to a running CLIProxyAPI instance. Set providerSpecificData.baseUrl (default http://localhost:8317/v1) + its management API key.", apiKeyUrl: "https://github.com/router-for-me/CLIProxyAPI" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },
  "9router": { id: "9router", alias: "nr", name: "9router (Upstream)", icon: "router", color: "#0EA5E9", textIcon: "9R", website: "https://www.npmjs.com/package/9router", notice: { text: "Chain to a running 9router instance. Set providerSpecificData.baseUrl (default http://localhost:20130/v1) + its API key.", apiKeyUrl: "https://www.npmjs.com/package/9router" }, hasProviderSpecificData: true, passthroughModels: true, serviceKinds: ["llm"] },

  // === Cloud-agent providers (task-based APIs; registered for catalog parity) ===
  // These expose async coding-task APIs (create task / poll status), not chat
  // completions; a dedicated agent-task handler is tracked in the parity checklist.
  jules: { id: "jules", alias: "jules", name: "Google Jules", icon: "engineering", color: "#4285F4", textIcon: "JL", website: "https://jules.google", notice: { text: "Cloud coding-agent (task-based). Create/manage tasks via API key.", apiKeyUrl: "https://jules.google" }, hidden: true, passthroughModels: true, serviceKinds: ["llm"] },
  devin: { id: "devin", alias: "devin", name: "Devin", icon: "smart_toy", color: "#111827", textIcon: "DV", website: "https://devin.ai", notice: { text: "Cloud coding-agent (task-based) via Devin API key.", apiKeyUrl: "https://devin.ai" }, hidden: true, passthroughModels: true, serviceKinds: ["llm"] },
  "codex-cloud": { id: "codex-cloud", alias: "codex-cloud", name: "Codex Cloud", icon: "cloud", color: "#10A37F", textIcon: "CC", website: "https://openai.com/codex", notice: { text: "OpenAI Codex Cloud task API (OpenAI API key with Codex Cloud access).", apiKeyUrl: "https://platform.openai.com/api-keys" }, hidden: true, passthroughModels: true, serviceKinds: ["llm"] },
  auto: { id: "auto", alias: "auto", name: "Auto (Zero-Config)", icon: "auto_awesome", color: "#6366F1", textIcon: "AUTO", systemOnly: true, passthroughModels: true, serviceKinds: ["llm"], notice: { text: "Zero-config routing: use model 'auto' (or 'auto/<model>') and the router picks the best connected provider (last-known-good + priority)." } },

  // === Local / Self-hosted (OpenAI-compatible localhost; override baseUrl in providerSpecificData) ===
  "lm-studio": { id: "lm-studio", alias: "lmstudio", name: "LM Studio", icon: "dns", color: "#4A148C", textIcon: "LM", website: "https://lmstudio.ai", notice: { text: "Local OpenAI-compatible server (default http://localhost:1234/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  vllm: { id: "vllm", alias: "vllm", name: "vLLM", icon: "memory", color: "#0F766E", textIcon: "VL", website: "https://github.com/vllm-project/vllm", notice: { text: "Local vLLM OpenAI-compatible server (default http://localhost:8000/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  lemonade: { id: "lemonade", alias: "lemonade", name: "Lemonade Server", icon: "bolt", color: "#F59E0B", textIcon: "LM", website: "https://lemonade-server.ai", notice: { text: "Local Lemonade server (default http://localhost:13305/api/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  llamafile: { id: "llamafile", alias: "llamafile", name: "Llamafile", icon: "article", color: "#EA580C", textIcon: "LF", website: "https://github.com/Mozilla-Ocho/llamafile", notice: { text: "Local Llamafile server (default http://127.0.0.1:8080/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  "llama-cpp": { id: "llama-cpp", alias: "llamacpp", name: "llama.cpp", icon: "memory", color: "#795548", textIcon: "LC", website: "https://github.com/ggml-org/llama.cpp", notice: { text: "Local llama-server (default http://127.0.0.1:8080/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  triton: { id: "triton", alias: "triton", name: "NVIDIA Triton", icon: "developer_board", color: "#76B900", textIcon: "TR", website: "https://developer.nvidia.com/triton-inference-server", notice: { text: "Local Triton OpenAI-compatible (default http://localhost:8000/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  "docker-model-runner": { id: "docker-model-runner", alias: "dmr", name: "Docker Model Runner", icon: "inventory_2", color: "#2496ED", textIcon: "DM", website: "https://docs.docker.com/ai/model-runner/", notice: { text: "Local Docker Model Runner (default http://localhost:12434/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  xinference: { id: "xinference", alias: "xinference", name: "XInference", icon: "hub", color: "#DC2626", textIcon: "XI", website: "https://inference.readthedocs.io", notice: { text: "Local XInference (default http://localhost:9997/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  oobabooga: { id: "oobabooga", alias: "ooba", name: "oobabooga", icon: "dns", color: "#8B5CF6", textIcon: "OO", website: "https://github.com/oobabooga/text-generation-webui", notice: { text: "Local oobabooga (default http://localhost:5000/v1)." }, hasProviderSpecificData: true, passthroughModels: true, noAuth: true, serviceKinds: ["llm"] },
  "vertex-partner": { id: "vertex-partner", alias: "vxp", name: "Vertex Partner", icon: "cloud", color: "#34A853", textIcon: "VP", website: "https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-partner-models", notice: { apiKeyUrl: "https://console.cloud.google.com/iam-admin/serviceaccounts" } },
  tavily: { id: "tavily", alias: "tavily", name: "Tavily", icon: "search", color: "#5B21B6", textIcon: "TV", website: "https://tavily.com", notice: { apiKeyUrl: "https://app.tavily.com/home" }, serviceKinds: ["webSearch", "webFetch"], searchConfig: { baseUrl: "https://api.tavily.com/search", method: "POST", authType: "apikey", authHeader: "bearer", costPerQuery: 0.008, freeMonthlyQuota: 1000, searchTypes: ["web", "news"], defaultMaxResults: 5, maxMaxResults: 20, timeoutMs: 10000, cacheTTLMs: 300000 }, fetchConfig: { baseUrl: "https://api.tavily.com/extract", method: "POST", authType: "apikey", authHeader: "bearer", costPerQuery: 0.008, freeMonthlyQuota: 1000, formats: ["markdown", "text"], maxCharacters: 100000, timeoutMs: 15000 } },
  "brave-search": { id: "brave-search", alias: "brave", name: "Brave Search", icon: "travel_explore", color: "#FB542B", textIcon: "BR", website: "https://brave.com/search/api", notice: { apiKeyUrl: "https://api-dashboard.search.brave.com/app/keys" }, serviceKinds: ["webSearch"], searchConfig: { baseUrl: "https://api.search.brave.com/res/v1", method: "GET", authType: "apikey", authHeader: "x-subscription-token", costPerQuery: 0.005, freeMonthlyQuota: 1000, searchTypes: ["web", "news"], defaultMaxResults: 5, maxMaxResults: 20, timeoutMs: 10000, cacheTTLMs: 300000 } },
  serper: { id: "serper", alias: "serper", name: "Serper", icon: "search", color: "#4F46E5", textIcon: "SP", website: "https://serper.dev", notice: { apiKeyUrl: "https://serper.dev/api-key" }, serviceKinds: ["webSearch"], searchConfig: { baseUrl: "https://google.serper.dev", method: "POST", authType: "apikey", authHeader: "x-api-key", costPerQuery: 0.001, freeMonthlyQuota: 2500, searchTypes: ["web", "news"], defaultMaxResults: 5, maxMaxResults: 100, timeoutMs: 10000, cacheTTLMs: 300000 } },
  exa: { id: "exa", alias: "exa", name: "Exa", icon: "manage_search", color: "#2563EB", textIcon: "EX", website: "https://exa.ai", notice: { apiKeyUrl: "https://dashboard.exa.ai/api-keys" }, serviceKinds: ["webSearch", "webFetch"], searchConfig: { baseUrl: "https://api.exa.ai/search", method: "POST", authType: "apikey", authHeader: "x-api-key", costPerQuery: 0.007, freeMonthlyQuota: 1000, searchTypes: ["web", "news"], defaultMaxResults: 5, maxMaxResults: 100, timeoutMs: 10000, cacheTTLMs: 300000 }, fetchConfig: { baseUrl: "https://api.exa.ai/contents", method: "POST", authType: "apikey", authHeader: "x-api-key", costPerQuery: 0.001, freeMonthlyQuota: 1000, formats: ["text", "markdown"], maxCharacters: 100000, timeoutMs: 15000 } },
  searxng: { id: "searxng", alias: "searxng", name: "SearXNG", icon: "saved_search", color: "#3B82F6", textIcon: "SX", website: "https://docs.searxng.org", serviceKinds: ["webSearch"], noAuth: true, searchConfig: { baseUrl: "http://localhost:8888/search", method: "GET", authType: "none", authHeader: "none", costPerQuery: 0, freeMonthlyQuota: 999999, searchTypes: ["web", "news"], defaultMaxResults: 5, maxMaxResults: 50, timeoutMs: 10000, cacheTTLMs: 180000 } },
  "google-pse": { id: "google-pse", alias: "gpse", name: "Google PSE", icon: "search", color: "#4285F4", textIcon: "GP", website: "https://programmablesearchengine.google.com", notice: { apiKeyUrl: "https://programmablesearchengine.google.com/controlpanel/create" }, serviceKinds: ["webSearch"], searchConfig: { baseUrl: "https://www.googleapis.com/customsearch/v1", method: "GET", authType: "apikey", authHeader: "key", costPerQuery: 0.005, freeMonthlyQuota: 3000, searchTypes: ["web", "news"], defaultMaxResults: 5, maxMaxResults: 10, timeoutMs: 10000, cacheTTLMs: 300000 } },
  linkup: { id: "linkup", alias: "linkup", name: "Linkup", icon: "link", color: "#0EA5E9", textIcon: "LK", website: "https://linkup.so", notice: { apiKeyUrl: "https://app.linkup.so/api-keys" }, serviceKinds: ["webSearch"], searchConfig: { baseUrl: "https://api.linkup.so/v1/search", method: "POST", authType: "apikey", authHeader: "bearer", costPerQuery: 0.005, freeMonthlyQuota: 1000, searchTypes: ["web"], defaultMaxResults: 5, maxMaxResults: 50, timeoutMs: 10000, cacheTTLMs: 300000 } },
  searchapi: { id: "searchapi", alias: "searchapi", name: "SearchAPI", icon: "search", color: "#0EA5A4", textIcon: "SA", website: "https://www.searchapi.io", notice: { apiKeyUrl: "https://www.searchapi.io/dashboard" }, serviceKinds: ["webSearch"], searchConfig: { baseUrl: "https://www.searchapi.io/api/v1/search", method: "GET", authType: "apikey", authHeader: "api_key", costPerQuery: 0.004, freeMonthlyQuota: 100, searchTypes: ["web", "news"], defaultMaxResults: 5, maxMaxResults: 100, timeoutMs: 10000, cacheTTLMs: 300000 } },
  youcom: { id: "youcom", alias: "youcom", name: "You.com Search", icon: "search", color: "#7C3AED", textIcon: "YC", website: "https://you.com", notice: { apiKeyUrl: "https://api.you.com" }, serviceKinds: ["webSearch"], searchConfig: { baseUrl: "https://ydc-index.io/v1/search", method: "GET", authType: "apikey", authHeader: "x-api-key", costPerQuery: 0.005, freeMonthlyQuota: 0, searchTypes: ["web", "news"], defaultMaxResults: 5, maxMaxResults: 100, timeoutMs: 10000, cacheTTLMs: 300000 } },
  firecrawl: { id: "firecrawl", alias: "firecrawl", name: "Firecrawl", icon: "local_fire_department", color: "#F59E0B", textIcon: "FC", website: "https://firecrawl.dev", notice: { apiKeyUrl: "https://www.firecrawl.dev/app/api-keys" }, serviceKinds: ["webFetch"], fetchConfig: { baseUrl: "https://api.firecrawl.dev/v1/scrape", method: "POST", authType: "apikey", authHeader: "bearer", costPerQuery: 0.002, freeMonthlyQuota: 500, formats: ["markdown", "html", "text"], maxCharacters: 200000, timeoutMs: 30000 } },
  "fal-ai": { id: "fal-ai", alias: "fal", name: "Fal.ai", icon: "image", color: "#2563EB", textIcon: "FL", website: "https://fal.ai", notice: { apiKeyUrl: "https://fal.ai/dashboard/keys" }, serviceKinds: ["image"], imageConfig: { baseUrl: "https://api.fal.ai/v1/models?limit=1", method: "GET", authType: "apikey", authHeader: "key" } },
  "stability-ai": { id: "stability-ai", alias: "stability", name: "Stability AI", icon: "image", color: "#8B5CF6", textIcon: "SA", website: "https://stability.ai", notice: { apiKeyUrl: "https://platform.stability.ai/account/keys" }, serviceKinds: ["image"], imageConfig: { baseUrl: "https://api.stability.ai/v1/user/account", method: "GET", authType: "apikey", authHeader: "bearer" } },
  "black-forest-labs": { id: "black-forest-labs", alias: "bfl", name: "Black Forest Labs", icon: "image", color: "#111827", textIcon: "BF", website: "https://blackforestlabs.ai", notice: { apiKeyUrl: "https://api.bfl.ai" }, serviceKinds: ["image"], imageConfig: { baseUrl: "https://api.bfl.ai/v1/get_result?id=ping", method: "GET", authType: "apikey", authHeader: "x-key" } },
  recraft: { id: "recraft", alias: "recraft", name: "Recraft", icon: "image", color: "#EC4899", textIcon: "RC", website: "https://recraft.ai", notice: { apiKeyUrl: "https://www.recraft.ai/profile/api" }, serviceKinds: ["image"], imageConfig: { baseUrl: "https://external.api.recraft.ai/v1/users/me", method: "GET", authType: "apikey", authHeader: "bearer" } },
  topaz: { id: "topaz", alias: "topaz", name: "Topaz", icon: "image", color: "#059669", textIcon: "TP", website: "https://topazlabs.com", notice: { apiKeyUrl: "https://topazlabs.com/account" }, serviceKinds: ["image"] },
  runwayml: { id: "runwayml", alias: "runway", name: "Runway ML", icon: "movie", color: "#000000", textIcon: "RW", website: "https://runwayml.com", notice: { apiKeyUrl: "https://dev.runwayml.com" }, serviceKinds: ["image", "video"], imageConfig: { baseUrl: "https://api.dev.runwayml.com/v1/organization", method: "GET", authType: "apikey", authHeader: "bearer", extraHeaders: { "X-Runway-Version": "2024-11-06" } } },
  ideogram: { id: "ideogram", alias: "ideo", name: "Ideogram", icon: "image", color: "#EC4899", textIcon: "ID", website: "https://ideogram.ai", notice: { apiKeyUrl: "https://ideogram.ai/manage-api" }, serviceKinds: ["image"], imageConfig: { baseUrl: "https://api.ideogram.ai/v1/ideogram-v3/generate", method: "POST", authType: "apikey", authHeader: "api-key" } },
  leonardo: { id: "leonardo", alias: "leo", name: "Leonardo AI", icon: "palette", color: "#8B5CF6", textIcon: "LE", website: "https://leonardo.ai", notice: { apiKeyUrl: "https://app.leonardo.ai/api-access" }, serviceKinds: ["image", "video"], imageConfig: { baseUrl: "https://cloud.leonardo.ai/api/rest/v1/me", method: "GET", authType: "apikey", authHeader: "bearer" } },
  haiper: { id: "haiper", alias: "hp", name: "Haiper", icon: "movie", color: "#6366F1", textIcon: "HP", website: "https://haiper.ai", notice: { apiKeyUrl: "https://haiper.ai/haiper-api" }, serviceKinds: ["video"] },
  suno: { id: "suno", alias: "suno", name: "Suno", icon: "music_note", color: "#F59E0B", textIcon: "SU", website: "https://suno.ai", notice: { text: "Music generation. Requires session cookie (Clerk auth). Async task-based — see /v1/audio/music.", apiKeyUrl: "https://suno.ai" }, authType: "cookie", serviceKinds: ["music"] },
  udio: { id: "udio", alias: "udio", name: "Udio", icon: "music_note", color: "#10B981", textIcon: "UD", website: "https://udio.com", notice: { text: "Music generation. Requires session cookie (Supabase auth). Async task-based — see /v1/audio/music.", apiKeyUrl: "https://udio.com" }, authType: "cookie", serviceKinds: ["music"] },
  "aws-polly": { id: "aws-polly", alias: "polly", name: "AWS Polly", icon: "record_voice_over", color: "#FF9900", textIcon: "PL", website: "https://aws.amazon.com/polly/", notice: { text: "Use AWS Secret Access Key as API key; set providerSpecificData.accessKeyId and optional region.", apiKeyUrl: "https://console.aws.amazon.com/iam/home#/security_credentials" }, serviceKinds: ["tts"], hasProviderSpecificData: true, ttsConfig: { baseUrl: "https://polly.{region}.amazonaws.com/v1/speech", authType: "apikey", authHeader: "aws-sigv4", format: "aws-polly", models: [{ id: "standard", name: "Standard" }, { id: "neural", name: "Neural" }, { id: "long-form", name: "Long-form" }, { id: "generative", name: "Generative" }] } },
  "jina-ai": { id: "jina-ai", alias: "jina", name: "Jina AI", icon: "blur_on", color: "#2563EB", textIcon: "JA", website: "https://jina.ai", notice: { text: "10M free tokens on signup (non-commercial), no credit card required.", apiKeyUrl: "https://jina.ai/?sui=apikey" }, serviceKinds: ["embedding"], embeddingConfig: { baseUrl: "https://api.jina.ai/v1/embeddings", authType: "apikey", authHeader: "bearer", models: [{ id: "jina-embeddings-v3", name: "Jina Embeddings v3", dimensions: 1024 }, { id: "jina-embeddings-v2-base-en", name: "Jina Embeddings v2 Base EN", dimensions: 768 }, { id: "jina-embeddings-v2-base-code", name: "Jina Embeddings v2 Base Code", dimensions: 768 }] } },
  "jina-reader": { id: "jina-reader", alias: "jina", name: "Jina Reader", icon: "menu_book", color: "#000000", textIcon: "JR", website: "https://jina.ai/reader", notice: { apiKeyUrl: "https://jina.ai/?sui=apikey" }, serviceKinds: ["webFetch"], fetchConfig: { baseUrl: "https://r.jina.ai", method: "GET", authType: "apikey", authHeader: "bearer", costPerQuery: 0, freeMonthlyQuota: 1000000, formats: ["markdown", "text", "html"], maxCharacters: 200000, timeoutMs: 30000 } },
};

// Web Cookie Providers (use browser session cookie instead of API key)
export const WEB_COOKIE_PROVIDERS = {
  "grok-web": { id: "grok-web", alias: "gw", name: "Grok Web (Subscription)", icon: "auto_awesome", color: "#1DA1F2", textIcon: "GW", website: "https://grok.com", authType: "cookie", authHint: "Paste your sso= cookie value from grok.com", passthroughModels: true, serviceKinds: ["llm"] },
  "perplexity-web": { id: "perplexity-web", alias: "pw", name: "Perplexity Web (Pro/Max)", icon: "search", color: "#20808D", textIcon: "PW", website: "https://www.perplexity.ai", authType: "cookie", authHint: "Paste your __Secure-next-auth.session-token cookie value from perplexity.ai", serviceKinds: ["llm"] },
  "duckduckgo-web": { id: "duckduckgo-web", alias: "ddgw", name: "DuckDuckGo AI Chat", icon: "auto_awesome", color: "#DE5833", textIcon: "DDG", website: "https://duckduckgo.com/duckchat", authType: "none", noAuth: true, passthroughModels: true, serviceKinds: ["llm"], notice: { text: "Free, anonymous — no credentials required. Models: gpt-4o-mini, gpt-5-mini, o4-mini, claude-3-haiku, llama-3.3-70b, mixtral-small-3, gpt-oss-120b." } },
  "chatgpt-web": { id: "chatgpt-web", alias: "cgpt-web", name: "ChatGPT Web (Plus/Pro)", icon: "auto_awesome", color: "#10A37F", textIcon: "CG", website: "https://chatgpt.com", authType: "cookie", authHint: "Paste your __Secure-next-auth.session-token cookie from chatgpt.com", passthroughModels: true, serviceKinds: ["llm"] },
  "gemini-web": { id: "gemini-web", alias: "gweb", name: "Gemini Web (Free)", icon: "auto_awesome", color: "#4285F4", textIcon: "GWeb", website: "https://gemini.google.com", authType: "cookie", authHint: "Paste your __Secure-1PSID cookie from gemini.google.com", passthroughModels: true, serviceKinds: ["llm"] },
  "claude-web": { id: "claude-web", alias: "cw", name: "Claude Web", icon: "auto_awesome", color: "#D97757", textIcon: "CW", website: "https://claude.ai", authType: "cookie", authHint: "Paste your session cookie from claude.ai", passthroughModels: true, serviceKinds: ["llm"] },
  "deepseek-web": { id: "deepseek-web", alias: "ds-web", name: "DeepSeek Web", icon: "auto_awesome", color: "#4D6BFE", textIcon: "DS", website: "https://chat.deepseek.com", authType: "cookie", authHint: "Paste your userToken from chat.deepseek.com (Local Storage → userToken)", passthroughModels: true, serviceKinds: ["llm"] },
  "copilot-web": { id: "copilot-web", alias: "copilot", name: "Microsoft Copilot Web", icon: "auto_awesome", color: "#0078D4", textIcon: "CP", website: "https://copilot.microsoft.com", authType: "cookie", authHint: "Paste your access_token from copilot.microsoft.com", passthroughModels: true, serviceKinds: ["llm"] },
  "blackbox-web": { id: "blackbox-web", alias: "bb-web", name: "Blackbox Web (Subscription)", icon: "view_in_ar", color: "#1A1A2E", textIcon: "BW", website: "https://app.blackbox.ai", authType: "cookie", authHint: "Paste your __Secure-authjs.session-token from app.blackbox.ai", passthroughModels: true, serviceKinds: ["llm"] },
  "muse-spark-web": { id: "muse-spark-web", alias: "ms-web", name: "Muse Spark Web (Meta AI)", icon: "auto_awesome", color: "#0866FF", textIcon: "MS", website: "https://www.meta.ai", authType: "cookie", authHint: "Paste your abra_sess cookie from meta.ai", passthroughModels: true, serviceKinds: ["llm"] },
  "t3-web": { id: "t3-web", alias: "t3chat", name: "t3.chat (Pro/Free)", icon: "auto_awesome", color: "#7C3AED", textIcon: "T3", website: "https://t3.chat", authType: "cookie", authHint: "Paste convex-session-id from t3.chat", passthroughModels: true, serviceKinds: ["llm"] },
  "inner-ai": { id: "inner-ai", alias: "in-ai", name: "Inner.ai (Subscription)", icon: "auto_awesome", color: "#1A56DB", textIcon: "IA", website: "https://app.innerai.com", authType: "cookie", authHint: "Paste your token cookie + email from app.innerai.com", passthroughModels: true, serviceKinds: ["llm"] },
  "adapta-web": { id: "adapta-web", alias: "adp-web", name: "Adapta.org (Adapta One Web)", icon: "auto_awesome", color: "#6E3AD3", textIcon: "AW", website: "https://agent.adapta.one", authType: "cookie", authHint: "Paste your __client cookie from agent.adapta.one", passthroughModels: true, serviceKinds: ["llm"] },
  huggingchat: { id: "huggingchat", alias: "hgc", name: "HuggingChat (Free)", icon: "auto_awesome", color: "#FFD21E", textIcon: "HC", website: "https://huggingface.co/chat", authType: "cookie", authHint: "Optional hf-chat cookie from huggingface.co/chat", passthroughModels: true, serviceKinds: ["llm"] },
  phind: { id: "phind", alias: "ph", name: "Phind (Free)", icon: "auto_awesome", color: "#000000", textIcon: "PH", website: "https://www.phind.com", authType: "cookie", authHint: "Optional session cookie from phind.com", passthroughModels: true, serviceKinds: ["llm"] },
  "poe-web": { id: "poe-web", alias: "poe-web", name: "Poe Web (Subscription)", icon: "auto_awesome", color: "#6C3AED", textIcon: "PW", website: "https://poe.com", authType: "cookie", authHint: "Paste your p-b cookie from poe.com", passthroughModels: true, serviceKinds: ["llm"] },
  "venice-web": { id: "venice-web", alias: "ven", name: "Venice Web (Privacy)", icon: "auto_awesome", color: "#22C55E", textIcon: "VW", website: "https://venice.ai", authType: "cookie", authHint: "Paste your session cookie from venice.ai", passthroughModels: true, serviceKinds: ["llm"] },
  "v0-vercel-web": { id: "v0-vercel-web", alias: "v0", name: "v0 Vercel Web (Code Gen)", icon: "auto_awesome", color: "#000000", textIcon: "V0", website: "https://v0.dev", authType: "cookie", authHint: "Paste your session cookie from v0.dev", passthroughModels: true, serviceKinds: ["llm"] },
  "kimi-web": { id: "kimi-web", alias: "kimi-web", name: "Kimi Web (Moonshot AI)", icon: "auto_awesome", color: "#2563EB", textIcon: "KW", website: "https://kimi.moonshot.cn", authType: "cookie", authHint: "Paste your session cookie from kimi.moonshot.cn", passthroughModels: true, serviceKinds: ["llm"] },
  "doubao-web": { id: "doubao-web", alias: "db", name: "Doubao Web (ByteDance)", icon: "auto_awesome", color: "#3B82F6", textIcon: "DW", website: "https://www.doubao.com", authType: "cookie", authHint: "Paste your session cookie from doubao.com", passthroughModels: true, serviceKinds: ["llm"] },
  // OmniRoute web free / cookie (Đợt 6)
  "yuanbao-web": { id: "yuanbao-web", alias: "ybw", name: "Tencent Yuanbao (Web)", icon: "auto_awesome", color: "#07C160", textIcon: "YB", website: "https://yuanbao.tencent.com", authType: "cookie", authHint: "Paste session cookie from yuanbao.tencent.com", passthroughModels: true, serviceKinds: ["llm"] },
  "zai-web": { id: "zai-web", alias: "zw", name: "Z.ai Web (Free)", icon: "auto_awesome", color: "#1D4ED8", textIcon: "ZW", website: "https://chat.z.ai", authType: "cookie", authHint: "Paste session cookie from chat.z.ai", passthroughModels: true, serviceKinds: ["llm"] },
  "qwen-web": { id: "qwen-web", alias: "qweb", name: "Qwen Web (Free)", icon: "auto_awesome", color: "#10B981", textIcon: "QW", website: "https://chat.qwen.ai", authType: "cookie", authHint: "Paste session cookie from chat.qwen.ai", passthroughModels: true, serviceKinds: ["llm"] },
  "copilot-m365-web": { id: "copilot-m365-web", alias: "m365copilot", name: "Microsoft 365 Copilot", icon: "auto_awesome", color: "#0078D4", textIcon: "M365", website: "https://m365.cloud.microsoft/chat", authType: "cookie", authHint: "Paste session from m365.cloud.microsoft/chat", passthroughModels: true, serviceKinds: ["llm"] },
  lmarena: { id: "lmarena", alias: "lma", name: "Arena (Free)", icon: "emoji_events", color: "#FF6B6B", textIcon: "AR", website: "https://arena.ai", authType: "cookie", authHint: "Optional session cookie from arena.ai / lmarena.ai", passthroughModels: true, serviceKinds: ["llm"] },
  "zenmux-free": { id: "zenmux-free", alias: "zmf", name: "ZenMux Free (Web)", icon: "hub", color: "#7C3AED", textIcon: "ZF", website: "https://zenmux.ai", authType: "cookie", authHint: "Session cookie free tier from zenmux.ai", passthroughModels: true, serviceKinds: ["llm"] },
  "veoaifree-web": { id: "veoaifree-web", alias: "veo-free", name: "Veo AI Free", icon: "videocam", color: "#8B5CF6", textIcon: "VF", website: "https://veoaifree.com", authType: "none", noAuth: true, passthroughModels: true, serviceKinds: ["video"] },
};

// Media provider kinds — each kind maps to a route and endpoint config
export const MEDIA_PROVIDER_KINDS = [
  { id: "embedding",   label: "Embedding",      icon: "data_array",        endpoint: { method: "POST", path: "/v1/embeddings" } },
  { id: "image",       label: "Text to Image",  icon: "brush",             endpoint: { method: "POST", path: "/v1/images/generations" } },
  { id: "imageToText", label: "Image to Text",  icon: "image_search",      endpoint: { method: "POST", path: "/v1/images/understanding" } },
  { id: "tts",         label: "Text To Speech", icon: "record_voice_over", endpoint: { method: "POST", path: "/v1/audio/speech" } },
  { id: "stt",         label: "Speech To Text", icon: "mic",               endpoint: { method: "POST", path: "/v1/audio/transcriptions" } },
  { id: "webSearch",   label: "Web Search",     icon: "travel_explore",    endpoint: { method: "POST", path: "/v1/search" } },
  { id: "webFetch",    label: "Web Fetch",      icon: "language",          endpoint: { method: "POST", path: "/v1/web/fetch" } },
  { id: "video",       label: "Video",          icon: "movie",             endpoint: { method: "POST", path: "/v1/video/generations" } },
  { id: "music",       label: "Music",          icon: "music_note",        endpoint: { method: "POST", path: "/v1/audio/music" } },
];

export const OPENAI_COMPATIBLE_PREFIX = "openai-compatible-";
export const ANTHROPIC_COMPATIBLE_PREFIX = "anthropic-compatible-";
export const CUSTOM_EMBEDDING_PREFIX = "custom-embedding-";

export function isOpenAICompatibleProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(OPENAI_COMPATIBLE_PREFIX);
}

export function isAnthropicCompatibleProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(ANTHROPIC_COMPATIBLE_PREFIX);
}

export function isCustomEmbeddingProvider(providerId) {
  return typeof providerId === "string" && providerId.startsWith(CUSTOM_EMBEDDING_PREFIX);
}

// All providers (combined)
export const AI_PROVIDERS = { ...FREE_PROVIDERS, ...FREE_TIER_PROVIDERS, ...OAUTH_PROVIDERS, ...APIKEY_PROVIDERS, ...WEB_COOKIE_PROVIDERS };

// Auth methods
export const AUTH_METHODS = {
  oauth: { id: "oauth", name: "OAuth", icon: "lock" },
  apikey: { id: "apikey", name: "API Key", icon: "key" },
  cookie: { id: "cookie", name: "Browser Cookie", icon: "cookie" },
};

// Helper: Get provider by alias
export function getProviderByAlias(alias) {
  for (const provider of Object.values(AI_PROVIDERS)) {
    if (provider.alias === alias || provider.id === alias) {
      return provider;
    }
  }
  return null;
}

// Helper: Get provider ID from alias
export function resolveProviderId(aliasOrId) {
  const provider = getProviderByAlias(aliasOrId);
  return provider?.id || aliasOrId;
}

/**
 * True when the provider can be used without stored credentials
 * (public free endpoints / local servers). Matches 9router noAuth behavior.
 */
export function isNoAuthProvider(providerId) {
  if (!providerId || typeof providerId !== "string") return false;
  const id = resolveProviderId(providerId);
  return !!(AI_PROVIDERS[id]?.noAuth);
}

/**
 * Seed models for public free LLM providers (no signup / no API key upstream).
 * Prefix form: providerAlias/model — usable directly or via FREE combo.
 */
export const FREE_PUBLIC_DEFAULT_MODELS = [
  "pol/openai",
  "pol/openai-fast",
  "oc/deepseek-v4-flash-free",
  "oc/mimo-v2.5-free",
  "oc/hy3-free",
  "oc/nemotron-3-ultra-free",
  "oc/north-mini-code-free",
  "oc/big-pickle",
  "unc/Lorbus/Qwen3.6-27B-int4-AutoRound",
  "tllm/gpt-5.4",
  "mcode/mimo",
];

// Helper: Get alias from provider ID
export function getProviderAlias(providerId) {
  const provider = AI_PROVIDERS[providerId];
  return provider?.alias || providerId;
}

const providerIconPathOverrides = {
  auto: "/providers/auto-route.svg",
  "9router": "/providers/9router.png",
  agentrouter: "/providers/agentrouter.png",
  anthropic: "/providers/anthropic.svg",
  azure: "/providers/azure.svg",
  "azure-ai": "/providers/azure-ai.svg",
  baichuan: "/providers/baichuan.svg",
  bluesminds: "/providers/bluesminds.svg",
  cablyai: "/providers/cablyai.svg",
  "edge-tts": "/providers/edge-tts.svg",
  fenayai: "/providers/fenayai.svg",
  freetheai: "/providers/freetheai.svg",
  freeaiapikey: "/providers/freeaiapikey.png",
  glhf: "/providers/glhf.svg",
  "google-pse": "/providers/google-pse.svg",
  haiper: "/providers/haiper.svg",
  inclusionai: "/providers/inclusionai.svg",
  kilocode: "/providers/kilocode.svg",
  lepton: "/providers/lepton.svg",
  llamagate: "/providers/llamagate.svg",
  monsterapi: "/providers/monsterapi.svg",
  openrouter: "/providers/openrouter.svg",
  phind: "/providers/phind.svg",
  sensenova: "/providers/sensenova.ico",
  thebai: "/providers/thebai.svg",
  vllm: "/providers/vllm.svg",
  "volcengine-ark": "/providers/volcengine-ark.svg",
  "xiaomi-mimo": "/providers/xiaomi-mimo.ico",
};

const providerReadableLocalIconIds = new Set([
  "kilocode",
]);

const curatedProviderIconIds = new Set([
  "ai21",
  "alicode",
  "alicode-intl",
  "anthropic",
  "azure",
  "azure-ai",
  "baseten",
  "cerebras",
  "claude",
  "claude-web",
  "cline",
  "cloudflare-ai",
  "cohere",
  "comfyui",
  "copilot",
  "copilot-web",
  "coze",
  "cursor",
  "deepinfra",
  "deepseek",
  "deepseek-web",
  "dify",
  "doubao",
  "doubao-web",
  "elevenlabs",
  "exa",
  "fal-ai",
  "fireworks",
  "gemini",
  "gemini-cli",
  "gemini-web",
  "github",
  "github-models",
  "glm",
  "glm-cn",
  "grok-web",
  "groq",
  "huggingface",
  "hyperbolic",
  "ideogram",
  "jina-ai",
  "jina-reader",
  "jules",
  "kiro",
  "kluster",
  "lambda-ai",
  "lepton",
  "liquid",
  "mistral",
  "moonshot",
  "morph",
  "nvidia",
  "ollama",
  "ollama-cloud",
  "ollama-local",
  "openai",
  "opencode",
  "opencode-go",
  "opencode-zen",
  "openrouter",
  "perplexity",
  "perplexity-web",
  "phind",
  "poe",
  "poe-web",
  "pollinations",
  "qianfan",
  "qwen",
  "recraft",
  "replicate",
  "runwayml",
  "sambanova",
  "snowflake",
  "stability-ai",
  "stepfun",
  "suno",
  "tavily",
  "tencent",
  "together",
  "topaz",
  "upstage",
  "v0-vercel-web",
  "venice",
  "venice-web",
  "vercel-ai-gateway",
  "vllm",
  "volcengine",
  "volcengine-ark",
  "voyage-ai",
  "xai",
  "xinference",
  "zai",
]);

export function getProviderIconPath(providerId) {
  const resolvedProviderId = resolveProviderId(providerId);
  if (curatedProviderIconIds.has(resolvedProviderId)) {
    return `/providers/${resolvedProviderId}.svg`;
  }
  return providerIconPathOverrides[resolvedProviderId] || `/providers/${resolvedProviderId}.png`;
}

const providerDomainIconMatches = [
  ["openrouter.ai", "openrouter"],
  ["api.groq.com", "groq"],
  ["api.deepseek.com", "deepseek"],
  ["api.anthropic.com", "anthropic"],
  ["api.openai.com", "openai"],
  ["generativelanguage.googleapis.com", "gemini"],
  ["aiplatform.googleapis.com", "vertex"],
  ["open.bigmodel.cn", "glm"],
  ["bigmodel.cn", "glm"],
  ["dashscope.aliyuncs.com", "alicode"],
  ["aliyuncs.com", "alicode"],
  ["moonshot.cn", "kimi"],
  ["moonshot.ai", "moonshot"],
  ["api.minimax.io", "minimax"],
  ["api.minimaxi.com", "minimax-cn"],
  ["ark.cn-beijing.volces.com", "volcengine-ark"],
  ["volces.com", "volcengine-ark"],
  ["volcengine.com", "volcengine"],
  ["models.github.ai", "github-models"],
  ["githubcopilot.com", "github"],
  ["github.com", "github"],
  ["kilo.ai", "kilocode"],
  ["kilocode.ai", "kilocode"],
  ["api.together.xyz", "together"],
  ["together.ai", "together"],
  ["api.mistral.ai", "mistral"],
  ["codestral.mistral.ai", "codestral"],
  ["api.perplexity.ai", "perplexity"],
  ["perplexity.ai", "perplexity"],
  ["api.x.ai", "xai"],
  ["x.ai", "xai"],
  ["api.cloudflare.com", "cloudflare-ai"],
  ["workers.cloudflare.com", "cloudflare-ai"],
  ["ai.cloudflare.com", "cloudflare-ai"],
  ["replicate.com", "replicate"],
  ["api.fireworks.ai", "fireworks"],
  ["fireworks.ai", "fireworks"],
  ["api.cohere.com", "cohere"],
  ["cohere.com", "cohere"],
  ["api.nvidia.com", "nvidia"],
  ["integrate.api.nvidia.com", "nvidia"],
  ["build.nvidia.com", "nvidia"],
  ["api.sambanova.ai", "sambanova"],
  ["sambanova.ai", "sambanova"],
  ["api.upstage.ai", "upstage"],
  ["upstage.ai", "upstage"],
  ["api.deepinfra.com", "deepinfra"],
  ["deepinfra.com", "deepinfra"],
  ["nebius.com", "nebius"],
  ["hyperbolic.xyz", "hyperbolic"],
  ["lambda.ai", "lambda-ai"],
  ["lepton.ai", "lepton"],
  ["novita.ai", "novita"],
  ["siliconflow.cn", "siliconflow"],
  ["siliconflow.com", "siliconflow"],
  ["venice.ai", "venice"],
  ["poe.com", "poe"],
  ["ollama.com", "ollama"],
  ["lmstudio.ai", "lm-studio"],
  ["localhost", "local-device"],
  ["127.0.0.1", "local-device"],
];

function readUrlHost(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    return new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getProviderMatchTokens(provider) {
  return [
    provider.id,
    provider.alias,
    provider.name,
  ]
    .flatMap((value) => String(value || "").toLowerCase().split(/[^a-z0-9]+/))
    .map((value) => normalizeSearchText(value))
    .filter((value) => value.length >= 4 && !["openai", "compatible", "provider", "models", "model"].includes(value));
}

function matchesProviderMetadata(host, provider) {
  const urls = [
    provider.website,
    provider.notice?.apiKeyUrl,
    provider.notice?.signupUrl,
    provider.modelsFetcher?.url,
    provider.searchViaChat?.pricingUrl,
    provider.embeddingConfig?.baseUrl,
    provider.ttsConfig?.baseUrl,
    provider.sttConfig?.baseUrl,
    provider.searchConfig?.baseUrl,
  ];
  return urls.some((url) => {
    const providerHost = readUrlHost(url);
    return providerHost && (
      host === providerHost ||
      host.endsWith(`.${providerHost}`) ||
      providerHost.endsWith(`.${host}`)
    );
  });
}

function matchesProviderHostToken(host, provider) {
  const normalizedHost = normalizeSearchText(host);
  if (!normalizedHost) return false;
  return getProviderMatchTokens(provider).some((token) => normalizedHost.includes(token));
}

export function inferProviderIconId(providerConfig = {}) {
  const host = readUrlHost(providerConfig.baseUrl || providerConfig.url);
  if (host) {
    const matched = providerDomainIconMatches.find(([domain]) => (
      host === domain || host.endsWith(`.${domain}`) || host.includes(domain)
    ));
    if (matched && AI_PROVIDERS[matched[1]]) return matched[1];

    const metadataMatch = Object.values(AI_PROVIDERS).find((provider) => (
      matchesProviderMetadata(host, provider)
    ));
    if (metadataMatch) return metadataMatch.id;

    const tokenMatch = Object.values(AI_PROVIDERS).find((provider) => (
      matchesProviderHostToken(host, provider)
    ));
    if (tokenMatch) return tokenMatch.id;
  }

  const haystack = normalizeSearchText([
    providerConfig.id,
    providerConfig.name,
    providerConfig.prefix,
    providerConfig.provider,
  ].filter(Boolean).join(" "));

  if (!haystack) return "";

  const textMatch = Object.values(AI_PROVIDERS).find((provider) => {
    const id = normalizeSearchText(provider.id);
    const alias = normalizeSearchText(provider.alias);
    const name = normalizeSearchText(provider.name);
    return (id && haystack.includes(id)) ||
      (alias && haystack === alias) ||
      (name && (haystack.includes(name) || name.includes(haystack)));
  });
  return textMatch?.id || "";
}

export function getProviderIconPathFromConfig(providerConfig = {}, fallbackIconPath = "") {
  const inferredId = inferProviderIconId(providerConfig);
  if (inferredId) return getProviderIconPath(inferredId);
  if (fallbackIconPath) return fallbackIconPath;
  return getProviderIconPath(providerConfig.id);
}

function isLocalIconHost(host) {
  return ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host);
}

function getProviderIconDomainUrl(providerConfig = {}) {
  const providerId = resolveProviderId(providerConfig.id || providerConfig.provider || "");
  const provider = AI_PROVIDERS[providerId] || {};
  return providerConfig.baseUrl ||
    providerConfig.website ||
    provider.website ||
    provider.notice?.apiKeyUrl ||
    provider.notice?.signupUrl ||
    provider.modelsFetcher?.url ||
    provider.embeddingConfig?.baseUrl ||
    provider.ttsConfig?.baseUrl ||
    provider.sttConfig?.baseUrl ||
    provider.searchConfig?.baseUrl ||
    "";
}

export function getProviderFaviconUrlFromConfig(providerConfig = {}) {
  const url = getProviderIconDomainUrl(providerConfig);
  const host = readUrlHost(url);
  if (!host || isLocalIconHost(host)) return "";
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`;
}

export function getProviderFaviconUrlsFromConfig(providerConfig = {}) {
  const url = getProviderIconDomainUrl(providerConfig);
  const host = readUrlHost(url);
  if (!host || isLocalIconHost(host)) return [];
  return [
    `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
  ];
}

export function getProviderIconSources(providerOrConfig, fallbackIconPath = "") {
  const providerConfig = typeof providerOrConfig === "string"
    ? { id: providerOrConfig }
    : (providerOrConfig || {});
  const providerId = resolveProviderId(providerConfig.id || providerConfig.provider || "");
  const hasExplicitBaseUrl = typeof (providerConfig.baseUrl || providerConfig.url) === "string" &&
    Boolean((providerConfig.baseUrl || providerConfig.url).trim());
  const knownProviderIconPath = AI_PROVIDERS[providerId] ? getProviderIconPath(providerId) : "";
  const faviconUrls = getProviderFaviconUrlsFromConfig(providerConfig);

  if (!hasExplicitBaseUrl) {
    if (providerReadableLocalIconIds.has(providerId)) {
      return [...new Set([knownProviderIconPath || fallbackIconPath, ...faviconUrls].filter(Boolean))];
    }
    return [...new Set([...faviconUrls, knownProviderIconPath || fallbackIconPath].filter(Boolean))];
  }

  const inferredProviderId = inferProviderIconId(providerConfig);
  const inferredIconPath = inferredProviderId ? getProviderIconPath(inferredProviderId) : "";
  const inferredFaviconUrls = inferredProviderId
    ? getProviderFaviconUrlsFromConfig({ id: inferredProviderId })
    : [];
  if (inferredIconPath) {
    return [...new Set([inferredIconPath, fallbackIconPath, ...inferredFaviconUrls, ...faviconUrls].filter(Boolean))];
  }

  return [...new Set([...faviconUrls, fallbackIconPath, knownProviderIconPath].filter(Boolean))];
}

// Alias to ID mapping (for quick lookup)
export const ALIAS_TO_ID = Object.values(AI_PROVIDERS).reduce((acc, p) => {
  acc[p.alias] = p.id;
  return acc;
}, {});

// ID to Alias mapping
export const ID_TO_ALIAS = Object.values(AI_PROVIDERS).reduce((acc, p) => {
  acc[p.id] = p.alias;
  return acc;
}, {});

// Helper: Get providers by service kind (e.g. "tts", "embedding", "image")
// Providers without serviceKinds default to ["llm"]
export function getProvidersByKind(kind) {
  return Object.values(AI_PROVIDERS)
    .filter((p) => {
      const kinds = p.serviceKinds ?? ["llm"];
      if (!kinds.includes(kind)) return false;
      if (p.hidden) return false;
      if (p.hiddenKinds?.includes(kind)) return false;
      return true;
    })
    .sort((a, b) => (a.mediaPriority ?? 100) - (b.mediaPriority ?? 100));
}

// Providers that support usage/quota API
export const USAGE_SUPPORTED_PROVIDERS = [
  "claude",
  "antigravity",
  "kiro",
  "github",
  "codex",
  "kimi-coding",
  "ollama",
  "gemini-cli",
  "glm",
  "glm-cn",
  "minimax",
  "minimax-cn",
];

// Subset that uses apikey auth (still surfaced on quota page)
export const USAGE_APIKEY_PROVIDERS = [
  "glm",
  "glm-cn",
  "minimax",
  "minimax-cn",
];
