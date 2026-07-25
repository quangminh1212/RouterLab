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
  // Origin-site title icons (favicon/apple-touch) per provider website.
  // Prefer .png site favicon; fallback svg/ico when needed.
  "360ai": "/providers/360ai.png",
  "9router": "/providers/9router.png",
  "adapta-web": "/providers/adapta-web.png",
  agentrouter: "/providers/agentrouter.png",
  agnes: "/providers/agnes.png",
  agy: "/providers/agy.png",
  ai21: "/providers/ai21.png",
  aihorde: "/providers/aihorde.png",
  aimlapi: "/providers/aimlapi.png",
  ainative: "/providers/ainative.png",
  aion: "/providers/aion.png",
  alibaba: "/providers/alibaba.svg",
  "alibaba-cn": "/providers/alibaba-cn.svg",
  alicode: "/providers/alicode.png",
  "alicode-intl": "/providers/alicode-intl.png",
  "amazon-q": "/providers/amazon-q.png",
  "ant-ling": "/providers/ant-ling.svg",
  anthropic: "/providers/anthropic.png",
  antigravity: "/providers/antigravity.png",
  "api-airforce": "/providers/api-airforce.png",
  "arcee-ai": "/providers/arcee-ai.png",
  assemblyai: "/providers/assemblyai.png",
  astraflow: "/providers/astraflow.png",
  "astraflow-cn": "/providers/astraflow-cn.png",
  auggie: "/providers/auggie.png",
  auto: "/providers/auto-route.svg",
  "aws-polly": "/providers/aws-polly.png",
  azure: "/providers/azure.png",
  "azure-ai": "/providers/azure-ai.png",
  bai: "/providers/bai.svg",
  baichuan: "/providers/baichuan.png",
  baidu: "/providers/baidu.png",
  "bailian-coding-plan": "/providers/bailian-coding-plan.svg",
  baseten: "/providers/baseten.png",
  bazaarlink: "/providers/bazaarlink.png",
  bedrock: "/providers/bedrock.png",
  "black-forest-labs": "/providers/black-forest-labs.png",
  blackbox: "/providers/blackbox.png",
  "blackbox-web": "/providers/blackbox-web.png",
  bluesminds: "/providers/bluesminds.svg",
  "brave-search": "/providers/brave-search.png",
  byteplus: "/providers/byteplus.png",
  bytez: "/providers/bytez.png",
  cablyai: "/providers/cablyai.svg",
  cartesia: "/providers/cartesia.png",
  cerebras: "/providers/cerebras.png",
  "charm-hyper": "/providers/charm-hyper.png",
  "chatgpt-web": "/providers/chatgpt-web.png",
  chenzk: "/providers/chenzk.svg",
  chipotle: "/providers/chipotle.svg",
  chutes: "/providers/chutes.png",
  clarifai: "/providers/clarifai.png",
  claude: "/providers/claude.png",
  "claude-web": "/providers/claude-web.png",
  cline: "/providers/cline.png",
  clinepass: "/providers/clinepass.png",
  cliproxyapi: "/providers/cliproxyapi.png",
  "cloudflare-ai": "/providers/cloudflare-ai.png",
  "clova-studio": "/providers/clova-studio.png",
  codebuddy: "/providers/codebuddy.png",
  "codebuddy-cn": "/providers/codebuddy-cn.png",
  codestral: "/providers/codestral.png",
  codex: "/providers/codex.png",
  "codex-cloud": "/providers/codex-cloud.png",
  cohere: "/providers/cohere.png",
  comfyui: "/providers/comfyui.png",
  "command-code": "/providers/command-code.png",
  commandcode: "/providers/commandcode.png",
  completions: "/providers/completions.png",
  "copilot-m365-web": "/providers/copilot-m365-web.png",
  "copilot-web": "/providers/copilot-web.png",
  coqui: "/providers/coqui.png",
  coze: "/providers/coze.png",
  crof: "/providers/crof.png",
  cursor: "/providers/cursor.png",
  dahl: "/providers/dahl.png",
  databricks: "/providers/databricks.png",
  datarobot: "/providers/datarobot.png",
  deepgram: "/providers/deepgram.png",
  deepinfra: "/providers/deepinfra.png",
  deepseek: "/providers/deepseek.png",
  "deepseek-web": "/providers/deepseek-web.png",
  devin: "/providers/devin.png",
  "devin-cli": "/providers/devin-cli.png",
  dgrid: "/providers/dgrid.png",
  dify: "/providers/dify.png",
  digitalocean: "/providers/digitalocean.png",
  dit: "/providers/dit.png",
  "docker-model-runner": "/providers/docker-model-runner.png",
  doubao: "/providers/doubao.png",
  "doubao-web": "/providers/doubao-web.png",
  "duckduckgo-web": "/providers/duckduckgo-web.png",
  "edge-tts": "/providers/edge-tts.png",
  elevenlabs: "/providers/elevenlabs.png",
  empower: "/providers/empower.png",
  enally: "/providers/enally.png",
  exa: "/providers/exa.png",
  factory: "/providers/factory.png",
  "fal-ai": "/providers/fal-ai.png",
  "featherless-ai": "/providers/featherless-ai.png",
  "felo-web": "/providers/felo-web.png",
  fenayai: "/providers/fenayai.svg",
  firecrawl: "/providers/firecrawl.png",
  fireworks: "/providers/fireworks.png",
  freeaiapikey: "/providers/freeaiapikey.png",
  "freemodel-dev": "/providers/freemodel-dev.png",
  freepik: "/providers/freepik.png",
  freetheai: "/providers/freetheai.svg",
  friendliai: "/providers/friendliai.png",
  "g4f-gemini": "/providers/g4f-gemini.png",
  "g4f-groq": "/providers/g4f-groq.png",
  "g4f-nvidia": "/providers/g4f-nvidia.png",
  "g4f-ollama": "/providers/g4f-ollama.png",
  "g4f-pollinations": "/providers/g4f-pollinations.png",
  galadriel: "/providers/galadriel.png",
  gemini: "/providers/gemini.png",
  "gemini-cli": "/providers/gemini-cli.png",
  "gemini-web": "/providers/gemini-web.png",
  getgoapi: "/providers/getgoapi.png",
  "ghe-copilot": "/providers/ghe-copilot.svg",
  gigachat: "/providers/gigachat.png",
  github: "/providers/github.png",
  "github-models": "/providers/github-models.png",
  gitlab: "/providers/gitlab.png",
  "gitlab-duo": "/providers/gitlab-duo.png",
  gitlawb: "/providers/gitlawb.png",
  "gitlawb-gmi": "/providers/gitlawb-gmi.png",
  glhf: "/providers/glhf.svg",
  glm: "/providers/glm.png",
  "glm-cn": "/providers/glm-cn.png",
  glmt: "/providers/glmt.png",
  "google-pse": "/providers/google-pse.png",
  "google-tts": "/providers/google-tts.png",
  "grok-cli": "/providers/grok-cli.png",
  "grok-web": "/providers/grok-web.png",
  groq: "/providers/groq.png",
  hackclub: "/providers/hackclub.png",
  haiper: "/providers/haiper.svg",
  hcnsec: "/providers/hcnsec.png",
  heroku: "/providers/heroku.png",
  huggingchat: "/providers/huggingchat.png",
  huggingface: "/providers/huggingface.png",
  hyperagent: "/providers/hyperagent.svg",
  hyperbolic: "/providers/hyperbolic.png",
  ideogram: "/providers/ideogram.png",
  iflow: "/providers/iflow.png",
  iflytek: "/providers/iflytek.png",
  inception: "/providers/inception.png",
  inclusionai: "/providers/inclusionai.svg",
  "inference-net": "/providers/inference-net.png",
  "inner-ai": "/providers/inner-ai.png",
  internlm: "/providers/internlm.png",
  inworld: "/providers/inworld.png",
  "jina-ai": "/providers/jina-ai.png",
  "jina-reader": "/providers/jina-reader.png",
  jules: "/providers/jules.png",
  kenari: "/providers/kenari.png",
  kie: "/providers/kie.png",
  "kilo-gateway": "/providers/kilo-gateway.png",
  kilocode: "/providers/kilocode.png",
  kimi: "/providers/kimi.png",
  "kimi-coding": "/providers/kimi-coding.png",
  "kimi-coding-apikey": "/providers/kimi-coding-apikey.png",
  "kimi-web": "/providers/kimi-web.png",
  kiro: "/providers/kiro.png",
  kluster: "/providers/kluster.png",
  krutrim: "/providers/krutrim.png",
  "lambda-ai": "/providers/lambda-ai.png",
  laozhang: "/providers/laozhang.png",
  lemonade: "/providers/lemonade.png",
  leonardo: "/providers/leonardo.png",
  lepton: "/providers/lepton.png",
  linkup: "/providers/linkup.png",
  liquid: "/providers/liquid.png",
  "llama-cpp": "/providers/llama-cpp.png",
  llamafile: "/providers/llamafile.png",
  llamagate: "/providers/llamagate.png",
  llm7: "/providers/llm7.png",
  "lm-studio": "/providers/lm-studio.png",
  lmarena: "/providers/lmarena.png",
  "local-device": "/providers/local-device.png",
  longcat: "/providers/longcat.png",
  maritalk: "/providers/maritalk.png",
  "meta-llama": "/providers/meta-llama.png",
  mimocode: "/providers/mimocode.png",
  minimax: "/providers/minimax.png",
  "minimax-cn": "/providers/minimax-cn.png",
  mistral: "/providers/mistral.png",
  modal: "/providers/modal.png",
  modelscope: "/providers/modelscope.png",
  monsterapi: "/providers/monsterapi.svg",
  moonshot: "/providers/moonshot.png",
  morph: "/providers/morph.png",
  "muse-spark-web": "/providers/muse-spark-web.png",
  nanobanana: "/providers/nanobanana.png",
  nanogpt: "/providers/nanogpt.png",
  nara: "/providers/nara.svg",
  navy: "/providers/navy.png",
  nebius: "/providers/nebius.png",
  nlpcloud: "/providers/nlpcloud.png",
  nomic: "/providers/nomic.png",
  "notion-web": "/providers/notion-web.png",
  "nous-research": "/providers/nous-research.png",
  novita: "/providers/novita.png",
  nscale: "/providers/nscale.png",
  nube: "/providers/nube.png",
  nvidia: "/providers/nvidia.png",
  oci: "/providers/oci.png",
  ollama: "/providers/ollama.png",
  "ollama-cloud": "/providers/ollama-cloud.png",
  "ollama-local": "/providers/ollama-local.png",
  oobabooga: "/providers/oobabooga.png",
  openadapter: "/providers/openadapter.png",
  openai: "/providers/openai.png",
  opencode: "/providers/opencode.png",
  "opencode-go": "/providers/opencode-go.png",
  "opencode-zen": "/providers/opencode-zen.png",
  openrouter: "/providers/openrouter.png",
  openvecta: "/providers/openvecta.png",
  orcarouter: "/providers/orcarouter.png",
  ovhcloud: "/providers/ovhcloud.png",
  perplexity: "/providers/perplexity.png",
  "perplexity-web": "/providers/perplexity-web.png",
  phind: "/providers/phind.png",
  piapi: "/providers/piapi.png",
  pioneer: "/providers/pioneer.png",
  plamo: "/providers/plamo.png",
  playht: "/providers/playht.png",
  poe: "/providers/poe.png",
  "poe-web": "/providers/poe-web.png",
  pollinations: "/providers/pollinations.png",
  poolside: "/providers/poolside.png",
  predibase: "/providers/predibase.png",
  promptql: "/providers/promptql.png",
  publicai: "/providers/publicai.png",
  puter: "/providers/puter.png",
  qianfan: "/providers/qianfan.png",
  qiniu: "/providers/qiniu.png",
  qoder: "/providers/qoder.png",
  qwen: "/providers/qwen.png",
  "qwen-cloud": "/providers/qwen-cloud.png",
  "qwen-cloud-token-plan": "/providers/qwen-cloud-token-plan.png",
  "qwen-web": "/providers/qwen-web.png",
  qwencoder: "/providers/qwencoder.png",
  recraft: "/providers/recraft.png",
  reka: "/providers/reka.png",
  replicate: "/providers/replicate.png",
  requesty: "/providers/requesty.png",
  routeway: "/providers/routeway.png",
  runwayml: "/providers/runwayml.png",
  sambanova: "/providers/sambanova.png",
  sap: "/providers/sap.png",
  sarvam: "/providers/sarvam.svg",
  scaleway: "/providers/scaleway.png",
  sdwebui: "/providers/sdwebui.png",
  sealion: "/providers/sealion.png",
  searchapi: "/providers/searchapi.png",
  searxng: "/providers/searxng.png",
  sensenova: "/providers/sensenova.png",
  serper: "/providers/serper.png",
  siliconflow: "/providers/siliconflow.png",
  snowflake: "/providers/snowflake.png",
  sparkdesk: "/providers/sparkdesk.png",
  "stability-ai": "/providers/stability-ai.png",
  segmind: "/providers/segmind.png",
  stepfun: "/providers/stepfun.png",
  sumopod: "/providers/sumopod.png",
  suno: "/providers/suno.png",
  synthetic: "/providers/synthetic.png",
  "t3-web": "/providers/t3-web.png",
  tavily: "/providers/tavily.png",
  tencent: "/providers/tencent.png",
  thebai: "/providers/thebai.svg",
  theoldllm: "/providers/theoldllm.png",
  together: "/providers/together.png",
  tokenrouter: "/providers/tokenrouter.png",
  topaz: "/providers/topaz.png",
  tortoise: "/providers/tortoise.png",
  trae: "/providers/trae.png",
  triton: "/providers/triton.png",
  typhoon: "/providers/typhoon.png",
  udio: "/providers/udio.png",
  uncloseai: "/providers/uncloseai.png",
  upstage: "/providers/upstage.png",
  "v0-vercel": "/providers/v0-vercel.png",
  "v0-vercel-web": "/providers/v0-vercel-web.png",
  venice: "/providers/venice.png",
  "venice-web": "/providers/venice-web.png",
  "veoaifree-web": "/providers/veoaifree-web.png",
  "vercel-ai-gateway": "/providers/vercel-ai-gateway.png",
  vertex: "/providers/vertex.png",
  "vertex-partner": "/providers/vertex-partner.png",
  vllm: "/providers/vllm.png",
  volcengine: "/providers/volcengine.png",
  "volcengine-ark": "/providers/volcengine-ark.png",
  "voyage-ai": "/providers/voyage-ai.png",
  wafer: "/providers/wafer.png",
  wandb: "/providers/wandb.png",
  watsonx: "/providers/watsonx.png",
  windsurf: "/providers/windsurf.png",
  writer: "/providers/writer.png",
  x5lab: "/providers/x5lab.svg",
  xai: "/providers/xai.png",
  "xai-oauth": "/providers/xai-oauth.png",
  "xiaomi-mimo": "/providers/xiaomi-mimo.png",
  "xiaomi-tokenplan": "/providers/xiaomi-tokenplan.png",
  xinference: "/providers/xinference.png",
  yi: "/providers/yi.png",
  youcom: "/providers/youcom.png",
  "yuanbao-web": "/providers/yuanbao-web.png",
  zai: "/providers/zai.png",
  "zai-web": "/providers/zai-web.svg",
  zed: "/providers/zed.png",
  "zed-hosted": "/providers/zed-hosted.png",
  zenmux: "/providers/zenmux.png",
  "zenmux-free": "/providers/zenmux-free.png",
};

const curatedProviderIconIds = new Set([]);  // paths fully explicit in overrides

export function getProviderIconPath(providerId) {
  const resolvedProviderId = resolveProviderId(providerId);
  // Origin-site title icon first (full map in providerIconPathOverrides).
  if (providerIconPathOverrides[resolvedProviderId]) {
    return providerIconPathOverrides[resolvedProviderId];
  }
  if (typeof curatedProviderIconIds !== "undefined" && curatedProviderIconIds.has(resolvedProviderId)) {
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
