import { beforeEach, describe, expect, it, vi } from "vitest";

describe("oauth json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/oauth/cursor/import rejects invalid json", async () => {
    vi.doMock("@/lib/oauth/services/cursor", () => ({ CursorService: vi.fn() }));
    vi.doMock("@/models", () => ({ createProviderConnection: vi.fn() }));
    const { POST } = await import("@/app/api/oauth/cursor/import/route");
    const response = await POST(new Request("http://localhost/api/oauth/cursor/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/oauth/kiro/import rejects invalid json", async () => {
    vi.doMock("@/lib/oauth/services/kiro", () => ({ KiroService: vi.fn() }));
    vi.doMock("@/models", () => ({ createProviderConnection: vi.fn() }));
    const { POST } = await import("@/app/api/oauth/kiro/import/route");
    const response = await POST(new Request("http://localhost/api/oauth/kiro/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/oauth/kiro/social-exchange rejects invalid json", async () => {
    vi.doMock("@/lib/oauth/services/kiro", () => ({ KiroService: vi.fn() }));
    vi.doMock("@/models", () => ({ createProviderConnection: vi.fn() }));
    const { POST } = await import("@/app/api/oauth/kiro/social-exchange/route");
    const response = await POST(new Request("http://localhost/api/oauth/kiro/social-exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/oauth/iflow/cookie rejects invalid json", async () => {
    vi.doMock("@/models", () => ({ createProviderConnection: vi.fn() }));
    const { POST } = await import("@/app/api/oauth/iflow/cookie/route");
    const response = await POST(new Request("http://localhost/api/oauth/iflow/cookie", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("POST /api/oauth/repair-env rejects invalid json", async () => {
    const { POST } = await import("@/app/api/oauth/repair-env/route");
    const response = await POST(new Request("http://localhost/api/oauth/repair-env", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
