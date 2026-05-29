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

vi.mock("@/lib/runtimeGuard", () => ({
  getRuntimeHealth: vi.fn(),
}));

describe("GET /health", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns a simple readiness payload", async () => {
    const { getRuntimeHealth } = await import("@/lib/runtimeGuard");
    vi.mocked(getRuntimeHealth).mockReturnValue({
      status: "ok",
      degradedReasons: [],
      inFlight: 0,
      eventLoopLagMsP99: 0,
      memory: {},
      limits: {},
      routes: {},
      timestamp: "2026-05-29T07:00:00.000Z",
    });

    const { GET } = await import("../../src/app/health/route.js");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      status: "ok",
      degraded: false,
      timestamp: "2026-05-29T07:00:00.000Z",
      route: "/health",
    });
  });
});

