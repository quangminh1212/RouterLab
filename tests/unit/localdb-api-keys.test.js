import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("localDb createApiKey", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xlabrouter-apikeys-"));
    process.env.DATA_DIR = tempDir;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DATA_DIR;
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("accepts custom api key and rejects duplicates", async () => {
    const { createApiKey } = await import("@/lib/localDb");

    const created = await createApiKey("Primary", "machine-1", null, null, null, "demo-ABCdef123456");
    expect(created.key).toBe("demo-ABCdef123456");

    await expect(
      createApiKey("Duplicate", "machine-1", null, null, null, "demo-ABCdef123456"),
    ).rejects.toThrow("apiKey already exists");
  });

  it("rejects invalid custom api key format", async () => {
    const { createApiKey } = await import("@/lib/localDb");
    await expect(createApiKey("Bad", "machine-1", null, null, null, "not-valid")).rejects.toThrow(
      "apiKey format is invalid",
    );
  });

  it("generates standard sk key when custom key missing", async () => {
    const { createApiKey } = await import("@/lib/localDb");
    const created = await createApiKey("Generated", "machine-1");
    expect(created.key).toMatch(/^sk-[A-Za-z0-9]{24}$/);
  });
});
