import { beforeEach, describe, expect, it, vi } from "vitest";

describe("settings proxy-test route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/settings/proxy-test rejects invalid json", async () => {
    vi.doMock("@/lib/network/proxyTest", () => ({ testProxyUrl: vi.fn() }));
    const { POST } = await import("@/app/api/settings/proxy-test/route");
    const response = await POST(new Request("http://localhost/api/settings/proxy-test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Invalid JSON body" });
  });
});
