import openai from "./openai.js";
import stabilityAi from "./stabilityAi.js";
import falAi from "./falAi.js";

const ADAPTERS = { openai, "stability-ai": stabilityAi, "fal-ai": falAi };

export function getImageEditAdapter(provider) {
  return ADAPTERS[provider] || null;
}

export function isImageEditProvider(provider) {
  return provider in ADAPTERS;
}
