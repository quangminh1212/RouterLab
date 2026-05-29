import { beforeEach, describe, expect, it, vi } from "vitest";

describe("management status API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns aggregated localhost-only status payload", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getSettings: vi.fn().mockResolvedValue({
        requireApiKey: true,
        requireLogin: false,
        fallbackStrategy: "round-robin",
        comboStrategy: "cost-optimized",
        stickyRoundRobinLimit: 4,
        forceModelMappings: true,
        forcedModelMappings: {
          sonnet: "anthropic/claude-sonnet-4.5",
          invalid: "claude-sonnet-4.5",
        },
        observabilityEnabled: true,
        observabilityMaxRecords: 500,
      }),
      getProviderConnections: vi.fn().mockResolvedValue([
        { id: "1", provider: "openai", isActive: true, testStatus: "active" },
        { id: "2", provider: "openai", isActive: false, testStatus: "active" },
        { id: "3", provider: "anthropic", isActive: true, testStatus: "unavailable" },
      ]),
    }));

    vi.doMock("@/lib/runtimeGuard", () => ({
      getRuntimeHealth: vi.fn(() => ({
        status: "healthy",
        timestamp: "2026-05-27T00:00:00.000Z",
      })),
    }));

    const { GET } = await import("@/app/api/management/status/route");
    const response = await GET(new Request("http://localhost/api/management/status", { headers: { host: "localhost" } }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.app.version).toBeTruthy();
    expect(data.runtime.status).toBe("healthy");
    expect(data.auth).toEqual({ requireApiKey: true, requireLogin: false });
    expect(data.routing).toMatchObject({
      fallbackStrategy: "round-robin",
      comboStrategy: "cost-optimized",
      stickyRoundRobinLimit: 4,
      forceModelMappings: true,
      forcedModelMappingsCount: 1,
    });
    expect(data.connections.totals).toEqual({
      total: 3,
      active: 1,
      inactive: 1,
      unavailable: 1,
    });
    expect(data.modelMappings).toEqual({
      forceEnabled: true,
      mappings: { sonnet: "anthropic/claude-sonnet-4.5" },
    });
  });

  it("rejects requests that only spoof x-forwarded-host", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getSettings: vi.fn(),
      getProviderConnections: vi.fn(),
    }));

    vi.doMock("@/lib/runtimeGuard", () => ({
      getRuntimeHealth: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/status/route");
    const response = await GET(new Request("http://example.com/api/management/status", {
      headers: {
        host: "example.com",
        "x-forwarded-host": "localhost",
      },
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });

  it("rejects non-localhost requests", async () => {
    vi.doMock("@/lib/localDb", () => ({
      getSettings: vi.fn(),
      getProviderConnections: vi.fn(),
    }));

    vi.doMock("@/lib/runtimeGuard", () => ({
      getRuntimeHealth: vi.fn(),
    }));

    const { GET } = await import("@/app/api/management/status/route");
    const response = await GET(new Request("http://example.com/api/management/status", {
      headers: { host: "example.com" },
    }));
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toMatch(/restricted to localhost/i);
  });
});
