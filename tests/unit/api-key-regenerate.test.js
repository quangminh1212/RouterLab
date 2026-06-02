import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("api key regeneration parity", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xlabrouter-regenerate-"));
    process.env.DATA_DIR = tempDir;
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.DATA_DIR;
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("regenerates an existing api key in localDb", async () => {
    const { createApiKey, regenerateApiKey } = await import("@/lib/localDb");
    const created = await createApiKey("Primary", "machine-1", null, null, null, "demo-ABCdef123456");
    const updated = await regenerateApiKey(created.id);

    expect(updated.id).toBe(created.id);
    expect(updated.key).not.toBe(created.key);
    expect(updated.key).toMatch(/^sk-[A-Za-z0-9]{24}$/);
  });

  it("POST /api/keys/[id]/regenerate returns regenerated key", async () => {
    const regenerateApiKey = vi.fn().mockResolvedValue({ id: "k1", key: "sk-ABCDEFGHIJKLMNOPQRSTUVWX" });
    vi.doMock("@/lib/localDb", () => ({ regenerateApiKey }));

    const { POST } = await import("@/app/api/keys/[id]/regenerate/route");
    const response = await POST(new Request("http://localhost/api/keys/k1/regenerate", { method: "POST" }), {
      params: Promise.resolve({ id: "k1" }),
    });

    expect(response.status).toBe(200);
    expect(regenerateApiKey).toHaveBeenCalledWith("k1");
    await expect(response.json()).resolves.toEqual({
      message: "API key regenerated successfully",
      key: "sk-ABCDEFGHIJKLMNOPQRSTUVWX",
      id: "k1",
    });
  });
});
