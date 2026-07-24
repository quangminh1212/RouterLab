import { FREE_PROVIDERS } from "./free.js";
import { FREE_TIER_PROVIDERS } from "./free-tier.js";
import { OAUTH_PROVIDERS } from "./oauth.js";
import { APIKEY_PROVIDERS } from "./apikey.js";
import { WEB_COOKIE_PROVIDERS } from "./web-cookie.js";

/** Combined UI provider catalog */
export const AI_PROVIDERS = {
  ...FREE_PROVIDERS,
  ...FREE_TIER_PROVIDERS,
  ...OAUTH_PROVIDERS,
  ...APIKEY_PROVIDERS,
  ...WEB_COOKIE_PROVIDERS,
};
