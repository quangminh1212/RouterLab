import { AI_PROVIDERS } from "./catalog.js";

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
  // Auto-generated for 100% OmniRoute/9router/CLIProxyAPI icon parity.
  // Prefer SVG when present (Omni), else PNG (9router), then ico/jpg.
  "360ai": "/providers/360ai.svg",
  "9router": "/providers/9router.png",
  "adapta-web": "/providers/adapta-web.png",
  agentrouter: "/providers/agentrouter.svg",
  agnes: "/providers/agnes.svg",
  agy: "/providers/antigravity.svg",
  ai21: "/providers/ai21.svg",
  aihorde: "/providers/aihorde.svg",
  aimlapi: "/providers/aimlapi.png",
  ainative: "/providers/ainative.svg",
  aion: "/providers/aion.svg",
  alibaba: "/providers/alibaba.svg",
  "alibaba-cn": "/providers/alibaba.svg",
  alicode: "/providers/alicode.svg",
  "alicode-intl": "/providers/alicode-intl.svg",
  "amazon-q": "/providers/amazon-q.png",
  amp: "/providers/amp.png",
  "ant-ling": "/providers/ant-ling.svg",
  anthropic: "/providers/anthropic.svg",
  "anthropic-m": "/providers/anthropic-m.png",
  antigravity: "/providers/antigravity.svg",
  "api-airforce": "/providers/api-airforce.svg",
  apikey: "/providers/apikey.svg",
  arcee: "/providers/arcee.svg",
  "arcee-ai": "/providers/arcee-ai.svg",
  "arena-dark": "/providers/arena-dark.svg",
  "arena-light": "/providers/arena-light.svg",
  assemblyai: "/providers/assemblyai.svg",
  astraflow: "/providers/astraflow.png",
  "astraflow-cn": "/providers/astraflow-cn.png",
  auggie: "/providers/auggie.svg",
  auto: "/providers/auto-route.svg",
  "auto-route": "/providers/auto-route.svg",
  aws: "/providers/aws.svg",
  "aws-polly": "/providers/aws-polly.svg",
  azure: "/providers/azure.svg",
  "azure-ai": "/providers/azure-ai.svg",
  azureai: "/providers/azureai.svg",
  bai: "/providers/thebai.svg",
  baichuan: "/providers/baichuan.svg",
  baidu: "/providers/baidu.svg",
  bailian: "/providers/bailian.svg",
  "bailian-coding-plan": "/providers/bailian.svg",
  baseten: "/providers/baseten.svg",
  bazaarlink: "/providers/bazaarlink.svg",
  bedrock: "/providers/bedrock.png",
  "black-forest-labs": "/providers/black-forest-labs.png",
  blackbox: "/providers/blackbox.png",
  "blackbox-web": "/providers/blackbox-web.png",
  bluesminds: "/providers/bluesminds.svg",
  brave: "/providers/brave.svg",
  "brave-search": "/providers/brave-search.svg",
  byteplus: "/providers/byteplus.svg",
  bytez: "/providers/bytez.svg",
  cablyai: "/providers/cablyai.svg",
  cartesia: "/providers/cartesia.svg",
  cerebras: "/providers/cerebras.svg",
  "charm-hyper": "/providers/charm-hyper.svg",
  "chatgpt-web": "/providers/chatgpt-web.png",
  chenzk: "/providers/chenzk.svg",
  chipotle: "/providers/chipotle.svg",
  chutes: "/providers/chutes.svg",
  clarifai: "/providers/clarifai.svg",
  claude: "/providers/claude.svg",
  "claude-web": "/providers/claude-web.svg",
  "cli-generic": "/providers/cli-generic.svg",
  cline: "/providers/cline.svg",
  clinepass: "/providers/clinepass.png",
  cliproxyapi: "/providers/cliproxyapi.svg",
  cloudflare: "/providers/cloudflare.svg",
  "cloudflare-ai": "/providers/cloudflare-ai.svg",
  "clova-studio": "/providers/clova-studio.svg",
  codebuddy: "/providers/codebuddy.svg",
  "codebuddy-cn": "/providers/codebuddy-cn.svg",
  codestral: "/providers/codestral.svg",
  codex: "/providers/codex.svg",
  "codex-cloud": "/providers/codex-cloud.png",
  cohere: "/providers/cohere.svg",
  comfyui: "/providers/comfyui.svg",
  "command-code": "/providers/command-code.svg",
  commandcode: "/providers/command-code.svg",
  completions: "/providers/completions.png",
  continue: "/providers/continue.svg",
  copilot: "/providers/copilot.svg",
  "copilot-m365-web": "/providers/copilot-web.svg",
  "copilot-web": "/providers/copilot-web.svg",
  coqui: "/providers/coqui.svg",
  coze: "/providers/coze.svg",
  crof: "/providers/crof.svg",
  cungcapai: "/providers/cungcapai.svg",
  cursor: "/providers/cursor.svg",
  dahl: "/providers/dahl.svg",
  databricks: "/providers/databricks.png",
  datarobot: "/providers/datarobot.png",
  deepgram: "/providers/deepgram.svg",
  deepinfra: "/providers/deepinfra.svg",
  deepseek: "/providers/deepseek.svg",
  "deepseek-tui": "/providers/deepseek-tui.png",
  "deepseek-web": "/providers/deepseek-web.svg",
  devin: "/providers/devin.png",
  "devin-cli": "/providers/devin.png",
  dgrid: "/providers/dgrid.svg",
  dify: "/providers/dify.svg",
  digitalocean: "/providers/digitalocean.svg",
  dit: "/providers/dit.svg",
  "docker-model-runner": "/providers/docker-model-runner.svg",
  doubao: "/providers/doubao.svg",
  "doubao-web": "/providers/doubao-web.svg",
  droid: "/providers/droid.svg",
  "duckduckgo-web": "/providers/duckduckgo-web.svg",
  "edge-tts": "/providers/edge-tts.svg",
  electroai: "/providers/electroai.svg",
  elevenlabs: "/providers/elevenlabs.svg",
  empower: "/providers/empower.png",
  enally: "/providers/enally.png",
  exa: "/providers/exa.svg",
  factory: "/providers/factory.svg",
  fal: "/providers/fal.svg",
  "fal-ai": "/providers/fal-ai.svg",
  featherless: "/providers/featherless.png",
  "featherless-ai": "/providers/featherless-ai.png",
  "felo-web": "/providers/felo-web.svg",
  fenayai: "/providers/fenayai.svg",
  firecrawl: "/providers/firecrawl.png",
  fireworks: "/providers/fireworks.svg",
  freeaiapikey: "/providers/freeaiapikey.svg",
  "freemodel-dev": "/providers/freemodel-dev.svg",
  freepik: "/providers/freepik.svg",
  freetheai: "/providers/freetheai.svg",
  friendli: "/providers/friendli.svg",
  friendliai: "/providers/friendliai.png",
  "g4f-gemini": "/providers/gemini.svg",
  "g4f-groq": "/providers/groq.svg",
  "g4f-nvidia": "/providers/nvidia.svg",
  "g4f-ollama": "/providers/ollama.svg",
  "g4f-pollinations": "/providers/pollinations.svg",
  galadriel: "/providers/galadriel.svg",
  gemini: "/providers/gemini.svg",
  "gemini-cli": "/providers/gemini-cli.svg",
  "gemini-web": "/providers/gemini-web.svg",
  getgoapi: "/providers/getgoapi.png",
  "ghe-copilot": "/providers/github.svg",
  gigachat: "/providers/gigachat.png",
  github: "/providers/github.svg",
  "github-models": "/providers/github-models.svg",
  gitlab: "/providers/gitlab.svg",
  "gitlab-duo": "/providers/gitlab-duo.svg",
  gitlawb: "/providers/gitlawb.svg",
  "gitlawb-gmi": "/providers/gitlawb-gmi.svg",
  glhf: "/providers/glhf.svg",
  glm: "/providers/glm.svg",
  "glm-cn": "/providers/glm-cn.svg",
  glmt: "/providers/glm.svg",
  google: "/providers/google.svg",
  "google-pse": "/providers/google-pse.svg",
  "google-tts": "/providers/google-tts.svg",
  grok: "/providers/grok.svg",
  "grok-cli": "/providers/xai.svg",
  "grok-web": "/providers/grok-web.svg",
  groq: "/providers/groq.svg",
  hackclub: "/providers/hackclub.svg",
  haiper: "/providers/haiper.svg",
  hcnsec: "/providers/hcnsec.svg",
  hermes: "/providers/hermes.png",
  heroku: "/providers/heroku.svg",
  huggingchat: "/providers/huggingchat.svg",
  huggingface: "/providers/huggingface.svg",
  hyperagent: "/providers/hyperagent.svg",
  hyperbolic: "/providers/hyperbolic.svg",
  ibm: "/providers/ibm.svg",
  ideogram: "/providers/ideogram.svg",
  iflow: "/providers/iflow.png",
  iflytek: "/providers/iflytek.svg",
  inception: "/providers/inception.svg",
  inclusionai: "/providers/inclusionai.svg",
  inference: "/providers/inference.svg",
  "inference-net": "/providers/inference-net.png",
  "inner-ai": "/providers/inner-ai.png",
  internlm: "/providers/internlm.svg",
  inworld: "/providers/inworld.svg",
  ironclaw: "/providers/ironclaw.png",
  jcode: "/providers/jcode.png",
  "jina-ai": "/providers/jina-ai.svg",
  "jina-reader": "/providers/jina-reader.svg",
  jules: "/providers/jules.svg",
  kenari: "/providers/kenari.svg",
  kie: "/providers/kie.png",
  "kilo-gateway": "/providers/kilo-gateway.svg",
  kilocode: "/providers/kilocode.svg",
  kimchi: "/providers/kimchi.svg",
  kimi: "/providers/kimi.svg",
  "kimi-coding": "/providers/kimi-coding.png",
  "kimi-coding-apikey": "/providers/kimi-coding.png",
  "kimi-logomark-dark": "/providers/kimi-logomark-dark.svg",
  "kimi-logomark-light": "/providers/kimi-logomark-light.svg",
  "kimi-web": "/providers/kimi-web.png",
  kiro: "/providers/kiro.svg",
  kluster: "/providers/kluster.svg",
  krutrim: "/providers/krutrim.svg",
  lambda: "/providers/lambda.svg",
  "lambda-ai": "/providers/lambda-ai.svg",
  laozhang: "/providers/laozhang.png",
  lemonade: "/providers/lemonade.png",
  leonardo: "/providers/leonardo.svg",
  lepton: "/providers/lepton.svg",
  letta: "/providers/letta.png",
  linkup: "/providers/linkup.png",
  "linkup-search": "/providers/linkup-search.png",
  liquid: "/providers/liquid.svg",
  "llama-cpp": "/providers/llama-cpp.svg",
  llamafile: "/providers/llamafile.svg",
  llamagate: "/providers/llamagate.svg",
  llm7: "/providers/llm7.svg",
  "lm-studio": "/providers/lm-studio.png",
  lmarena: "/providers/lmarena.png",
  "local-device": "/providers/local-device.png",
  longcat: "/providers/longcat.svg",
  maritalk: "/providers/maritalk.png",
  meta: "/providers/meta.svg",
  "meta-llama": "/providers/meta-llama.png",
  metaai: "/providers/metaai.svg",
  "mimo-free": "/providers/mimo-free.png",
  mimocode: "/providers/xiaomi-mimo.svg",
  minimax: "/providers/minimax.svg",
  "minimax-cn": "/providers/minimax-cn.png",
  mistral: "/providers/mistral.svg",
  mmf: "/providers/mmf.png",
  modal: "/providers/modal.svg",
  modelscope: "/providers/modelscope.svg",
  monsterapi: "/providers/monsterapi.svg",
  moonshot: "/providers/moonshot.svg",
  morph: "/providers/morph.svg",
  "muse-spark-web": "/providers/muse-spark-web.png",
  nanobanana: "/providers/nanobanana.png",
  nanobot: "/providers/nanobot.png",
  nanogpt: "/providers/nanogpt.png",
  nara: "/providers/nara.svg",
  navy: "/providers/navy.svg",
  nebius: "/providers/nebius.svg",
  nlpcloud: "/providers/nlpcloud.svg",
  nomic: "/providers/nomic.svg",
  "notion-web": "/providers/notion-web.svg",
  "nous-research": "/providers/nous-research.png",
  novita: "/providers/novita.svg",
  nscale: "/providers/nscale.png",
  nube: "/providers/nube.svg",
  nvidia: "/providers/nvidia.svg",
  "oai-cc": "/providers/oai-cc.png",
  "oai-r": "/providers/oai-r.png",
  oauth: "/providers/oauth.svg",
  oci: "/providers/oci.svg",
  ollama: "/providers/ollama.svg",
  "ollama-cloud": "/providers/ollama-cloud.svg",
  "ollama-local": "/providers/ollama-local.svg",
  omp: "/providers/omp.png",
  oobabooga: "/providers/oobabooga.svg",
  openadapter: "/providers/openadapter.svg",
  openai: "/providers/openai.svg",
  openclaw: "/providers/openclaw.svg",
  opencode: "/providers/opencode.svg",
  "opencode-dark": "/providers/opencode-dark.svg",
  "opencode-go": "/providers/opencode-go.svg",
  "opencode-light": "/providers/opencode-light.svg",
  "opencode-zen": "/providers/opencode-zen.svg",
  openrouter: "/providers/openrouter.svg",
  openvecta: "/providers/openvecta.svg",
  orcarouter: "/providers/orcarouter.svg",
  ovhcloud: "/providers/ovhcloud.svg",
  perplexity: "/providers/perplexity.svg",
  "perplexity-agent": "/providers/perplexity-agent.png",
  "perplexity-web": "/providers/perplexity-web.svg",
  phind: "/providers/phind.svg",
  piapi: "/providers/piapi.png",
  picoclaw: "/providers/picoclaw.svg",
  pioneer: "/providers/pioneer.svg",
  plamo: "/providers/plamo.svg",
  playht: "/providers/playht.svg",
  poe: "/providers/poe.svg",
  "poe-web": "/providers/poe-web.svg",
  pollinations: "/providers/pollinations.svg",
  poolside: "/providers/poolside.svg",
  predibase: "/providers/predibase.png",
  promptql: "/providers/promptql.svg",
  publicai: "/providers/publicai.svg",
  puter: "/providers/puter.svg",
  qianfan: "/providers/qianfan.svg",
  qiniu: "/providers/qiniu.svg",
  qoder: "/providers/qoder.png",
  qwen: "/providers/qwen.svg",
  "qwen-cloud": "/providers/qwencloud.svg",
  "qwen-cloud-token-plan": "/providers/qwencloud.svg",
  "qwen-web": "/providers/qwen.svg",
  qwencloud: "/providers/qwencloud.svg",
  qwencoder: "/providers/qwen.svg",
  recraft: "/providers/recraft.svg",
  reka: "/providers/reka.svg",
  replicate: "/providers/replicate.svg",
  requesty: "/providers/requesty.svg",
  roo: "/providers/roocode.svg",
  roocode: "/providers/roocode.svg",
  routeway: "/providers/routeway.svg",
  runway: "/providers/runway.svg",
  runwayml: "/providers/runway.svg",
  sambanova: "/providers/sambanova.svg",
  sap: "/providers/sap.svg",
  sarvam: "/providers/sarvam.svg",
  scaleway: "/providers/scaleway.svg",
  sdwebui: "/providers/sdwebui.svg",
  sealion: "/providers/sealion.svg",
  searchapi: "/providers/searchapi.svg",
  searxng: "/providers/searxng.png",
  "searxng-search": "/providers/searxng-search.svg",
  sensenova: "/providers/sensenova.svg",
  serper: "/providers/serper.png",
  "serper-search": "/providers/serper-search.svg",
  siliconflow: "/providers/siliconflow.png",
  snowflake: "/providers/snowflake.svg",
  sparkdesk: "/providers/sparkdesk.svg",
  "stability-ai": "/providers/stability-ai.svg",
  stepfun: "/providers/stepfun.svg",
  sumopod: "/providers/sumopod.svg",
  suno: "/providers/suno.svg",
  synthetic: "/providers/synthetic.svg",
  "t3-web": "/providers/t3-web.svg",
  tavily: "/providers/tavily.svg",
  tencent: "/providers/tencent.svg",
  thebai: "/providers/thebai.svg",
  theoldllm: "/providers/theoldllm.svg",
  together: "/providers/together.svg",
  tokenrouter: "/providers/tokenrouter.svg",
  topaz: "/providers/topaz.svg",
  topazlabs: "/providers/topazlabs.svg",
  tortoise: "/providers/tortoise.svg",
  trae: "/providers/trae.svg",
  triton: "/providers/triton.png",
  typhoon: "/providers/typhoon.svg",
  udio: "/providers/udio.svg",
  uncloseai: "/providers/uncloseai.svg",
  upstage: "/providers/upstage.svg",
  v0: "/providers/v0.svg",
  "v0-vercel": "/providers/v0.svg",
  "v0-vercel-web": "/providers/v0.svg",
  venice: "/providers/venice.svg",
  "venice-web": "/providers/venice-web.svg",
  "veoaifree-web": "/providers/veoaifree-web.svg",
  vercel: "/providers/vercel.svg",
  "vercel-ai-gateway": "/providers/vercel.svg",
  vertex: "/providers/vertex.png",
  "vertex-partner": "/providers/vertex-partner.png",
  vllm: "/providers/vllm.svg",
  volcengine: "/providers/volcengine.svg",
  "volcengine-ark": "/providers/volcengine-ark.svg",
  voyage: "/providers/voyage.svg",
  "voyage-ai": "/providers/voyage.svg",
  wafer: "/providers/wafer.svg",
  wandb: "/providers/wandb.svg",
  watsonx: "/providers/watsonx.png",
  windsurf: "/providers/windsurf.svg",
  writer: "/providers/writer.svg",
  x5lab: "/providers/x5lab.svg",
  xai: "/providers/xai.svg",
  "xai-oauth": "/providers/xai.svg",
  "xiaomi-mimo": "/providers/xiaomi-mimo.svg",
  "xiaomi-tokenplan": "/providers/xiaomi-tokenplan.png",
  xinference: "/providers/xinference.svg",
  yi: "/providers/yi.svg",
  youcom: "/providers/youcom.png",
  "youcom-search": "/providers/youcom-search.svg",
  "yuanbao-web": "/providers/yuanbao-web.svg",
  zai: "/providers/zai.svg",
  "zai-web": "/providers/zai-web.svg",
  zed: "/providers/zed.png",
  "zed-hosted": "/providers/zed-hosted.svg",
  zenmux: "/providers/zenmux.svg",
  "zenmux-free": "/providers/zenmux-free.svg",
  zeroclaw: "/providers/zeroclaw.png",
  zhipu: "/providers/zhipu.svg",
};

const curatedProviderIconIds = new Set([]);  // paths fully explicit in overrides

export function getProviderIconPath(providerId) {
  const resolvedProviderId = resolveProviderId(providerId);
  if (providerIconPathOverrides[resolvedProviderId]) {
    return providerIconPathOverrides[resolvedProviderId];
  }
  // Omni: try .svg then .png (cascade handled by getProviderIconLocalCandidates / Sources)
  if (curatedProviderIconIds.has(resolvedProviderId)) {
    return `/providers/${resolvedProviderId}.svg`;
  }
  return `/providers/${resolvedProviderId}.png`;
}

/** Local candidate paths: override, svg, png, ico (Omni tries svg then png). */
export function getProviderIconLocalCandidates(providerId) {
  const id = resolveProviderId(providerId);
  if (!id) return [];
  const out = [];
  const seen = new Set();
  const push = (p) => {
    if (!p || seen.has(p)) return;
    seen.add(p);
    out.push(p);
  };
  push(providerIconPathOverrides[id]);
  push(`/providers/${id}.svg`);
  push(`/providers/${id}.png`);
  push(`/providers/${id}.ico`);
  return out;
}


const providerDomainIconMatches = [
  ["openrouter.ai", "openrouter"],
  ["api.groq.com", "groq"],
  ["api.deepseek.com", "deepseek"],
  ["api.qwencoder.cloud", "qwencoder"],
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

  // Known catalog / endpoint providers: always prefer local /providers icon first.
  // External favicons are fallback only (avoids wrong/generic domain icons).
  if (!hasExplicitBaseUrl) {
    return [...new Set([
      knownProviderIconPath || fallbackIconPath,
      ...faviconUrls,
      fallbackIconPath,
    ].filter(Boolean))];
  }

  const inferredProviderId = inferProviderIconId(providerConfig);
  const inferredIconPath = inferredProviderId ? getProviderIconPath(inferredProviderId) : "";
  const inferredFaviconUrls = inferredProviderId
    ? getProviderFaviconUrlsFromConfig({ id: inferredProviderId })
    : [];
  if (inferredIconPath) {
    return [...new Set([
      inferredIconPath,
      knownProviderIconPath,
      fallbackIconPath,
      ...inferredFaviconUrls,
      ...faviconUrls,
    ].filter(Boolean))];
  }

  return [...new Set([
    knownProviderIconPath,
    fallbackIconPath,
    ...faviconUrls,
  ].filter(Boolean))];
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
