/**
 * Re-export session manager for OmniRoute/CLIProxyAPI service path parity.
 * Implementation lives in open-sse/utils/sessionManager.js
 */
export {
  deriveSessionId,
  generateBinaryStyleId,
  clearSessionStore,
} from "../utils/sessionManager.js";

// Also re-export anything else utils may add later
export * from "../utils/sessionManager.js";
