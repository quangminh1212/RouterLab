import { beforeEach, describe, expect, it, vi } from "vitest";

describe("settings route json guards", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("/api/settings/usage rejects invalid json", async () => {
    vi.doMock("@/lib/usageDb", () => ({ exportUsageDb: vi.fn(), importUsageDb: vi.fn() }));
    vi.doMock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
    const { POST } = await import("@/app/api/settings/usage/route");
    const response = await POST(new Request("http://localhost/api/settings/usage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
  });

  it("/api/settings/ram rejects invalid json", async () => {
    const { POST } = await import("@/app/api/settings/ram/route");
    const response = await POST(new Request("http://localhost/api/settings/ram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("/api/settings/database rejects invalid json", async () => {
    vi.doMock("@/lib/backupBundle", () => ({ createBackupBundle: vi.fn(), restoreBackupBundle: vi.fn() }));
    const { POST } = await import("@/app/api/settings/database/route");
    const response = await POST(new Request("http://localhost/api/settings/database", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });
});
