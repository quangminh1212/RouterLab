import initializeApp from "@/shared/services/app";
import { logger } from "@/lib/logger";

let initialized = false;

export async function ensureAppInitialized() {
  if (!initialized) {
    try {
      logger.info("INIT", "Starting local app initialization");
      await initializeApp();
      initialized = true;
      logger.info("INIT", "Local app initialization completed");
    } catch (error) {
      logger.error("INIT", "Error initializing app", error);
    }
  }
  return initialized;
}

// Auto-initialize at runtime only, not during next build
if (process.env.NEXT_PHASE !== "phase-production-build") {
  logger.info("INIT", "Auto-initialize local services enabled");
  ensureAppInitialized().catch(console.log);
}

export default ensureAppInitialized;
