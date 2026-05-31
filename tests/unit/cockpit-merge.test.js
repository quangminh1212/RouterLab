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
          totalRequestsLifetime: 100,
          dailySummary: {},
          cockpitImports: [],
        },
      },
      async read() {},
      async write() {},
    };
    return {
      getDb: vi.fn().mockResolvedValue(state),
      getPricingForModel: vi.fn().mockResolvedValue(null),
      invalidateApiKeyCostCache: vi.fn(),
      getProviderConnections: vi.fn().mockResolvedValue([]),
      getApiKeys: vi.fn().mockResolvedValue([]),
      getProviderNodes: vi.fn().mockResolvedValue([]),
    };
  });
  return import("@/lib/usageDb");
}

const entries = [
  { dateKey: "2026-05-18", provider: "antigravity", model: "claude-opus-4-6", requests: 12, promptTokens: 1000, completionTokens: 500, cost: 0.42 },
  { dateKey: "2026-05-19", provider: "antigravity", model: "gemini-3.1-pro", requests: 5, promptTokens: 200, completionTokens: 100, cost: 0.1 },
];

describe("mergeCockpitUsage", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "xlabrouter-cockpit-test-"));
    process.env.DATA_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    vi.resetModules();
    vi.clearAllMocks();
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("adds cockpit usage into dailySummary and bumps lifetime total", async () => {
    const usageDb = await loadUsageModule();
    const res = await usageDb.mergeCockpitUsage(entries, { importKey: "key-1", label: "test" });

    expect(res.imported).toBe(true);
    expect(res.addedRequests).toBe(17);
    expect(res.days).toBe(2);

    const exported = await usageDb.exportUsageDb();
    // 100 baseline lifetime + 17 imported
    expect(exported.totalRequestsLifetime).toBeGreaterThanOrEqual(117);
    expect(Object.keys(exported.dailySummary)).toEqual(
      expect.arrayContaining(["2026-05-18", "2026-05-19"])
    );

    const history = await usageDb.getUsageHistory();
    // Merge must not fabricate per-request history rows.
    expect(history).toHaveLength(0);
  });

  it("is idempotent for the same importKey", async () => {
    const usageDb = await loadUsageModule();
    const first = await usageDb.mergeCockpitUsage(entries, { importKey: "dupe" });
    const second = await usageDb.mergeCockpitUsage(entries, { importKey: "dupe" });

    expect(first.imported).toBe(true);
    expect(second.imported).toBe(false);
    expect(second.alreadyImported).toBe(true);
    expect(second.addedRequests).toBe(0);
  });

  it("accumulates when importKeys differ", async () => {
    const usageDb = await loadUsageModule();
    await usageDb.mergeCockpitUsage(entries, { importKey: "a" });
    const res = await usageDb.mergeCockpitUsage(entries, { importKey: "b" });
    expect(res.imported).toBe(true);
    expect(res.addedRequests).toBe(17);
  });
});
