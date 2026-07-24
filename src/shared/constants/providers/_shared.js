// Shared provider constants (split from monolithic providers.js)

export const RISK_NOTICE = "⚠️ Risk Notice: This provider uses a subscription/OAuth session not officially licensed for proxy/router use. Account may be restricted or banned. Use at your own risk.";

export const XIAOMI_TOKENPLAN_REGIONS = {
  sgp: "https://token-plan-sgp.xiaomimimo.com/v1",
  cn: "https://token-plan-cn.xiaomimimo.com/v1",
  ams: "https://token-plan-ams.xiaomimimo.com/v1",
};

export function resolveXiaomiTokenPlanBaseUrl(region = "sgp") {
  const normalized = String(region || "sgp").trim().toLowerCase();
  return XIAOMI_TOKENPLAN_REGIONS[normalized] || XIAOMI_TOKENPLAN_REGIONS.sgp;
}

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

export const MINIMAX_TTS_MODELS = [
  { id: "speech-2.8-hd", name: "Speech 2.8 HD" },
  { id: "speech-2.8-turbo", name: "Speech 2.8 Turbo" },
  { id: "speech-2.6-hd", name: "Speech 2.6 HD" },
  { id: "speech-2.6-turbo", name: "Speech 2.6 Turbo" },
  { id: "speech-02-hd", name: "Speech 02 HD" },
  { id: "speech-02-turbo", name: "Speech 02 Turbo" },
  { id: "speech-01-hd", name: "Speech 01 HD" },
  { id: "speech-01-turbo", name: "Speech 01 Turbo" },
];

