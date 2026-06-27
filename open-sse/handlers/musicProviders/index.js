import suno from "./suno.js";
import udio from "./udio.js";

const ADAPTERS = {
  suno,
  udio,
};

export function getMusicAdapter(provider) {
  return ADAPTERS[provider] || null;
}

export function isMusicProvider(provider) {
  return provider in ADAPTERS;
}
