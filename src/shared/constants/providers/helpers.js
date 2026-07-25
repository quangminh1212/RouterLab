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
  agnes: "/providers/agnes.svg",
  agy: "/providers/antigravity.png",
  aihorde: "/providers/aihorde.svg",
  ainative: "/providers/ainative.svg",
  aion: "/providers/aion.svg",
  alibaba: "/providers/alicode.svg",
  "alibaba-cn": "/providers/alicode.svg",
  "ant-ling": "/providers/ant-ling.svg",
  anthropic: "/providers/anthropic.svg",
  auto: "/providers/auto-route.svg",
  bai: "/providers/thebai.svg",
  baichuan: "/providers/baichuan.svg",
  "bailian-coding-plan": "/providers/alicode.svg",
  bluesminds: "/providers/bluesminds.svg",
  cablyai: "/providers/cablyai.svg",
  chenzk: "/providers/chenzk.svg",
  chipotle: "/providers/chipotle.svg",
  clinepass: "/providers/cline.svg",
  "clova-studio": "/providers/clova-studio.svg",
  "codebuddy-cn": "/providers/codebuddy.png",
  codestral: "/providers/codestral.svg",
  "command-code": "/providers/commandcode.png",
  "copilot-m365-web": "/providers/copilot-web.svg",
  dahl: "/providers/dahl.svg",
  "devin-cli": "/providers/devin.png",
  "edge-tts": "/providers/edge-tts.svg",
  "felo-web": "/providers/felo-web.svg",
  fenayai: "/providers/fenayai.svg",
  freepik: "/providers/freepik.svg",
  freetheai: "/providers/freetheai.svg",
  "g4f-gemini": "/providers/g4f-gemini.svg",
  "g4f-groq": "/providers/g4f-groq.svg",
  "g4f-nvidia": "/providers/g4f-nvidia.svg",
  "g4f-ollama": "/providers/g4f-ollama.svg",
  "g4f-pollinations": "/providers/g4f-pollinations.svg",
  "ghe-copilot": "/providers/github.png",
  "gitlab-duo": "/providers/gitlab.png",
  glhf: "/providers/glhf.svg",
  glmt: "/providers/glm.svg",
  "google-pse": "/providers/google-pse.svg",
  "grok-cli": "/providers/xai.svg",
  haiper: "/providers/haiper.svg",
  hyperagent: "/providers/hyperagent.svg",
  inception: "/providers/inception.svg",
  inclusionai: "/providers/inclusionai.svg",
  internlm: "/providers/internlm.svg",
  kilocode: "/providers/kilocode.svg",
  "kimi-coding-apikey": "/providers/kimi-coding.png",
  llamagate: "/providers/llamagate.svg",
  mimocode: "/providers/xiaomi-mimo.svg",
  monsterapi: "/providers/monsterapi.svg",
  nara: "/providers/nara.svg",
  navy: "/providers/navy.svg",
  "notion-web": "/providers/notion-web.svg",
  plamo: "/providers/plamo.svg",
  promptql: "/providers/promptql.svg",
  "qwen-cloud": "/providers/qwen-cloud.svg",
  "qwen-cloud-token-plan": "/providers/qwen-cloud-token-plan.svg",
  "qwen-web": "/providers/qwen.svg",
  qwencoder: "/providers/qwen.svg",
  routeway: "/providers/routeway.svg",
  sarvam: "/providers/sarvam.svg",
  sealion: "/providers/sealion.svg",
  sensenova: "/providers/sensenova.ico",
  sparkdesk: "/providers/iflytek.png",
  thebai: "/providers/thebai.svg",
  typhoon: "/providers/typhoon.svg",
  "v0-vercel": "/providers/v0-vercel-web.svg",
  writer: "/providers/writer.svg",
  x5lab: "/providers/x5lab.svg",
  "xai-oauth": "/providers/xai-oauth.svg",
  "xiaomi-mimo": "/providers/xiaomi-mimo.svg",
  "yuanbao-web": "/providers/tencent.svg",
  "zai-web": "/providers/zai.svg",
};

const curatedProviderIconIds = new Set([
  "ai21",
  "alicode",
  "alicode-intl",
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
  "zai"
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
