import { beforeEach, describe, expect, it, vi } from "vitest";

describe("remaining route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/dashboard/chat/completions rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getApiKeys: vi.fn() }));
    vi.doMock("open-sse/config/appConstants.js", () => ({ INTERNAL_REQUEST_HEADER: { name: "x-test", value: "1" } }));
    const { POST } = await import("@/app/api/dashboard/chat/completions/route");
    const response = await POST(new Request("http://localhost/api/dashboard/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/oauth/[provider]/[action] rejects non-object json", async () => {
    vi.doMock("@/lib/oauth/providers", () => ({
      getProvider: vi.fn(),
      generateAuthData: vi.fn(),
      exchangeTokens: vi.fn(),
      requestDeviceCode: vi.fn(),
      pollForToken: vi.fn(),
    }));
    vi.doMock("@/models", () => ({ createProviderConnection: vi.fn() }));
    vi.doMock("@/lib/oauth/utils/server", () => ({ startCodexProxy: vi.fn(), stopCodexProxy: vi.fn() }));
    const { POST } = await import("@/app/api/oauth/[provider]/[action]/route");
    const response = await POST(
      new Request("http://localhost/api/oauth/codex/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([1, 2, 3]),
      }),
      { params: Promise.resolve({ provider: "codex", action: "exchange" }) }
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid or empty request body" });
  });

  it("POST /api/oauth/gitlab/pat rejects non-object json", async () => {
    vi.doMock("@/models", () => ({ createProviderConnection: vi.fn() }));
    const { POST } = await import("@/app/api/oauth/gitlab/pat/route");
    const response = await POST(new Request("http://localhost/api/oauth/gitlab/pat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([1, 2, 3]),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body" });
  });

  it("POST /api/cli-tools/antigravity-mitm rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
    vi.doMock("@/mitm/manager", () => ({
      getMitmStatus: vi.fn(),
      startServer: vi.fn(),
      stopServer: vi.fn(),
      enableToolDNS: vi.fn(),
      disableToolDNS: vi.fn(),
      trustCert: vi.fn(),
      initDbHooks: vi.fn(),
    }));
    vi.doMock("@/lib/securePasswordStore", () => ({ getCachedPassword: vi.fn(), loadEncryptedPassword: vi.fn(), setCachedPassword: vi.fn() }));
    const { POST } = await import("@/app/api/cli-tools/antigravity-mitm/route");
    const response = await POST(new Request("http://localhost/api/cli-tools/antigravity-mitm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("PATCH /api/cli-tools/antigravity-mitm rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getSettings: vi.fn(), updateSettings: vi.fn() }));
    vi.doMock("@/mitm/manager", () => ({
      getMitmStatus: vi.fn(),
      startServer: vi.fn(),
      stopServer: vi.fn(),
      enableToolDNS: vi.fn(),
      disableToolDNS: vi.fn(),
      trustCert: vi.fn(),
      initDbHooks: vi.fn(),
    }));
    vi.doMock("@/lib/securePasswordStore", () => ({ getCachedPassword: vi.fn(), loadEncryptedPassword: vi.fn(), setCachedPassword: vi.fn() }));
    const { PATCH } = await import("@/app/api/cli-tools/antigravity-mitm/route");
    const response = await PATCH(new Request("http://localhost/api/cli-tools/antigravity-mitm", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
