import { beforeEach, describe, expect, it, vi } from "vitest";

async function setupRoute() {
  const { EventEmitter } = await import("node:events");
  const mocks = {
    emitter: new EventEmitter(),
    getUsageStats: vi.fn().mockResolvedValue({ activeRequests: [], recentRequests: [], pending: {} }),
    getActiveRequests: vi.fn().mockResolvedValue({ activeRequests: [], recentRequests: [], errorProvider: "" }),
  };

  vi.doMock("@/lib/usageDb", () => ({
    getUsageStats: mocks.getUsageStats,
    getActiveRequests: mocks.getActiveRequests,
    statsEmitter: mocks.emitter,
  }));

  vi.doMock("@/lib/logger", () => ({
    logger: {
      dashboardPerf: {
        traceId: vi.fn(() => "trace-1"),
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
      },
    },
  }));

  const mod = await import("@/app/api/usage/stream/route");
  return { GET: mod.GET, mocks };
}

async function readChunk(reader) {
  const { value } = await reader.read();
  return new TextDecoder().decode(value);
}

describe("usage stream refresh protocol", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("announces refresh support before initial stats", async () => {
    const { GET } = await setupRoute();
    const response = await GET(new Request("http://localhost/api/usage/stream"));
    const reader = response.body.getReader();

    await expect(readChunk(reader)).resolves.toBe('data: {"support_refresh":true}\n\n');
    await expect(readChunk(reader)).resolves.toBe('data: {"activeRequests":[],"recentRequests":[],"pending":{}}\n\n');

    await reader.cancel();
  });

  it("sends refresh control frame before full update", async () => {
    const { GET, mocks } = await setupRoute();
    const response = await GET(new Request("http://localhost/api/usage/stream"));
    const reader = response.body.getReader();

    await readChunk(reader);
    await readChunk(reader);
    mocks.emitter.emit("update");

    await expect(readChunk(reader)).resolves.toBe('data: {"refresh":true}\n\n');

    await reader.cancel();
  });
});
