import { AntigravityExecutor } from "./antigravity.js";
import { AzureExecutor } from "./azure.js";
import { AzureOpenAIExecutor } from "./azure-openai.js";
import { GeminiCLIExecutor } from "./gemini-cli.js";
import { GithubExecutor } from "./github.js";
import { IFlowExecutor } from "./iflow.js";
import { QoderExecutor } from "./qoder.js";
import { KiroExecutor } from "./kiro.js";
import { CodexExecutor } from "./codex.js";
import { CursorExecutor } from "./cursor.js";
import { VertexExecutor } from "./vertex.js";
import { QwenExecutor } from "./qwen.js";
import { OpenCodeExecutor } from "./opencode.js";
import { OpenCodeGoExecutor } from "./opencode-go.js";
import { GrokWebExecutor } from "./grok-web.js";
import { PerplexityWebExecutor } from "./perplexity-web.js";
import { BedrockExecutor } from "./bedrock.js";
import { AmazonQExecutor } from "./amazon-q.js";
import { DuckDuckGoWebExecutor } from "./webChat/duckduckgo.js";
import { GenericWebExecutor } from "./webChat/genericWeb.js";
import { WEB_CHAT_PROVIDER_IDS } from "./webChat/registry.js";
import { DefaultExecutor } from "./default.js";
import { DevinCLIExecutor } from "./devin-cli.js";
import { PuterExecutor } from "./puter.js";
import { CloudflareAIExecutor } from "./cloudflare-ai.js";
import { PollinationsExecutor } from "./pollinations.js";
import { CodeBuddyCnExecutor } from "./codebuddy-cn.js";
import { XaiExecutor } from "./xai.js";
import { CliproxyapiExecutor } from "./cliproxyapi.js";
import { NineRouterExecutor } from "./ninerouter.js";
import { XiaomiTokenplanExecutor } from "./xiaomi-tokenplan.js";
import { MimoFreeExecutor } from "./mimo-free.js";
import { TheOldLlmExecutor } from "./theoldllm.js";
import { ZenmuxFreeExecutor } from "./zenmux-free.js";
import { KieExecutor } from "./kie.js";
import { GlmExecutor } from "./glm.js";
import { CommandCodeExecutor } from "./commandcode.js";
import { GitlabExecutor } from "./gitlab.js";
import { WindsurfExecutor } from "./windsurf.js";
import { TraeExecutor } from "./trae.js";
import { ZedHostedExecutor } from "./zed-hosted.js";
import { AuggieExecutor } from "./auggie.js";
import { GheCopilotExecutor } from "./ghe-copilot.js";
import { GrokCliExecutor } from "./grok-cli.js";
import { SpecialProtocolExecutor } from "./specialProtocol.js";
import { KimchiExecutor } from "./kimchi.js";
import { OllamaLocalExecutor } from "./ollama-local.js";
import { MoonshotExecutor } from "./moonshot.js";
import { NlpCloudExecutor } from "./nlpcloud.js";

const puter = new PuterExecutor();
const cloudflareAi = new CloudflareAIExecutor();
const pollinations = new PollinationsExecutor();
const codebuddyCn = new CodeBuddyCnExecutor();
const xai = new XaiExecutor("xai");
const xaiOauth = new XaiExecutor("xai-oauth");
const cliproxyapi = new CliproxyapiExecutor();
const ninerouter = new NineRouterExecutor();
const xiaomiTokenplan = new XiaomiTokenplanExecutor();
const mimocode = new MimoFreeExecutor("mimocode");
const mimoFree = new MimoFreeExecutor("mimo-free");
const theoldllm = new TheOldLlmExecutor();
const zenmuxFree = new ZenmuxFreeExecutor();
const kie = new KieExecutor();
const glm = new GlmExecutor("glm");
const glmCn = new GlmExecutor("glm-cn");
const glmt = new GlmExecutor("glmt");
const commandcode = new CommandCodeExecutor("commandcode");
const gitlab = new GitlabExecutor("gitlab");
const gitlabDuo = new GitlabExecutor("gitlab-duo");
const windsurf = new WindsurfExecutor("windsurf");
const trae = new TraeExecutor();
const zedHosted = new ZedHostedExecutor();
const auggie = new AuggieExecutor();
const azureLegacy = new AzureExecutor();
const azureOpenaiAlias = new AzureOpenAIExecutor("azure-openai");
const devinCli = new DevinCLIExecutor();

const executors = {
  antigravity: new AntigravityExecutor(),
  agy: new AntigravityExecutor(),
  azure: azureLegacy,
  "azure-openai": azureOpenaiAlias,
  "gemini-cli": new GeminiCLIExecutor(),
  github: new GithubExecutor(),
  iflow: new IFlowExecutor(),
  qoder: new QoderExecutor(),
  kiro: new KiroExecutor(),
  codex: new CodexExecutor(),
  cursor: new CursorExecutor(),
  cu: new CursorExecutor(),
  vertex: new VertexExecutor("vertex"),
  "vertex-partner": new VertexExecutor("vertex-partner"),
  qwen: new QwenExecutor(),
  opencode: new OpenCodeExecutor(),
  "opencode-go": new OpenCodeGoExecutor(),
  "opencode-zen": new OpenCodeExecutor(),
  "grok-web": new GrokWebExecutor(),
  "perplexity-web": new PerplexityWebExecutor(),
  bedrock: new BedrockExecutor(),
  "amazon-q": new AmazonQExecutor(),
  "duckduckgo-web": new DuckDuckGoWebExecutor(),
  "devin-cli": devinCli,
  dvcli: devinCli,
  devin: devinCli,

  // OmniRoute / 9router specialized executors (Đợt 10)
  puter,
  pu: puter,
  "cloudflare-ai": cloudflareAi,
  cf: cloudflareAi,
  pollinations,
  pol: pollinations,
  "codebuddy-cn": codebuddyCn,
  cbcn: codebuddyCn,
  xai,
  "xai-oauth": xaiOauth,
  xao: xaiOauth,
  cliproxyapi,
  cpa: cliproxyapi,
  "9router": ninerouter,
  nr: ninerouter,
  "xiaomi-tokenplan": xiaomiTokenplan,
  mimocode,
  mcode: mimocode,
  "mimo-free": mimoFree,
  theoldllm,
  tllm: theoldllm,
  "zenmux-free": zenmuxFree,
  zmf: zenmuxFree,
  kie,
  glm,
  "glm-cn": glmCn,
  glmt,
  commandcode,
  "command-code": commandcode,
  cmd: commandcode,
  gitlab,
  "gitlab-duo": gitlabDuo,
  windsurf,
  ws: windsurf,
  trae,
  "zed-hosted": zedHosted,
  auggie,
  "ghe-copilot": new GheCopilotExecutor(),
  "grok-cli": new GrokCliExecutor(),
  gcli: new GrokCliExecutor(),
  // Non-OpenAI protocols: clear 501 instead of broken DefaultExecutor fetch
  chipotle: new SpecialProtocolExecutor(
    "chipotle",
    "Chipotle AI uses Amelia WebSocket/STOMP (not OpenAI chat). Full OmniRoute chipotle executor not ported yet."
  ),
  pepper: new SpecialProtocolExecutor(
    "chipotle",
    "Chipotle AI uses Amelia WebSocket/STOMP (not OpenAI chat). Full OmniRoute chipotle executor not ported yet."
  ),
  hyperagent: new SpecialProtocolExecutor(
    "hyperagent",
    "HyperAgent uses a proprietary threads API. Specialized OmniRoute executor not fully ported yet."
  ),
  ha: new SpecialProtocolExecutor(
    "hyperagent",
    "HyperAgent uses a proprietary threads API. Specialized OmniRoute executor not fully ported yet."
  ),
  promptql: new SpecialProtocolExecutor(
    "promptql",
    "PromptQL uses GraphQL playground protocol, not OpenAI chat/completions."
  ),
  pql: new SpecialProtocolExecutor(
    "promptql",
    "PromptQL uses GraphQL playground protocol, not OpenAI chat/completions."
  ),
  "adobe-firefly": new SpecialProtocolExecutor(
    "adobe-firefly",
    "Adobe Firefly is an image generation API (not chat). Use image generation endpoints when available."
  ),
  firefly: new SpecialProtocolExecutor(
    "adobe-firefly",
    "Adobe Firefly is an image generation API (not chat). Use image generation endpoints when available."
  ),

  // 9router + Omni specialized (Đợt 11)
  kimchi: new KimchiExecutor(),
  "ollama-local": new OllamaLocalExecutor(),
  moonshot: new MoonshotExecutor("moonshot"),
  kimi: new MoonshotExecutor("kimi"),
  nlpcloud: new NlpCloudExecutor(),
  nlpc: new NlpCloudExecutor(),
};

// Register config-driven web-cookie chat providers (GenericWebExecutor).
for (const id of WEB_CHAT_PROVIDER_IDS) {
  if (!executors[id]) executors[id] = new GenericWebExecutor(id);
}

const defaultCache = new Map();

export function getExecutor(provider) {
  if (executors[provider]) return executors[provider];
  if (!defaultCache.has(provider)) defaultCache.set(provider, new DefaultExecutor(provider));
  return defaultCache.get(provider);
}

export function hasSpecializedExecutor(provider) {
  return !!executors[provider];
}

export function listSpecializedExecutors() {
  return Object.keys(executors).sort();
}

export { BaseExecutor } from "./base.js";
export { AntigravityExecutor } from "./antigravity.js";
export { AzureExecutor } from "./azure.js";
export { AzureOpenAIExecutor } from "./azure-openai.js";
export { GeminiCLIExecutor } from "./gemini-cli.js";
export { GithubExecutor } from "./github.js";
export { IFlowExecutor } from "./iflow.js";
export { QoderExecutor } from "./qoder.js";
export { KiroExecutor } from "./kiro.js";
export { CodexExecutor } from "./codex.js";
export { CursorExecutor } from "./cursor.js";
export { VertexExecutor } from "./vertex.js";
export { DefaultExecutor } from "./default.js";
export { QwenExecutor } from "./qwen.js";
export { OpenCodeExecutor } from "./opencode.js";
export { OpenCodeGoExecutor } from "./opencode-go.js";
export { GrokWebExecutor } from "./grok-web.js";
export { PerplexityWebExecutor } from "./perplexity-web.js";
export { BedrockExecutor } from "./bedrock.js";
export { AmazonQExecutor } from "./amazon-q.js";
export { DuckDuckGoWebExecutor } from "./webChat/duckduckgo.js";
export { GenericWebExecutor } from "./webChat/genericWeb.js";
export { DevinCLIExecutor } from "./devin-cli.js";
export { PuterExecutor } from "./puter.js";
export { CloudflareAIExecutor } from "./cloudflare-ai.js";
export { PollinationsExecutor } from "./pollinations.js";
export { CodeBuddyCnExecutor } from "./codebuddy-cn.js";
export { XaiExecutor } from "./xai.js";
export { CliproxyapiExecutor } from "./cliproxyapi.js";
export { NineRouterExecutor } from "./ninerouter.js";
export { XiaomiTokenplanExecutor } from "./xiaomi-tokenplan.js";
export { MimoFreeExecutor } from "./mimo-free.js";
export { TheOldLlmExecutor } from "./theoldllm.js";
export { ZenmuxFreeExecutor } from "./zenmux-free.js";
export { KieExecutor } from "./kie.js";
export { GlmExecutor } from "./glm.js";
export { CommandCodeExecutor } from "./commandcode.js";
export { GitlabExecutor } from "./gitlab.js";
export { WindsurfExecutor } from "./windsurf.js";
export { TraeExecutor } from "./trae.js";
export { ZedHostedExecutor } from "./zed-hosted.js";
export { AuggieExecutor } from "./auggie.js";
export { GheCopilotExecutor } from "./ghe-copilot.js";
export { GrokCliExecutor } from "./grok-cli.js";
export { SpecialProtocolExecutor } from "./specialProtocol.js";
export { KimchiExecutor } from "./kimchi.js";
export { OllamaLocalExecutor } from "./ollama-local.js";
export { MoonshotExecutor } from "./moonshot.js";
export { NlpCloudExecutor } from "./nlpcloud.js";
