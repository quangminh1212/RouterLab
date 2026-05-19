import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status || 200,
      headers: new Headers(init?.headers || {}),
      json: async () => body,
    })),
  },
}));

vi.mock("@/lib/localDb", () => ({
  getSettings: vi.fn(),
  getProviderConnections: vi.fn(),
}));

vi.mock("@/shared/constants/config", () => ({
  APP_CONFIG: {
    name: "XLab Router",
    version: "1.0.47",
  },
}));

describe("GET /api/monitoring/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summarizes provider health from active, cooldown, unavailable and inactive connections", async () => {
    const { getSettings, getProviderConnections } = await import("@/lib/localDb");
    vi.mocked(getSettings).mockResolvedValue({
      requireApiKey: true,
      requireLogin: false,
      fallbackStrategy: "round-robin",
      observabilityEnabled: true,
    });

    const cooldownUntil = new Date(Date.now() + 60_000).toISOString();
    vi.mocked(getProviderConnections).mockResolvedValue([
      {
        id: "oa-active",
        provider: "openai",
        name: "OpenAI Active",
        isActive: true,
        testStatus: "active",
      },
      {
        id: "oa-cooldown",
        provider: "openai",
        email: "cooldown@example.com",
        isActive: true,
        testStatus: "unavailable",
        modelLock_gpt4o: cooldownUntil,
        lastError: "Rate limit exceeded",
        lastErrorAt: "2026-05-20T02:00:00.000Z",
        errorCode: 429,
        backoffLevel: 2,
      },
      {
        id: "cl-unavailable",
        provider: "claude",
        name: "Claude Down",
        isActive: true,
        testStatus: "unavailable",
        lastError: "Upstream 503",
        lastErrorAt: "2026-05-20T01:00:00.000Z",
        errorCode: 503,
      },
      {
        id: "gm-inactive",
        provider: "gemini",
        name: "Gemini Off",
        isActive: false,
        testStatus: "active",
      },
    ]);

    const { GET } = await import("../../src/app/api/monitoring/health/route.js");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.app.version).toBe("1.0.47");
    expect(body.settings).toEqual({
      requireApiKey: true,
      requireLogin: false,
      fallbackStrategy: "round-robin",
      observabilityEnabled: true,
    });
    expect(body.totals).toMatchObject({
      providers: 3,
      connections: 4,
      activeConnections: 1,
      cooldownConnections: 1,
      unavailableConnections: 1,
      inactiveConnections: 1,
      activeModelLocks: 1,
    });

    const openai = body.providers.find((provider) => provider.provider === "openai");
    expect(openai.status).toBe("degraded");
    expect(openai.cooldownConnections).toBe(1);
    expect(openai.activeConnections).toBe(1);
    expect(openai.earliestRetryAfter).toBe(cooldownUntil);
    expect(openai.connections[1].status).toBe("cooldown");
    expect(openai.connections[1].modelLocks).toEqual([{ model: "gpt4o", until: cooldownUntil }]);

    const claude = body.providers.find((provider) => provider.provider === "claude");
    expect(claude.status).toBe("unavailable");

    const gemini = body.providers.find((provider) => provider.provider === "gemini");
    expect(gemini.connections[0].status).toBe("inactive");
  });
});
