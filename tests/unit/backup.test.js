import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir = "";

async function loadUsageModule() {
  vi.resetModules();
  vi.doMock("@/lib/localDb.js", () => {
    const state = {
      data: {
        usageData: {
          history: [],
          totalRequestsLifetime: 0,
          dailySummary: {},
        },
      },
      async read() {},
      async write() {},
    };

    return {
      getDb: vi.fn().mockResolvedValue(state),
      getProviderConnections: vi.fn().mockResolvedValue([]),
      getProviderNodes: vi.fn().mockResolvedValue([]),
      getApiKeys: vi.fn().mockResolvedValue([]),
      getPricingForModel: vi.fn().mockResolvedValue(null),
      invalidateApiKeyCostCache: vi.fn(),
    };
  });
  return import("@/lib/usageDb");
}

describe("usage summary-only backup", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "xlabrouter-usage-test-"));
    process.env.DATA_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    vi.resetModules();
    vi.clearAllMocks();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exports usage backup as summary-only while keeping runtime history compact", async () => {
    const usageDb = await loadUsageModule();

    for (let index = 0; index < 250; index += 1) {
      await usageDb.saveRequestUsage({
        provider: "openai",
        model: "gpt-4.1-mini",
        connectionId: `conn-${index % 3}`,
        endpoint: "/v1/chat/completions",
        tokens: { prompt_tokens: 10, completion_tokens: 5 },
        timestamp: new Date(Date.UTC(2026, 4, 1, 0, 0, index)).toISOString(),
      });
    }

    const exported = await usageDb.exportUsageDb();
    const runtimeHistory = await usageDb.getUsageHistory();

    expect(exported.version).toBe(2);
    expect(exported.history).toEqual([]);
    expect(exported.metadata.storageMode).toBe("summary-only");
    expect(exported.metadata.runtimeHistoryCount).toBeLessThanOrEqual(200);
    expect(exported.totalRequestsLifetime).toBe(250);
    expect(Object.keys(exported.dailySummary).length).toBeGreaterThan(0);
    expect(runtimeHistory.length).toBeLessThanOrEqual(200);
  });

  it("restores summary-only usage without bringing back long history", async () => {
    const usageDb = await loadUsageModule();

    await usageDb.importUsageDb({
      version: 2,
      history: [],
      dailySummary: {
        "2026-05-07": {
          requests: 12,
          promptTokens: 120,
          completionTokens: 48,
          cost: 0.24,
          byProvider: { openai: { requests: 12, promptTokens: 120, completionTokens: 48, cost: 0.24 } },
          byModel: {},
          byAccount: {},
          byApiKey: {},
          byEndpoint: {},
        },
      },
      totalRequestsLifetime: 12,
      metadata: { storageMode: "summary-only" },
    });

    const exported = await usageDb.exportUsageDb();
    const runtimeHistory = await usageDb.getUsageHistory();

    expect(exported.history).toEqual([]);
    expect(exported.totalRequestsLifetime).toBe(12);
    expect(exported.dailySummary["2026-05-07"].requests).toBe(12);
    expect(runtimeHistory).toEqual([]);
  });

  it("deduplicates repeated usage saves for the same request and keeps the richer entry", async () => {
    const usageDb = await loadUsageModule();
    const timestamp = new Date(Date.UTC(2026, 4, 27, 3, 15, 0)).toISOString();

    await usageDb.saveRequestUsage({
      provider: "openai",
      model: "gpt-5.4",
      connectionId: "conn-1",
      endpoint: "/v1/chat/completions",
      tokens: { prompt_tokens: 68564, completion_tokens: 377 },
      cost: 0.0115,
      timestamp,
    });

    await usageDb.saveRequestUsage({
      provider: "openai",
      model: "gpt-5.4",
      connectionId: "conn-1",
      endpoint: "/v1/chat/completions",
      tokens: { prompt_tokens: 68564, completion_tokens: 377 },
      cost: 0.0286,
      durationMs: 6200,
      timestamp: new Date(Date.parse(timestamp) + 800).toISOString(),
    });

    const runtimeHistory = await usageDb.getUsageHistory();

    expect(runtimeHistory).toHaveLength(1);
    expect(runtimeHistory[0].durationMs).toBe(6200);
  });

  it("tracks executor type in runtime history and daily summary", async () => {
    const usageDb = await loadUsageModule();

    await usageDb.saveRequestUsage({
      provider: "codex",
      executorType: "codex-websocket",
      model: "gpt-5.3-codex",
      connectionId: "conn-codex",
      endpoint: "/v1/responses",
      tokens: { prompt_tokens: 100, completion_tokens: 20 },
      timestamp: new Date(Date.UTC(2026, 5, 2, 1, 0, 0)).toISOString(),
    });

    const runtimeHistory = await usageDb.getUsageHistory();
    const exported = await usageDb.exportUsageDb();
    const stats = await usageDb.getUsageStats("all");

    expect(runtimeHistory[0].executorType).toBe("codex-websocket");
    expect(exported.dailySummary["2026-06-02"].byExecutorType["codex-websocket|codex"]).toMatchObject({
      requests: 1,
      promptTokens: 100,
      completionTokens: 20,
      executorType: "codex-websocket",
      provider: "codex",
    });
    expect(stats.byExecutorType["codex-websocket (codex)"]).toMatchObject({ requests: 1, executorType: "codex-websocket" });
  });
});
