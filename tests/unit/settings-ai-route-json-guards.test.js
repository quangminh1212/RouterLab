import { beforeEach, describe, expect, it, vi } from "vitest";

describe("settings ai route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("PUT /api/settings/ai-rules rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
    const { PUT } = await import("@/app/api/settings/ai-rules/route");
    const response = await PUT(new Request("http://localhost/api/settings/ai-rules", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/settings/ai-test rejects invalid json", async () => {
    const { POST } = await import("@/app/api/settings/ai-test/route");
    const response = await POST(new Request("http://localhost/api/settings/ai-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Invalid JSON body" });
  });
});
