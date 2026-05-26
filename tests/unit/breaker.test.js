import { beforeEach, describe, expect, it } from "vitest";
import {
  canExecuteProvider,
  getAllBreakerStatuses,
  isBreakerTrippableStatus,
  recordProviderFailure,
  recordProviderSuccess,
  resetAllBreakers,
} from "../../src/sse/services/providerBreaker.js";

describe("provider breaker", () => {
  beforeEach(() => {
    resetAllBreakers();
  });

  it("trips only on transient upstream statuses", () => {
    expect(isBreakerTrippableStatus(502)).toBe(true);
    expect(isBreakerTrippableStatus(503)).toBe(true);
    expect(isBreakerTrippableStatus(429)).toBe(false);
    expect(isBreakerTrippableStatus(401)).toBe(false);
  });

  it("opens breaker after threshold and blocks execution", () => {
    for (let i = 0; i < 5; i += 1) recordProviderFailure("openai", 503);
    expect(canExecuteProvider("openai")).toBe(false);

    const status = getAllBreakerStatuses().find((item) => item.provider === "openai");
    expect(status.state).toBe("open");
    expect(status.failures).toBe(5);
    expect(status.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets breaker on success", () => {
    for (let i = 0; i < 5; i += 1) recordProviderFailure("claude", 502);
    expect(canExecuteProvider("claude")).toBe(false);

    recordProviderSuccess("claude");

    expect(canExecuteProvider("claude")).toBe(true);
    const status = getAllBreakerStatuses().find((item) => item.provider === "claude");
    expect(status.state).toBe("closed");
    expect(status.failures).toBe(0);
  });
});
