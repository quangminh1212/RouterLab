import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempDir = "";

/**
 * Load requestDetailsDb with observability enabled and small size limits so we
 * can assert the compaction guards actually fire.
 */
async function loadModule({ maxJsonSize = 2, maxRecords = 80 } = {}) {
  vi.resetModules();
  vi.doMock("@/lib/localDb", () => ({
    getSettings: vi.fn().mockResolvedValue({
      enableObservability: true,
      observabilityMaxRecords: maxRecords,
      observabilityBatchSize: 1,
      observabilityFlushIntervalMs: 250,
      observabilityMaxJsonSize: maxJsonSize, // KB
    }),
  }));
  return import("@/lib/requestDetailsDb");
}

describe("request details storage compaction", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "xlabrouter-rd-test-"));
    process.env.DATA_DIR = tempDir;
    process.env.OBSERVABILITY_ENABLED = "true";
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    delete process.env.OBSERVABILITY_ENABLED;
    vi.resetModules();
    vi.clearAllMocks();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("truncates oversized fields instead of storing them verbatim", async () => {
    const mod = await loadModule({ maxJsonSize: 2 }); // 2KB limit per field
    const huge = "x".repeat(500 * 1024); // 500KB payload

    await mod.saveRequestDetail({
      provider: "openai",
      model: "gpt-test",
      providerRequest: { body: huge },
      request: { ok: true },
    });

    const { details } = await mod.getRequestDetails({ page: 1, pageSize: 10 });
    expect(details).toHaveLength(1);

    const record = details[0];
    // Oversized field must be replaced by a compact marker.
    expect(record.providerRequest._truncated).toBe(true);
    expect(record.providerRequest._originalSize).toBeGreaterThan(500 * 1024);
    // Small field must be preserved as-is.
    expect(record.request).toEqual({ ok: true });

    // The serialized record must stay small (well under 64KB hard cap).
    const recordSize = Buffer.byteLength(JSON.stringify(record), "utf8");
    expect(recordSize).toBeLessThan(64 * 1024);
  });

  it("keeps the on-disk file bounded even with many huge records", async () => {
    const mod = await loadModule({ maxJsonSize: 2, maxRecords: 50 });
    const huge = "y".repeat(300 * 1024);

    for (let i = 0; i < 40; i += 1) {
      await mod.saveRequestDetail({
        provider: "openai",
        model: `m-${i}`,
        providerRequest: { body: huge },
        timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      });
    }

    const dbFile = path.join(tempDir, "request-details.json");
    const stat = await fs.stat(dbFile);
    // 40 records that were each ~300KB raw would be ~12MB+ if unbounded.
    // After compaction each record is tiny, so the file must be far smaller.
    expect(stat.size).toBeLessThan(1 * 1024 * 1024);
  });
});
