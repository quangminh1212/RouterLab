import { getSettings } from "@/lib/localDb";
import { applyOutboundProxyEnv } from "@/lib/network/outboundProxy";
import { logger } from "@/lib/logger";

let initialized = false;

export async function ensureOutboundProxyInitialized() {
  if (initialized) return true;

  try {
    logger.info("INIT", "Starting outbound proxy initialization");
    const settings = await getSettings();
    applyOutboundProxyEnv(settings);
    initialized = true;
    logger.info("INIT", "Outbound proxy initialization completed");
  } catch (error) {
    logger.error("INIT", "Error initializing outbound proxy", error);
  }

  return initialized;
}

if (process.env.NEXT_PHASE !== "phase-production-build") {
  logger.info("INIT", "Auto-initialize outbound proxy enabled");
  ensureOutboundProxyInitialized().catch(console.log);
}

export default ensureOutboundProxyInitialized;
