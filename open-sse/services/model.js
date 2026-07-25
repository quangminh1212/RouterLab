// Provider alias to ID mapping
const ALIAS_TO_PROVIDER_ID = {
  cc: "claude",
  cx: "codex",
  gc: "gemini-cli",
  qw: "qwen",
  if: "iflow",
  ag: "antigravity",
  gh: "github",
  kr: "kiro",
  cu: "cursor",
  kc: "kilocode",
  kmc: "kimi-coding",
  cl: "cline",
  oc: "opencode",
  ocg: "opencode-go",
  // OAuth/CLI vendor providers (Đợt 3)
  qoder: "qoder", qd: "qoder",
  gitlab: "gitlab", gl: "gitlab", "gitlab-duo": "gitlab",
  codebuddy: "codebuddy", cb: "codebuddy",
  "amazon-q": "amazon-q", aq: "amazon-q",
  // TTS providers
  el: "elevenlabs",
  // API Key providers
  openai: "openai",
  vercel: "vercel-ai-gateway",
  "vercel-ai-gateway": "vercel-ai-gateway",
  anthropic: "anthropic",
  gemini: "gemini",
  openrouter: "openrouter",
  glm: "glm",
  kimi: "kimi",
  minimax: "minimax",
  "minimax-cn": "minimax-cn",
  ds: "deepseek",
  deepseek: "deepseek",
  cmc: "commandcode",
  commandcode: "commandcode",
  "command-code": "commandcode",
  groq: "groq",
  xai: "xai",
  mistral: "mistral",
  pplx: "perplexity",
  perplexity: "perplexity",
  together: "together",
  fireworks: "fireworks",
  cerebras: "cerebras",
  cohere: "cohere",
  nvidia: "nvidia",
  nebius: "nebius",
  siliconflow: "siliconflow",
  hyp: "hyperbolic",
  hyperbolic: "hyperbolic",
  dg: "deepgram",
  deepgram: "deepgram",
  aai: "assemblyai",
  assemblyai: "assemblyai",
  nb: "nanobanana",
  nanobanana: "nanobanana",
  ch: "chutes",
  chutes: "chutes",
  ark: "volcengine-ark",
  "volcengine-ark": "volcengine-ark",
  "azure-openai": "azure",
  "bailian-coding-plan": "alicode",
  "alibaba-cn": "alicode",
  "kimi-coding-apikey": "kimi-coding",
  "devin-cli": "devin-cli",
  "v0-vercel": "v0-vercel-web",
  byteplus: "byteplus",
  bpm: "byteplus",
  cursor: "cursor",
  vx: "vertex",
  vertex: "vertex",
  vxp: "vertex-partner",
  "vertex-partner": "vertex-partner",
  // Web cookie providers
  gw: "grok-web",
  "grok-web": "grok-web",
  pw: "perplexity-web",
  "perplexity-web": "perplexity-web",
  mimo: "xiaomi-mimo",
  "xiaomi-mimo": "xiaomi-mimo",
  xmtp: "xiaomi-tokenplan",
  "xiaomi-tokenplan": "xiaomi-tokenplan",
  cf: "cloudflare-ai",
  "cloudflare-ai": "cloudflare-ai",
  // Image/video providers
  fal: "fal-ai",
  "fal-ai": "fal-ai",
  stability: "stability-ai",
  "stability-ai": "stability-ai",
  segmind: "segmind",

  bfl: "black-forest-labs",
  "black-forest-labs": "black-forest-labs",
  recraft: "recraft",
  topaz: "topaz",
  runway: "runwayml",
  runwayml: "runwayml",
  // Embedding/rerank
  jina: "jina-ai",
  "jina-ai": "jina-ai",
  // TTS
  polly: "aws-polly",
  "aws-polly": "aws-polly",
  // Free-tier providers (synced from OmniRoute)
  agentrouter: "agentrouter",
  aimlapi: "aimlapi",
  aiml: "aimlapi",
  novita: "novita",
  modal: "modal",
  mdl: "modal",
  reka: "reka",
  nlpcloud: "nlpcloud",
  nlpc: "nlpcloud",
  bazaarlink: "bazaarlink",
  bzl: "bazaarlink",
  completions: "completions",
  cpl: "completions",
  enally: "enally",
  enly: "enally",
  freetheai: "freetheai",
  fta: "freetheai",
  llm7: "llm7",
  lepton: "lepton",
  kluster: "kluster",
  ai21: "ai21",
  "inference-net": "inference-net",
  inet: "inference-net",
  predibase: "predibase",
  bytez: "bytez",
  morph: "morph",
  longcat: "longcat",
  lc: "longcat",
  puter: "puter",
  pu: "puter",
  uncloseai: "uncloseai",
  unc: "uncloseai",
  scaleway: "scaleway",
  scw: "scaleway",
  deepinfra: "deepinfra",
  sambanova: "sambanova",
  samba: "sambanova",
  nscale: "nscale",
  baseten: "baseten",
  publicai: "publicai",
  "nous-research": "nous-research",
  nous: "nous-research",
  glhf: "glhf",
  bb: "blackbox",
  blackbox: "blackbox",
  // === Batch 2 (synced from OmniRoute) — id maps to itself + short alias ===
  "api-airforce": "api-airforce", af: "api-airforce",
  astraflow: "astraflow",
  "astraflow-cn": "astraflow-cn",
  qianfan: "qianfan",
  crof: "crof",
  zai: "zai",
  "github-models": "github-models", ghm: "github-models",
  "ollama-cloud": "ollama-cloud", ollamacloud: "ollama-cloud",
  synthetic: "synthetic",
  "kilo-gateway": "kilo-gateway", kg: "kilo-gateway",
  "opencode-zen": "opencode-zen",
  "meta-llama": "meta-llama", meta: "meta-llama",
  moonshot: "moonshot",
  ovhcloud: "ovhcloud", ovh: "ovhcloud",
  "lambda-ai": "lambda-ai", lambda: "lambda-ai",
  "featherless-ai": "featherless-ai", featherless: "featherless-ai",
  friendliai: "friendliai", friendli: "friendliai",
  llamagate: "llamagate",
  gigachat: "gigachat",
  venice: "venice",
  codestral: "codestral",
  upstage: "upstage",
  maritalk: "maritalk",
  nanogpt: "nanogpt",
  piapi: "piapi", pi: "piapi",
  getgoapi: "getgoapi", ggo: "getgoapi",
  laozhang: "laozhang", lz: "laozhang",
  cablyai: "cablyai",
  thebai: "thebai",
  fenayai: "fenayai",
  empower: "empower",
  poe: "poe",
  galadriel: "galadriel",
  wandb: "wandb",
  volcengine: "volcengine",
  gitlawb: "gitlawb", glb: "gitlawb",
  "gitlawb-gmi": "gitlawb-gmi", "glb-gmi": "gitlawb-gmi",
  bluesminds: "bluesminds", bm: "bluesminds",
  "freemodel-dev": "freemodel-dev", fmd: "freemodel-dev",
  freeaiapikey: "freeaiapikey", faik: "freeaiapikey",
  kie: "kie",
  hackclub: "hackclub", hc: "hackclub",
  pollinations: "pollinations", pol: "pollinations",
  replicate: "replicate", rep: "replicate",
  poolside: "poolside",
  "arcee-ai": "arcee-ai", arcee: "arcee-ai",
  inclusionai: "inclusionai", inclusion: "inclusionai",
  liquid: "liquid",
  nomic: "nomic",
  krutrim: "krutrim",
  monsterapi: "monsterapi", monster: "monsterapi",
  dify: "dify",
  // OmniRoute wave (Đợt 6)
  tokenrouter: "tokenrouter", trk: "tokenrouter",
  requesty: "requesty",
  zenmux: "zenmux", zm: "zenmux",
  "zenmux-free": "zenmux-free", zmf: "zenmux-free",
  dgrid: "dgrid",
  orcarouter: "orcarouter",
  modelscope: "modelscope", ms: "modelscope",
  digitalocean: "digitalocean", doai: "digitalocean",
  alibaba: "alibaba", ali: "alibaba",
  "alibaba-cn": "alibaba-cn", alicn: "alibaba-cn",
  "bailian-coding-plan": "bailian-coding-plan", bcp: "bailian-coding-plan",
  hcnsec: "hcnsec",
  glmt: "glmt",
  sparkdesk: "sparkdesk",
  openvecta: "openvecta",
  sumopod: "sumopod",
  kenari: "kenari",
  x5lab: "x5lab",
  wafer: "wafer",
  nube: "nube",
  qiniu: "qiniu",
  factory: "factory",
  openadapter: "openadapter", oad: "openadapter",
  pioneer: "pioneer", pn: "pioneer",
  "charm-hyper": "charm-hyper", charm: "charm-hyper",
  dit: "dit", dai: "dit",
  bai: "bai",
  "v0-vercel": "v0-vercel", v0api: "v0-vercel",
  "codebuddy-cn": "codebuddy-cn", cbcn: "codebuddy-cn",
  "kimi-coding-apikey": "kimi-coding-apikey", kmca: "kimi-coding-apikey",
  theoldllm: "theoldllm", tllm: "theoldllm",
  mimocode: "mimocode", mcode: "mimocode",
  auggie: "auggie", aug: "auggie",
  agy: "agy",
  windsurf: "windsurf", ws: "windsurf",
  trae: "trae", tr: "trae",
  zed: "zed", zd: "zed",
  "zed-hosted": "zed-hosted", zedh: "zed-hosted",
  clinepass: "clinepass", cp: "clinepass",
  "grok-cli": "grok-cli", gcli: "grok-cli",
  "devin-cli": "devin-cli", dvcli: "devin-cli",
  "yuanbao-web": "yuanbao-web", ybw: "yuanbao-web",
  "zai-web": "zai-web", zw: "zai-web",
  "qwen-web": "qwen-web", qweb: "qwen-web",
  "copilot-m365-web": "copilot-m365-web", m365copilot: "copilot-m365-web",
  lmarena: "lmarena", lma: "lmarena",
  "veoaifree-web": "veoaifree-web", "veo-free": "veoaifree-web",
  // OmniRoute naming aliases → existing XLab ids
  "azure-openai": "azure",
  "gitlab-duo": "gitlab",
  "command-code": "commandcode",
  "tavily-search": "tavily",
  "serper-search": "serper",
  "exa-search": "exa",
  "google-pse-search": "google-pse",
  "linkup-search": "linkup",
  "searchapi-search": "searchapi",
  "youcom-search": "youcom",
  "searxng-search": "searxng",
  "ollama-search": "ollama",
  "perplexity-search": "perplexity",
  baidu: "baidu",
  tencent: "tencent",
  iflytek: "iflytek",
  baichuan: "baichuan",
  yi: "yi",
  stepfun: "stepfun",
  "360ai": "360ai",
  sensenova: "sensenova",
  doubao: "doubao",
  coze: "coze",
  "azure-ai": "azure-ai",
  watsonx: "watsonx",
  oci: "oci",
  sap: "sap",
  databricks: "databricks",
  datarobot: "datarobot",
  clarifai: "clarifai",
  snowflake: "snowflake",
  heroku: "heroku",
  "lm-studio": "lm-studio", lmstudio: "lm-studio",
  vllm: "vllm",
  lemonade: "lemonade",
  llamafile: "llamafile",
  "llama-cpp": "llama-cpp", llamacpp: "llama-cpp",
  triton: "triton",
  "docker-model-runner": "docker-model-runner", dmr: "docker-model-runner",
  xinference: "xinference",
  oobabooga: "oobabooga", ooba: "oobabooga",
  // Media image/video providers
  ideogram: "ideogram", ideo: "ideogram",
  leonardo: "leonardo", leo: "leonardo",
  haiper: "haiper", hp: "haiper",
  // Amazon Bedrock
  bedrock: "bedrock", br: "bedrock",
  // Web-cookie chat providers (Đợt 4)
  "duckduckgo-web": "duckduckgo-web", ddgw: "duckduckgo-web",
  "chatgpt-web": "chatgpt-web", "cgpt-web": "chatgpt-web",
  "gemini-web": "gemini-web", gweb: "gemini-web",
  "claude-web": "claude-web", cw: "claude-web",
  "deepseek-web": "deepseek-web", "ds-web": "deepseek-web",
  "copilot-web": "copilot-web", copilot: "copilot-web",
  "blackbox-web": "blackbox-web", "bb-web": "blackbox-web",
  "muse-spark-web": "muse-spark-web", "ms-web": "muse-spark-web",
  "t3-web": "t3-web", t3chat: "t3-web",
  "inner-ai": "inner-ai", "in-ai": "inner-ai",
  "adapta-web": "adapta-web", "adp-web": "adapta-web",
  huggingchat: "huggingchat", hgc: "huggingchat",
  phind: "phind", ph: "phind",
  "poe-web": "poe-web",
  "venice-web": "venice-web", ven: "venice-web",
  "v0-vercel-web": "v0-vercel-web", v0: "v0-vercel-web",
  "kimi-web": "kimi-web",
  "doubao-web": "doubao-web", db: "doubao-web",
  "veoaifree-web": "veoaifree-web", "veo-free": "veoaifree-web",
  // Upstream proxy meta-providers
  cliproxyapi: "cliproxyapi", cpa: "cliproxyapi",
  "9router": "9router", nr: "9router",
  // Cloud agents + music (registered for parity)
  jules: "jules",
  devin: "devin",
  "codex-cloud": "codex-cloud",
  suno: "suno",
  udio: "udio",
};

/**
 * Resolve provider alias to provider ID
 */
export function resolveProviderAlias(aliasOrId) {
  return ALIAS_TO_PROVIDER_ID[aliasOrId] || aliasOrId;
}

/**
 * Parse model string: "alias/model" or "provider/model" or just alias
 */
export function parseModel(modelStr) {
  if (!modelStr) {
    return { provider: null, model: null, isAlias: false, providerAlias: null };
  }

  // Check if standard format: provider/model or alias/model
  if (modelStr.includes("/")) {
    const firstSlash = modelStr.indexOf("/");
    const providerOrAlias = modelStr.slice(0, firstSlash);
    const model = modelStr.slice(firstSlash + 1);
    const provider = resolveProviderAlias(providerOrAlias);
    return { provider, model, isAlias: false, providerAlias: providerOrAlias };
  }

  // Alias format (model alias, not provider alias)
  return {
    provider: null,
    model: modelStr,
    isAlias: true,
    providerAlias: null,
  };
}

/**
 * Resolve model alias from aliases object
 * Format: { "alias": "provider/model" }
 */
export function resolveModelAliasFromMap(alias, aliases) {
  if (!aliases) return null;

  // Check if alias exists
  const resolved = aliases[alias];
  if (!resolved) return null;

  // Resolved value is "provider/model" format
  if (typeof resolved === "string" && resolved.includes("/")) {
    const firstSlash = resolved.indexOf("/");
    const providerOrAlias = resolved.slice(0, firstSlash);
    return {
      provider: resolveProviderAlias(providerOrAlias),
      model: resolved.slice(firstSlash + 1),
    };
  }

  // Or object { provider, model }
  if (typeof resolved === "object" && resolved.provider && resolved.model) {
    return {
      provider: resolveProviderAlias(resolved.provider),
      model: resolved.model,
    };
  }

  return null;
}

/**
 * Get full model info (parse or resolve)
 * @param {string} modelStr - Model string
 * @param {object|function} aliasesOrGetter - Aliases object or async function to get aliases
 */
export async function getModelInfoCore(modelStr, aliasesOrGetter, forcedMappings = null) {
  const parsed = parseModel(modelStr);

  if (!parsed.isAlias) {
    return {
      provider: parsed.provider,
      model: parsed.model,
    };
  }

  // Get aliases (from object or function)
  const aliases =
    typeof aliasesOrGetter === "function"
      ? await aliasesOrGetter()
      : aliasesOrGetter;

  // Forced mappings override aliases first
  const forcedResolved = resolveModelAliasFromMap(parsed.model, forcedMappings);
  if (forcedResolved) {
    return forcedResolved;
  }

  // Resolve alias
  const resolved = resolveModelAliasFromMap(parsed.model, aliases);
  if (resolved) {
    return resolved;
  }

  // Fallback: infer provider from model name prefix
  return {
    provider: inferProviderFromModelName(parsed.model),
    model: parsed.model,
  };
}

/**
 * Infer provider from model name prefix
 * Used as fallback when no provider prefix or alias is given
 */
function inferProviderFromModelName(modelName) {
  if (!modelName) return "openai";
  const m = modelName.toLowerCase();
  if (m.startsWith("claude-")) return "anthropic";
  if (m.startsWith("gemini-")) return "gemini";
  if (m.startsWith("gpt-")) return "openai";
  if (m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4"))
    return "openai";
  if (m.startsWith("deepseek-")) return "openrouter";
  // Default fallback
  return "openai";
}
