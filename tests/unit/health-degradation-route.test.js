import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/health/degradation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns summary view when summary=true", async () => {
    vi.doMock("@/lib/runtimeGuard", () => ({
      getRuntimeHealth: vi.fn(() => ({ status: "degraded", timestamp: "2026-06-02T00:00:00.000Z" })),
    }));

    const { GET } = await import("@/app/api/health/degradation/route");
    const response = await GET(new Request("http://localhost/api/health/degradation?summary=true"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      summary: {
        runtimeStatus: "degraded",
        degraded: true,
        timestamp: "2026-06-02T00:00:00.000Z",
      },
      isDegraded: true,
    });
  });

  it("returns full degradation payload by default", async () => {
    vi.doMock("@/lib/runtimeGuard", () => ({
      getRuntimeHealth: vi.fn(() => ({ status: "healthy", timestamp: "2026-06-02T00:00:00.000Z" })),
    }));

    const { GET } = await import("@/app/api/health/degradation/route");
    const response = await GET(new Request("http://localhost/api/health/degradation"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.active).toBe(false);
    expect(data.features.runtime).toEqual({ status: "healthy", timestamp: "2026-06-02T00:00:00.000Z" });
  });
});
