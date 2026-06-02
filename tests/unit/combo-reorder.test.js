import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("combo reorder parity", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xlabrouter-combo-reorder-"));
    process.env.DATA_DIR = tempDir;
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.DATA_DIR;
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reorders combos in localDb", async () => {
    const { createCombo, reorderCombos } = await import("@/lib/localDb");
    const first = await createCombo({ name: "first", models: ["a"] });
    const second = await createCombo({ name: "second", models: ["b"] });

    const combos = await reorderCombos([second.id, first.id]);

    expect(combos.map((combo) => combo.id)).toEqual([second.id, first.id]);
    expect(combos.map((combo) => combo.order)).toEqual([0, 1]);
  });

  it("POST /api/combos/reorder forwards comboIds", async () => {
    const reorderCombos = vi.fn().mockResolvedValue([{ id: "b", order: 0 }, { id: "a", order: 1 }]);
    vi.doMock("@/lib/localDb", () => ({ reorderCombos }));

    const { POST } = await import("@/app/api/combos/reorder/route");
    const response = await POST(new Request("http://localhost/api/combos/reorder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comboIds: ["b", "a"] }),
    }));

    expect(response.status).toBe(200);
    expect(reorderCombos).toHaveBeenCalledWith(["b", "a"]);
    await expect(response.json()).resolves.toEqual({ combos: [{ id: "b", order: 0 }, { id: "a", order: 1 }] });
  });
});
