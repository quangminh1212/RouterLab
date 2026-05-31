import { platform, arch } from "os";

// === OS/Arch helpers ===
function mapStainlessOs() {
  switch (platform()) {
    case "darwin": return "MacOS";
    case "win32": return "Windows";
    case "linux": return "Linux";
    case "freebsd": return "FreeBSD";
    default: return `Other::${platform()}`;
  }
}

function mapStainlessArch() {
  switch (arch()) {
    case "x64": return "x64";
    case "arm64": return "arm64";
    case "ia32": return "x86";
    default: return `other::${arch()}`;
  }
}

// Shared Claude-compatible API headers (reused across claude-format providers)
const CLAUDE_API_HEADERS = {
  "Anthropic-Version": "2023-06-01",
  "Anthropic-Beta": "claude-code-20250219,interleaved-thinking-2025-05-14"
};

// Full Claude CLI fingerprint — required by providers that gate on client identity (e.g. agentrouter)
const CLAUDE_CLI_SPOOF_HEADERS = {
  "Anthropic-Version": "2023-06-01",
  "Anthropic-Beta": "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05,advanced-tool-use-2025-11-20,effort-2025-11-24,structured-outputs-2025-12-15,fast-mode-2026-02-01,redact-thinking-2026-02-12,token-efficient-tools-2026-03-28",
  "Anthropic-Dangerous-Direct-Browser-Access": "true",
  "User-Agent": "claude-cli/2.1.92 (external, sdk-cli)",
  "X-App": "cli",
  "X-Stainless-Helper-Method": "stream",
  "X-Stainless-Retry-Count": "0",
  "X-Stainless-Runtime-Version": "v24.14.0",
  "X-Stainless-Package-Version": "0.80.0",
  "X-Stainless-Runtime": "node",
  "X-Stainless-Lang": "js",
  "X-Stainless-Arch": mapStainlessArch(),
  "X-Stainless-Os": mapStainlessOs(),
  "X-Stainless-Timeout": "600"
};

// Shared baseUrls
const KIMI_CODING_BASE_URL = "https://api.kimi.com/coding/v1/messages";

export const PROVIDERS = {
  claude: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_CLI_SPOOF_HEADERS },
    clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
    tokenUrl: "https://api.anthropic.com/v1/oauth/token"
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    format: "gemini",
    clientId: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
    clientSecret: "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"
  },
  "gemini-cli": {
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
    format: "gemini-cli",
    clientId: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
    clientSecret: "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"
  },
  codex: {
    baseUrl: "https://chatgpt.com/backend-api/codex/responses",
    format: "openai-responses",
    headers: {
      "originator": "codex-cli",
      "User-Agent": "codex-cli/1.0.18 (macOS; arm64)"
    },
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    tokenUrl: "https://auth.openai.com/oauth/token"
  },
  qwen: {
    baseUrl: "https://portal.qwen.ai/v1/chat/completions",
    format: "openai",
    clientId: "f0304373b74a44d2b584a3fb70ca9e56",
    tokenUrl: "https://chat.qwen.ai/api/v1/oauth2/token",
    authUrl: "https://chat.qwen.ai/api/v1/oauth2/device/code"
  },
  iflow: {
    baseUrl: "https://apis.iflow.cn/v1/chat/completions",
    format: "openai",
    headers: { "User-Agent": "iFlow-Cli" },
    clientId: "10009311001",
    clientSecret: "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW",
    tokenUrl: "https://iflow.cn/oauth/token",
    authUrl: "https://iflow.cn/oauth"
  },
  qoder: {
    baseUrl: "https://api.qoder.com/v1/chat/completions",
    format: "openai",
    headers: { "User-Agent": "Qoder-Cli" },
    clientId: process.env.QODER_OAUTH_CLIENT_ID || "10009311001",
    clientSecret: process.env.QODER_OAUTH_CLIENT_SECRET || "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW",
    tokenUrl: "https://api.qoder.com/oauth/token",
    authUrl: "https://qoder.com/oauth/authorize"
  },
  antigravity: {
    baseUrls: [
      "https://daily-cloudcode-pa.googleapis.com",
      "https://daily-cloudcode-pa.sandbox.googleapis.com",
    ],
    format: "antigravity",
    headers: { "User-Agent": `antigravity/1.107.0 ${platform()}/${arch()}` },
    clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
    clientSecret: "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"
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    format: "openai",
    headers: {
      "HTTP-Referer": "https://endpoint-proxy.local",
      "X-Title": "Endpoint Proxy"
    }
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    format: "openai"
  },
  "vercel-ai-gateway": {
    baseUrl: "https://ai-gateway.vercel.sh/v1/chat/completions",
    format: "openai"
  },
  glm: {
    baseUrl: "https://api.z.ai/api/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  "glm-cn": {
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions",
    format: "openai",
    headers: {}
  },
  kimi: {
    baseUrl: KIMI_CODING_BASE_URL,
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  minimax: {
    baseUrl: "https://api.minimax.io/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  "minimax-cn": {
    baseUrl: "https://api.minimaxi.com/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  alicode: {
    baseUrl: "https://coding.dashscope.aliyuncs.com/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  "alicode-intl": {
    baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  "volcengine-ark": {
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
    format: "openai",
    headers: {}
  },
  byteplus: {
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding/v3/chat/completions",
    format: "openai",
    headers: {}
  },
  github: {
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
  },
  kiro: {
    baseUrl: "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse",
    format: "kiro",
    retry: { 429: 2 },
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/vnd.amazon.eventstream",
      "X-Amz-Target": "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
      "User-Agent": "AWS-SDK-JS/3.0.0 kiro-ide/1.0.0",
      "X-Amz-User-Agent": "aws-sdk-js/3.0.0 kiro-ide/1.0.0"
    },
    tokenUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken",
    authUrl: "https://prod.us-east-1.auth.desktop.kiro.dev"
  },
  cursor: {
    baseUrl: "https://api2.cursor.sh",
    chatPath: "/aiserver.v1.ChatService/StreamUnifiedChatWithTools",
    format: "cursor",
    headers: {
      "connect-accept-encoding": "gzip",
      "connect-protocol-version": "1",
      "Content-Type": "application/connect+proto",
      "User-Agent": "connect-es/1.6.1"
    },
    clientVersion: "3.1.0"
  },
  "kimi-coding": {
    baseUrl: KIMI_CODING_BASE_URL,
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS },
    clientId: "17e5f671-d194-4dfb-9706-5516cb48c098",
    tokenUrl: "https://auth.kimi.com/api/oauth/token",
    refreshUrl: "https://auth.kimi.com/api/oauth/token"
  },
  kilocode: {
    baseUrl: "https://api.kilo.ai/api/openrouter/chat/completions",
    format: "openai",
    headers: {}
  },
  opencode: {
    baseUrl: "http://localhost:4096/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  cline: {
    baseUrl: "https://api.cline.bot/api/v1/chat/completions",
    format: "openai",
    headers: {
      "HTTP-Referer": "https://cline.bot",
      "X-Title": "Cline"
    },
    tokenUrl: "https://api.cline.bot/api/v1/auth/token",
    refreshUrl: "https://api.cline.bot/api/v1/auth/refresh"
  },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    format: "openai"
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/chat/completions",
    format: "openai"
  },
  commandcode: {
    baseUrl: "https://api.commandcode.ai/alpha/generate",
    format: "commandcode",
    headers: {
      "x-command-code-version": "0.25.7",
      "x-cli-environment": "cli"
    }
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    format: "openai"
  },
  xai: {
    baseUrl: "https://api.x.ai/v1/chat/completions",
    format: "openai"
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    format: "openai"
  },
  perplexity: {
    baseUrl: "https://api.perplexity.ai/chat/completions",
    format: "openai"
  },
  together: {
    baseUrl: "https://api.together.xyz/v1/chat/completions",
    format: "openai"
  },
  fireworks: {
    baseUrl: "https://api.fireworks.ai/inference/v1/chat/completions",
    format: "openai"
  },
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    format: "openai"
  },
  cohere: {
    baseUrl: "https://api.cohere.ai/v1/chat/completions",
    format: "openai"
  },
  nebius: {
    baseUrl: "https://api.studio.nebius.ai/v1/chat/completions",
    format: "openai"
  },
  siliconflow: {
    baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
    format: "openai"
  },
  hyperbolic: {
    baseUrl: "https://api.hyperbolic.xyz/v1/chat/completions",
    format: "openai"
  },
  deepgram: {
    baseUrl: "https://api.deepgram.com/v1/listen",
    format: "openai"
  },
  assemblyai: {
    baseUrl: "https://api.assemblyai.com/v1/audio/transcriptions",
    format: "openai"
  },
  nanobanana: {
    baseUrl: "https://api.nanobananaapi.ai/v1/chat/completions",
    format: "openai"
  },
  chutes: {
    baseUrl: "https://llm.chutes.ai/v1/chat/completions",
    format: "openai"
  },
  ollama: {
    baseUrl: "https://ollama.com/api/chat",
    format: "ollama"
  },
  "ollama-local": {
    baseUrl: "http://localhost:11434/api/chat",
    format: "ollama"
  },
  // Vertex AI - Gemini models via Service Account JSON
  // baseUrl is not used; VertexExecutor.buildUrl() constructs it dynamically
  vertex: {
    baseUrl: "https://aiplatform.googleapis.com",
    format: "vertex"
  },
  // Vertex AI - Partner models (Claude, Llama, Mistral, GLM) via SA JSON
  // Uses OpenAI-compatible global endpoint (or rawPredict for Anthropic)
  "vertex-partner": {
    baseUrl: "https://aiplatform.googleapis.com",
    format: "openai"
  },
  // GitLab Duo - OpenAI-compatible chat endpoint
  gitlab: {
    baseUrl: "https://gitlab.com/api/v4/chat/completions",
    format: "openai",
  },
  // CodeBuddy (Tencent) - uses device_code polling auth, no chat completions baseUrl needed
  codebuddy: {
    baseUrl: "https://copilot.tencent.com/v1/chat/completions",
    format: "openai",
  },
  opencode: {
    baseUrl: "https://opencode.ai",
    format: "openai",
    headers: { "x-opencode-client": "desktop" },
    noAuth: true
  },
  "opencode-go": {
    baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  "grok-web": {
    baseUrl: "https://grok.com/rest/app-chat/conversations/new",
    format: "grok-web",
    authType: "cookie"
  },
  "perplexity-web": {
    baseUrl: "https://www.perplexity.ai/rest/sse/perplexity_ask",
    format: "perplexity-web",
    authType: "cookie"
  },
  azure: {
    baseUrl: "",
    format: "openai",
    headers: {}
  },
  // Cloudflare Workers AI - {accountId} resolved from credentials.providerSpecificData.accountId
  "cloudflare-ai": {
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1/chat/completions",
    format: "openai"
  },
  "xiaomi-mimo": {
    baseUrl: "https://api.xiaomimimo.com/v1/chat/completions",
    format: "openai"
  },
  "xiaomi-tokenplan": {
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions",
    format: "openai"
  },
  // === Free-tier providers (synced from OmniRoute) ===
  // Claude-format with Claude CLI header spoofing (auth: x-api-key)
  agentrouter: { baseUrl: "https://agentrouter.org/v1/messages", format: "claude", headers: { ...CLAUDE_CLI_SPOOF_HEADERS } },
  // OpenAI-compatible (auth: bearer)
  aimlapi: { baseUrl: "https://api.aimlapi.com/v1/chat/completions", format: "openai" },
  novita: { baseUrl: "https://api.novita.ai/v3/openai/chat/completions", format: "openai" },
  modal: { baseUrl: "https://api.modal.com/v1/chat/completions", format: "openai" },
  reka: { baseUrl: "https://api.reka.ai/v1/chat/completions", format: "openai" },
  nlpcloud: { baseUrl: "https://api.nlpcloud.io/v1/gpu/chatbot", format: "openai" },
  bazaarlink: { baseUrl: "https://bazaarlink.ai/api/v1/chat/completions", format: "openai" },
  completions: { baseUrl: "https://completions.me/api/v1/chat/completions", format: "openai" },
  // enally uses X-API-Key header (not bearer); handled in validate route
  enally: { baseUrl: "https://ai.enally.in/v1/chat/completions", format: "openai", authHeader: "x-api-key" },
  freetheai: { baseUrl: "https://api.freetheai.xyz/v1/chat/completions", format: "openai" },
  llm7: { baseUrl: "https://api.llm7.io/v1/chat/completions", format: "openai" },
  lepton: { baseUrl: "https://api.lepton.ai/api/v1/chat/completions", format: "openai" },
  kluster: { baseUrl: "https://api.kluster.ai/v1/chat/completions", format: "openai" },
  ai21: { baseUrl: "https://api.ai21.com/studio/v1/chat/completions", format: "openai" },
  "inference-net": { baseUrl: "https://api.inference.net/v1/chat/completions", format: "openai" },
  predibase: { baseUrl: "https://serving.app.predibase.com/v1/chat/completions", format: "openai" },
  bytez: { baseUrl: "https://api.bytez.com/models/v2", format: "openai" },
  morph: { baseUrl: "https://api.morphllm.com/v1/chat/completions", format: "openai" },
  longcat: { baseUrl: "https://api.longcat.chat/openai/v1/chat/completions", format: "openai" },
  puter: { baseUrl: "https://api.puter.com/puterai/openai/v1/chat/completions", format: "openai" },
  uncloseai: { baseUrl: "https://hermes.ai.unturf.com/v1/chat/completions", format: "openai", noAuth: true },
  scaleway: { baseUrl: "https://api.scaleway.ai/v1/chat/completions", format: "openai" },
  deepinfra: { baseUrl: "https://api.deepinfra.com/v1/openai/chat/completions", format: "openai" },
  sambanova: { baseUrl: "https://api.sambanova.ai/v1/chat/completions", format: "openai" },
  nscale: { baseUrl: "https://inference.api.nscale.com/v1/chat/completions", format: "openai" },
  baseten: { baseUrl: "https://inference.baseten.co/v1/chat/completions", format: "openai" },
  publicai: { baseUrl: "https://api.publicai.co/v1/chat/completions", format: "openai" },
  "nous-research": { baseUrl: "https://inference-api.nousresearch.com/v1/chat/completions", format: "openai" },
  glhf: { baseUrl: "https://glhf.chat/api/openai/v1/chat/completions", format: "openai" },
  blackbox: { baseUrl: "https://api.blackbox.ai/chat/completions", format: "openai" },
  cungcapai: {
    baseUrl: "https://api.cungcapai.io.vn/v1/chat/completions",
    format: "openai",
    headers: {}
  },

  // === Batch 2 (synced from OmniRoute): OpenAI-compatible API-key providers ===
  "api-airforce": { baseUrl: "https://api.airforce/v1/chat/completions", format: "openai" },
  astraflow: { baseUrl: "https://astraflow.ucloud-global.com/v1/chat/completions", format: "openai" },
  "astraflow-cn": { baseUrl: "https://astraflow.ucloud.cn/v1/chat/completions", format: "openai" },
  qianfan: { baseUrl: "https://qianfan.baidubce.com/v2/chat/completions", format: "openai" },
  crof: { baseUrl: "https://ai.nahcrof.com/v2/chat/completions", format: "openai" },
  zai: { baseUrl: "https://api.z.ai/api/paas/v4/chat/completions", format: "openai" },
  "github-models": { baseUrl: "https://models.github.ai/inference/chat/completions", format: "openai" },
  "ollama-cloud": { baseUrl: "https://ollama.com/v1/chat/completions", format: "openai" },
  synthetic: { baseUrl: "https://api.synthetic.new/v1/chat/completions", format: "openai" },
  "kilo-gateway": { baseUrl: "https://api.kilo.ai/v1/chat/completions", format: "openai" },
  "opencode-zen": { baseUrl: "https://opencode.ai/zen/v1/chat/completions", format: "openai" },
  "meta-llama": { baseUrl: "https://api.llama.com/compat/v1/chat/completions", format: "openai" },
  moonshot: { baseUrl: "https://api.moonshot.ai/v1/chat/completions", format: "openai" },
  ovhcloud: { baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions", format: "openai" },
  "lambda-ai": { baseUrl: "https://api.lambda.ai/v1/chat/completions", format: "openai" },
  "featherless-ai": { baseUrl: "https://api.featherless.ai/v1/chat/completions", format: "openai" },
  friendliai: { baseUrl: "https://api.friendli.ai/serverless/v1/chat/completions", format: "openai" },
  llamagate: { baseUrl: "https://api.llamagate.ai/v1/chat/completions", format: "openai" },
  gigachat: { baseUrl: "https://gigachat.devices.sberbank.ru/api/v1/chat/completions", format: "openai" },
  venice: { baseUrl: "https://api.venice.ai/api/v1/chat/completions", format: "openai" },
  codestral: { baseUrl: "https://codestral.mistral.ai/v1/chat/completions", format: "openai" },
  upstage: { baseUrl: "https://api.upstage.ai/v1/chat/completions", format: "openai" },
  maritalk: { baseUrl: "https://chat.maritaca.ai/api/chat/completions", format: "openai" },
  nanogpt: { baseUrl: "https://nano-gpt.com/api/v1/chat/completions", format: "openai" },
  piapi: { baseUrl: "https://api.piapi.ai/v1/chat/completions", format: "openai" },
  getgoapi: { baseUrl: "https://api.getgoapi.com/v1/chat/completions", format: "openai" },
  laozhang: { baseUrl: "https://api.laozhang.ai/v1/chat/completions", format: "openai" },
  cablyai: { baseUrl: "https://cablyai.com/v1/chat/completions", format: "openai" },
  thebai: { baseUrl: "https://api.theb.ai/v1/chat/completions", format: "openai" },
  fenayai: { baseUrl: "https://fenayai.com/v1/chat/completions", format: "openai" },
  empower: { baseUrl: "https://app.empower.dev/api/v1/chat/completions", format: "openai" },
  poe: { baseUrl: "https://api.poe.com/v1/chat/completions", format: "openai" },
  galadriel: { baseUrl: "https://api.galadriel.com/v1/chat/completions", format: "openai" },
  wandb: { baseUrl: "https://api.inference.wandb.ai/v1/chat/completions", format: "openai" },
  volcengine: { baseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions", format: "openai" },
  gitlawb: { baseUrl: "https://opengateway.gitlawb.com/v1/chat/completions", format: "openai" },
  "gitlawb-gmi": { baseUrl: "https://opengateway.gitlawb.com/gmi/v1/chat/completions", format: "openai" },
  bluesminds: { baseUrl: "https://api.bluesminds.com/v1/chat/completions", format: "openai" },
  "freemodel-dev": { baseUrl: "https://freemodel.dev/v1/chat/completions", format: "openai" },
  freeaiapikey: { baseUrl: "https://freeaiapikey.com/v1/chat/completions", format: "openai" },
  kie: { baseUrl: "https://api.kie.ai/v1/chat/completions", format: "openai" },
  hackclub: { baseUrl: "https://ai.hackclub.com/chat/completions", format: "openai", noAuth: true },
  pollinations: { baseUrl: "https://text.pollinations.ai/openai/chat/completions", format: "openai", noAuth: true },
  replicate: { baseUrl: "https://api.replicate.com/v1/chat/completions", format: "openai" },
  poolside: { baseUrl: "https://api.poolside.ai/v1/chat/completions", format: "openai" },
  "arcee-ai": { baseUrl: "https://conductor.arcee.ai/v1/chat/completions", format: "openai" },
  inclusionai: { baseUrl: "https://api.inclusionai.com/v1/chat/completions", format: "openai" },
  liquid: { baseUrl: "https://api.liquid.ai/v1/chat/completions", format: "openai" },
  nomic: { baseUrl: "https://api-atlas.nomic.ai/v1/chat/completions", format: "openai" },
  krutrim: { baseUrl: "https://cloud.olakrutrim.com/v1/chat/completions", format: "openai" },
  monsterapi: { baseUrl: "https://api.monsterapi.ai/v1/chat/completions", format: "openai" },
  dify: { baseUrl: "https://api.dify.ai/v1/chat-messages", format: "openai" },

  // === Chinese LLM providers ===
  baidu: { baseUrl: "https://qianfan.baidubce.com/v2/chat/completions", format: "openai" },
  tencent: { baseUrl: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions", format: "openai" },
  iflytek: { baseUrl: "https://spark-api-open.xf-yun.com/v1/chat/completions", format: "openai" },
  baichuan: { baseUrl: "https://api.baichuan-ai.com/v1/chat/completions", format: "openai" },
  yi: { baseUrl: "https://api.lingyiwanwu.com/v1/chat/completions", format: "openai" },
  stepfun: { baseUrl: "https://api.stepfun.com/v1/chat/completions", format: "openai" },
  "360ai": { baseUrl: "https://api.360.cn/v1/chat/completions", format: "openai" },
  sensenova: { baseUrl: "https://api.sensenova.cn/compatible-mode/v1/chat/completions", format: "openai" },
  doubao: { baseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions", format: "openai" },
  coze: { baseUrl: "https://api.coze.com/v1/chat/completions", format: "openai" },

  // === Enterprise cloud (OpenAI-compatible surface; some need providerSpecificData) ===
  "azure-ai": { baseUrl: "", format: "openai", headers: {} },
  watsonx: { baseUrl: "", format: "openai", headers: {} },
  oci: { baseUrl: "", format: "openai", headers: {} },
  sap: { baseUrl: "", format: "openai", headers: {} },
  databricks: { baseUrl: "", format: "openai", headers: {} },
  datarobot: { baseUrl: "", format: "openai", headers: {} },
  clarifai: { baseUrl: "https://api.clarifai.com/v2/ext/openai/v1/chat/completions", format: "openai" },
  snowflake: { baseUrl: "", format: "openai", headers: {} },
  heroku: { baseUrl: "", format: "openai", headers: {} },

  // === Local / Self-hosted (OpenAI-compatible localhost; baseUrl overridable via providerSpecificData) ===
  "lm-studio": { baseUrl: "http://localhost:1234/v1/chat/completions", format: "openai", noAuth: true },
  vllm: { baseUrl: "http://localhost:8000/v1/chat/completions", format: "openai", noAuth: true },
  lemonade: { baseUrl: "http://localhost:13305/api/v1/chat/completions", format: "openai", noAuth: true },
  llamafile: { baseUrl: "http://127.0.0.1:8080/v1/chat/completions", format: "openai", noAuth: true },
  "llama-cpp": { baseUrl: "http://127.0.0.1:8080/v1/chat/completions", format: "openai", noAuth: true },
  triton: { baseUrl: "http://localhost:8000/v1/chat/completions", format: "openai", noAuth: true },
  "docker-model-runner": { baseUrl: "http://localhost:12434/v1/chat/completions", format: "openai", noAuth: true },
  xinference: { baseUrl: "http://localhost:9997/v1/chat/completions", format: "openai", noAuth: true },
  oobabooga: { baseUrl: "http://localhost:5000/v1/chat/completions", format: "openai", noAuth: true },
};

export const OLLAMA_LOCAL_DEFAULT_HOST = "http://localhost:11434";

export function resolveOllamaLocalHost(credentials) {
  const raw = credentials?.providerSpecificData?.baseUrl?.trim();
  return (raw || OLLAMA_LOCAL_DEFAULT_HOST).replace(/\/$/, "");
}
