/**
 * Modular provider catalog (RouterLab).
 * Split by auth group for maintainability (OmniRoute / 9router style).
 * Public API stays stable via this barrel + ../providers.js shim.
 */
export {
  RISK_NOTICE,
  XIAOMI_TOKENPLAN_REGIONS,
  resolveXiaomiTokenPlanBaseUrl,
  THINKING_CONFIG,
  MINIMAX_TTS_MODELS,
} from "./_shared.js";

export { FREE_PROVIDERS } from "./free.js";
export { FREE_TIER_PROVIDERS } from "./free-tier.js";
export { OAUTH_PROVIDERS } from "./oauth.js";
export { APIKEY_PROVIDERS } from "./apikey.js";
export { WEB_COOKIE_PROVIDERS } from "./web-cookie.js";

export {
  MEDIA_PROVIDER_KINDS,
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
  CUSTOM_EMBEDDING_PREFIX,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
  isCustomEmbeddingProvider,
} from "./media-kinds.js";

export { AI_PROVIDERS } from "./catalog.js";
export * from "./helpers.js";
