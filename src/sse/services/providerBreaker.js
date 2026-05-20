import * as log from "../utils/logger.js";

const STATE = {
  CLOSED: "closed",
  OPEN: "open",
  HALF_OPEN: "half_open",
};

const BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenProbes: 1,
};

const TRANSIENT_STATUSES = new Set([502, 503, 504, 520, 521, 522, 524, 529]);

const breakers = new Map();

function makeState() {
  return {
    state: STATE.CLOSED,
    failures: 0,
    lastFailureAt: null,
    halfOpenAllowed: 0,
  };
}

function getBreaker(provider) {
  if (!breakers.has(provider)) breakers.set(provider, makeState());
  return breakers.get(provider);
}

function refreshState(breaker) {
  if (breaker.state === STATE.OPEN && breaker.lastFailureAt !== null) {
    const elapsed = Date.now() - breaker.lastFailureAt;
    if (elapsed >= BREAKER_CONFIG.resetTimeoutMs) {
      breaker.state = STATE.HALF_OPEN;
      breaker.halfOpenAllowed = BREAKER_CONFIG.halfOpenProbes;
    }
  }
}

export function isBreakerTrippableStatus(status) {
  return TRANSIENT_STATUSES.has(status);
}

export function canExecuteProvider(provider) {
  const breaker = getBreaker(provider);
  refreshState(breaker);

  if (breaker.state === STATE.CLOSED) return true;
  if (breaker.state === STATE.OPEN) return false;
  if (breaker.state === STATE.HALF_OPEN) {
    if (breaker.halfOpenAllowed > 0) {
      breaker.halfOpenAllowed -= 1;
      return true;
    }
    return false;
  }
  return false;
}

export function recordProviderFailure(provider, status) {
  if (!isBreakerTrippableStatus(status)) return;
  const breaker = getBreaker(provider);
  refreshState(breaker);

  if (breaker.state === STATE.HALF_OPEN) {
    breaker.state = STATE.OPEN;
    breaker.failures = BREAKER_CONFIG.failureThreshold;
    breaker.lastFailureAt = Date.now();
    breaker.halfOpenAllowed = 0;
    log.warn("BREAKER", `Provider ${provider} reopened breaker after failed probe [${status}]`);
    return;
  }

  breaker.failures += 1;
  breaker.lastFailureAt = Date.now();
  if (breaker.failures >= BREAKER_CONFIG.failureThreshold) {
    breaker.state = STATE.OPEN;
    breaker.halfOpenAllowed = 0;
    log.warn("BREAKER", `Provider ${provider} opened breaker after ${breaker.failures} failures [${status}]`);
  }
}

export function recordProviderSuccess(provider) {
  const breaker = getBreaker(provider);
  if (breaker.state === STATE.CLOSED && breaker.failures === 0) return;

  const previousState = breaker.state;
  breaker.state = STATE.CLOSED;
  breaker.failures = 0;
  breaker.lastFailureAt = null;
  breaker.halfOpenAllowed = 0;

  if (previousState !== STATE.CLOSED) {
    log.info("BREAKER", `Provider ${provider} closed breaker from ${previousState}`);
  }
}

export function getAllBreakerStatuses() {
  const now = Date.now();
  const statuses = [];
  for (const [provider, breaker] of breakers.entries()) {
    refreshState(breaker);
    const retryAfterMs = breaker.state === STATE.OPEN && breaker.lastFailureAt !== null
      ? Math.max(0, BREAKER_CONFIG.resetTimeoutMs - (now - breaker.lastFailureAt))
      : null;
    statuses.push({
      provider,
      state: breaker.state,
      failures: breaker.failures,
      lastFailureAt: breaker.lastFailureAt ? new Date(breaker.lastFailureAt).toISOString() : null,
      retryAfterMs,
    });
  }
  return statuses.sort((left, right) => left.provider.localeCompare(right.provider));
}

export function resetProviderBreaker(provider) {
  breakers.delete(provider);
}

export function resetAllBreakers() {
  breakers.clear();
}
