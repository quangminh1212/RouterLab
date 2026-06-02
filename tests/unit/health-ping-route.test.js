import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/health/ping", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns lightweight ok payload when runtime is healthy", async () => {
    vi.doMock("@/lib/runtimeGuard", () => ({
      getRuntimeHealth: vi.fn(() => ({ status: "healthy", timestamp: "2026-06-02T00:00:00.000Z" })),
    }));

    const { GET } = await import("@/app/api/health/ping/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(typeof data.timestamp).toBe("string");
    expect(typeof data.latencyMs).toBe("number");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns 503 when runtime reports error", async () => {
    vi.doMock("@/lib/runtimeGuard", () => ({
      getRuntimeHealth: vi.fn(() => ({ status: "error", timestamp: "2026-06-02T00:00:00.000Z" })),
    }));

    const { GET } = await import("@/app/api/health/ping/route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "error", error: "runtime_unhealthy" });
  });
});
