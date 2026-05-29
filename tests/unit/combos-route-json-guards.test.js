import { beforeEach, describe, expect, it, vi } from "vitest";

describe("combos route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/combos rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getCombos: vi.fn(), createCombo: vi.fn(), getComboByName: vi.fn() }));
    const { POST } = await import("@/app/api/combos/route");
    const response = await POST(new Request("http://localhost/api/combos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PUT /api/combos/[id] rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getComboById: vi.fn(), updateCombo: vi.fn(), deleteCombo: vi.fn(), getComboByName: vi.fn() }));
    vi.doMock("open-sse/services/combo.js", () => ({ resetComboRotation: vi.fn() }));
    const { PUT } = await import("@/app/api/combos/[id]/route");
    const response = await PUT(new Request("http://localhost/api/combos/1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
