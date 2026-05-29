import { beforeEach, describe, expect, it, vi } from "vitest";

describe("locale/basic-chat route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("POST /api/locale rejects invalid json as invalid locale", async () => {
    vi.doMock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: vi.fn() })) }));
    vi.doMock("@/i18n/config", () => ({ LOCALE_COOKIE: "locale", normalizeLocale: vi.fn((v) => v), isSupportedLocale: vi.fn(() => false) }));
    const { POST } = await import("@/app/api/locale/route");
    const response = await POST(new Request("http://localhost/api/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid locale" });
  });

  it("POST /api/basic-chat/state rejects invalid json", async () => {
    vi.doMock("@/lib/localDb", () => ({ getBasicChatData: vi.fn(), updateBasicChatData: vi.fn() }));
    const { POST } = await import("@/app/api/basic-chat/state/route");
    const response = await POST(new Request("http://localhost/api/basic-chat/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
