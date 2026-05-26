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
});
